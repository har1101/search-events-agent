# リマインダー機能 設計書

## 参照するブログ・リンク
- [EventBridge×AgentCoreでスケジュール駆動エージェントを作ろう！](https://qiita.com/har1101/items/d36642f5cb2e06a4d9bc)
- [Handle asynchronous and long running agents with Amazon Bedrock AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-long-run.html)

## 参照する参考実装
```sample_async_agent.py
import os, asyncio, logging, json
from typing import Dict, Any
from strands import Agent
from strands.models.bedrock import BedrockModel
from bedrock_agentcore import BedrockAgentCoreApp
import boto3

from tools import http_get, sleep_seconds, current_time, update_next_schedule

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig, RetrievalConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager


log = logging.getLogger("AsyncAgent")
logging.basicConfig(level=logging.INFO)

# SNSクライアントの初期化
sns_client = boto3.client('sns')

app = BedrockAgentCoreApp()

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "jp.anthropic.claude-haiku-4-5-20251001-v1:0")
model = BedrockModel(model_id=MODEL_ID, streaming=False)

# AgentCore Memory 設定（環境変数から取得、デフォルト値あり）
MEMORY_ID = os.environ.get("AGENTCORE_MEMORY_ID")
SESSION_ID = os.environ.get("AGENTCORE_SESSION_ID", "scheduled_agent_session")
ACTOR_ID = os.environ.get("AGENTCORE_ACTOR_ID", "async_agent")
MEMORY_STRATEGY_ID = os.environ.get("AGENTCORE_MEMORY_STRATEGY_ID")

SYSTEM_PROMPT = (
    "You are a pragmatic research agent that runs on a schedule.\n\n"
    "## Memory Context\n"
    "You have access to memory of previous executions. Use this context to:\n"
    "- Understand what was done in previous runs\n"
    "- Avoid repeating the same information\n"
    "- Build upon previous findings\n\n"
    "## Core Behaviors\n"
    "- Think step by step.\n"
    "- Use tools when helpful (http_get, current_time, sleep_seconds, update_next_schedule).\n"
    "- Keep outputs concise unless asked.\n\n"
    "## Execution Rules (Based on Execution Number)\n"
    "Check the input message to identify the execution number (e.g., '1回目', '2回目', '3回目').\n\n"
    "### ODD-numbered executions (1回目, 3回目, 5回目...):\n"
    "1. Return the current time using current_time tool.\n"
    "2. Schedule next execution for 5 minutes later (+5m).\n"
    "3. Set next_input to indicate the next execution number (e.g., 'これは2回目の実行です。').\n\n"
    "### EVEN-numbered executions (2回目, 4回目, 6回目...):\n"
    "1. Search for the latest AWS news/updates using http_get.\n"
    "2. Schedule next execution for 10 minutes later (+10m).\n"
    "3. Set next_input to indicate the next execution number (e.g., 'これは3回目の実行です。').\n\n"
    "## Autonomous Scheduling\n"
    "Before completing your task, you MUST call update_next_schedule with:\n"
    "- next_execution: '+5m' for odd executions, '+10m' for even executions\n"
    "- next_input: 'これはN回目の実行です。' (where N is the next execution number)\n"
)

# メモリー設定を作成（環境変数から取得した値を使用）
memory_config = AgentCoreMemoryConfig(
    memory_id=MEMORY_ID,
    session_id=SESSION_ID,  # 固定値: すべての実行を同じ会話として扱う
    actor_id=ACTOR_ID,      # 固定値: エージェント自体が唯一のアクター
    retrieval_config={
        # summary strategyから前回の実行要約を取得
        f"/strategies/{MEMORY_STRATEGY_ID}/actors/{ACTOR_ID}/sessions/{SESSION_ID}":
            RetrievalConfig(top_k=5, relevance_score=0.3)
    }
)

# セッションマネージャーを作成
session_manager = AgentCoreMemorySessionManager(
    agentcore_memory_config=memory_config
)

agent = Agent(
    model=model,
    tools=[http_get, sleep_seconds, current_time, update_next_schedule],
    system_prompt=SYSTEM_PROMPT,
    session_manager=session_manager
)

# --- SNS通知送信関数 ---
async def send_sns_notification(job_id: str, status: str, message: str, result: Any = None):
    """
    エージェント処理完了後にSNS通知を送信する

    Args:
        job_id: ジョブID
        status: 処理ステータス（"success" or "error"）
        message: 通知メッセージ
        result: エージェントの実行結果（オプション）
    """
    topic_arn = os.environ.get("SNS_TOPIC_ARN")
    if not topic_arn:
        log.warning("[SNS] SNS_TOPIC_ARN環境変数が設定されていないため、通知をスキップします")
        return

    try:
        # 通知メッセージの作成
        notification_data = {
            "job_id": job_id,
            "status": status,
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        }

        if result:
            # 結果が長すぎる場合は切り詰める
            result_str = str(result)
            if len(result_str) > 1000:
                result_str = result_str[:1000] + "...(truncated)"
            notification_data["result"] = result_str

        # SNS通知を非同期で送信（スレッドプールで実行）
        await asyncio.to_thread(
            sns_client.publish,
            TopicArn=topic_arn,
            Subject=f"AgentCore Job {status.upper()}: {job_id}",
            Message=json.dumps(notification_data, indent=2, ensure_ascii=False)
        )

        log.info("[SNS] 通知送信完了: job=%s, status=%s", job_id, status)

    except Exception as e:
        log.error("[SNS] 通知送信失敗: %s", e)
        # 通知失敗はエージェント処理の成功/失敗には影響させない

# --- 裏で回る本処理（invoke_async でネイティブに実行）---
async def _background_run(task_id: int, payload: Dict[str, Any], context):
    job_id = payload.get("job_id", "mvp")
    result = None

    try:
        seconds = int(payload.get("seconds", 0) or 0)
        if seconds > 0:
            # ※ "待ち"はイベントループにやらせる（ツール直呼びではなく）
            await asyncio.sleep(seconds)

        user_input = payload.get("input") or "Say hello and show current_time."
        log.info("[AsyncAgent(SDK)] job=%s | start background | input=%s", job_id, user_input)

        # --- ここが変更点：to_thread → invoke_async（非同期ネイティブ） ---
        # タイムアウトを付けたい場合は wait_for(...) でラップ
        result = await agent.invoke_async(user_input)  # ← await で完了まで非ブロッキングに待つ
        log.info("[AsyncAgent] job=%s | completed | result=%s", job_id, str(result)[:1000])

        # エージェント処理成功後にSNS通知を送信
        await send_sns_notification(
            job_id=job_id,
            status="success",
            message="エージェント処理が正常に完了しました",
            result=result
        )

    except Exception as e:
        log.exception("[AsyncAgent(SDK)] job failed: %s", e)

        # エージェント処理失敗時にもSNS通知を送信
        await send_sns_notification(
            job_id=job_id,
            status="error",
            message=f"エージェント処理中にエラーが発生しました: {str(e)}"
        )

    finally:
        app.complete_async_task(task_id)  # セッション解放（必須）
        log.info("[AsyncAgent] job=%s | task completed and session released", job_id)

# --- 即レスするエントリポイント ---
@app.entrypoint
async def main(payload: Dict[str, Any], context=None):
    if payload.get("action") == "start":
        task_id = app.add_async_task("agent_job", {"job_id": payload.get("job_id")})
        asyncio.create_task(_background_run(task_id, payload, context))
        return {"status": "started", "task_id": task_id}
    return {"status": "noop"}

if __name__ == "__main__":
    app.run()
```

```tools.py
from strands import tool
import asyncio
import boto3
import json
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import httpx
from typing import Optional

# EventBridge Scheduler クライアントの初期化
scheduler_client = boto3.client('scheduler')


def _parse_relative_time(relative_str: str) -> timedelta:
    """'+30m', '+2h', '+1d' 形式の相対時間をパース

    Args:
        relative_str: 相対時間文字列 (例: '+30m', '+2h', '+1d')

    Returns:
        timedelta オブジェクト
    """
    match = re.match(r'\+(\d+)([mhd])', relative_str.lower())
    if not match:
        raise ValueError(f"Invalid relative time format: {relative_str}. Use '+30m', '+2h', '+1d' etc.")

    value = int(match.group(1))
    unit = match.group(2)

    if unit == 'm':
        return timedelta(minutes=value)
    elif unit == 'h':
        return timedelta(hours=value)
    elif unit == 'd':
        return timedelta(days=value)
    else:
        raise ValueError(f"Unknown time unit: {unit}")


def _update_schedule_sync(next_datetime: datetime, timezone: str, next_input: str = None) -> dict:
    """get_schedule → update_schedule を同期的に実行

    Args:
        next_datetime: 次回実行日時
        timezone: タイムゾーン
        next_input: 次回実行時のエージェントへの入力（省略時は変更なし）

    Returns:
        更新結果の辞書
    """
    schedule_name = os.environ.get("SCHEDULE_NAME")
    group_name = os.environ.get("SCHEDULE_GROUP_NAME", "default")

    if not schedule_name:
        raise ValueError("SCHEDULE_NAME environment variable is not set")

    # 既存のスケジュール設定を取得
    existing = scheduler_client.get_schedule(
        Name=schedule_name,
        GroupName=group_name
    )

    # at() 形式でスケジュール式を作成
    at_expression = f"at({next_datetime.strftime('%Y-%m-%dT%H:%M:%S')})"

    # Target をコピーして更新
    target = existing['Target'].copy()

    # next_input が指定されている場合、Target.Input 内の Payload.input を更新
    if next_input is not None:
        # Target.Input は二重にJSON化されている構造:
        # { "AgentRuntimeArn": "...", "Payload": "{\"action\":\"start\",\"input\":\"...\"}" }
        original_input = json.loads(target['Input'])
        payload = json.loads(original_input['Payload'])
        payload['input'] = next_input
        original_input['Payload'] = json.dumps(payload, ensure_ascii=False)
        target['Input'] = json.dumps(original_input, ensure_ascii=False)

    # 更新パラメータを構築（既存設定を保持）
    update_params = {
        'Name': schedule_name,
        'GroupName': group_name,
        'ScheduleExpression': at_expression,
        'ScheduleExpressionTimezone': timezone,
        'FlexibleTimeWindow': existing['FlexibleTimeWindow'],
        'Target': target,
    }

    # オプションフィールドを保持
    optional_fields = ['Description', 'EndDate', 'StartDate', 'State', 'KmsKeyArn', 'ActionAfterCompletion']
    for field in optional_fields:
        if field in existing and existing[field] is not None:
            update_params[field] = existing[field]

    # スケジュールを更新
    response = scheduler_client.update_schedule(**update_params)

    return {
        'schedule_arn': response['ScheduleArn'],
        'new_expression': at_expression,
        'timezone': timezone,
        'schedule_name': schedule_name,
        'group_name': group_name,
        'next_input': next_input
    }

@tool
async def http_get(url: str, timeout_sec: int = 10, max_bytes: int = 50_000) -> str:
    """Fetch text from a URL. Use for retrieving web pages or JSON APIs.
    Args:
        url: Target URL (http/https)
        timeout_sec: Request timeout seconds
        max_bytes: Max bytes to read to avoid huge payloads (default 50KB)
    Returns:
        Response text (truncated to max_bytes)
    """
    async with httpx.AsyncClient(timeout=timeout_sec, follow_redirects=True, headers={
        "User-Agent": "AgentCore-Strands-MVP/1.0"
    }) as client:
        r = await client.get(url)
        r.raise_for_status()
        content = r.text
        if len(content) > max_bytes:
            content = content[:max_bytes] + "\n...[truncated]..."
        return content

@tool
async def sleep_seconds(seconds: int = 3) -> str:
    """Sleep for N seconds, then report how long we slept."""
    await asyncio.sleep(max(0, int(seconds)))
    return f"Slept {seconds} seconds"

@tool
def current_time(tz: str = "Asia/Tokyo") -> str:
    """Return the current time in ISO8601 for the given timezone."""
    return datetime.now(ZoneInfo(tz)).isoformat()


@tool
async def update_next_schedule(
    next_execution: str,
    next_input: str = None,
    timezone: str = "Asia/Tokyo"
) -> str:
    """Update the EventBridge Scheduler to set the next execution time and input for this agent.
    Use this to schedule when this agent should run next and what instruction it should receive.

    Args:
        next_execution: Next execution time. Accepts either:
            - ISO8601 datetime string (e.g., "2025-12-27T10:30:00")
            - Relative time like "+30m" (30 minutes), "+2h" (2 hours), "+1d" (1 day)
        next_input: Instruction/input for the next execution (optional).
            Use this to tell your future self what to do next time.
            Example: "This is execution #2. Fetch the latest AWS news."
        timezone: IANA timezone for the schedule expression (default: Asia/Tokyo)

    Returns:
        Confirmation message with the updated schedule details
    """
    try:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)

        # next_execution をパース（ISO8601形式または相対形式）
        if next_execution.startswith('+'):
            delta = _parse_relative_time(next_execution)
            next_dt = now + delta
        else:
            # ISO8601形式としてパース
            next_dt = datetime.fromisoformat(next_execution)
            if next_dt.tzinfo is None:
                next_dt = next_dt.replace(tzinfo=tz)

        # 検証: 次回実行は未来でなければならない
        if next_dt <= now:
            return f"Error: Next execution time must be in the future. Provided: {next_dt.isoformat()}, Current: {now.isoformat()}"

        # スレッドプールで同期的なboto3呼び出しを実行
        result = await asyncio.to_thread(_update_schedule_sync, next_dt, timezone, next_input)

        response_parts = [
            "Schedule updated successfully!",
            f"- Schedule: {result['schedule_name']} (group: {result['group_name']})",
            f"- Next execution: {result['new_expression']}",
            f"- Timezone: {result['timezone']}",
        ]

        if result.get('next_input'):
            response_parts.append(f"- Next input: {result['next_input'][:100]}{'...' if len(result['next_input']) > 100 else ''}")

        response_parts.append(f"- ARN: {result['schedule_arn']}")

        return "\n".join(response_parts)

    except Exception as e:
        return f"Failed to update schedule: {str(e)}"
```