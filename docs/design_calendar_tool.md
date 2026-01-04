# Google Calendar Tool 設計書

## 1. 概要

目標管理エージェントアプリケーションにおける、Googleカレンダー操作ツールの設計書です。

### 1.1 要件

| 項目 | 内容 |
|------|------|
| 認証方式 | OAuth2（ユーザー認証）- AgentCore Identity使用 |
| 機能 | 予定取得のみ |
| 対象 | ユーザーの個人Googleカレンダー |
| スコープ | `https://www.googleapis.com/auth/calendar.readonly` |

### 1.2 参考リンク

- [Google Calendar API Overview](https://developers.google.com/workspace/calendar/api/guides/overview)
- [Google Calendar API サービスアカウント認証の参考記事](https://note.com/tori29umai/n/nec7934d7af68)

---

## 2. アーキテクチャ

### 2.1 コンポーネント構成図

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              フロントエンド                                    │
│                    (React + Vite / LINE Messaging API)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Amazon Bedrock AgentCore Runtime                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Goal Management Agent                            │   │
│  │                   (Strands Agents + Python)                          │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │  @requires_access_token(                                      │  │   │
│  │  │    provider_name="google-calendar-provider",                  │  │   │
│  │  │    scopes=["calendar.readonly"],                              │  │   │
│  │  │    auth_flow="USER_FEDERATION"                                │  │   │
│  │  │  )                                                            │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
        │                                        │
        │ (OAuth2 Token Management)              │ (MCP Protocol)
        ▼                                        ▼
┌────────────────────────┐           ┌─────────────────────────────────────────┐
│  AgentCore Identity    │           │         AgentCore Gateway               │
│  ┌──────────────────┐  │           │  ┌─────────────────────────────────┐   │
│  │  Token Vault     │  │           │  │  Lambda Target                  │   │
│  │  (Google OAuth2) │  │           │  │  - get_calendar_events tool    │   │
│  └──────────────────┘  │           │  └─────────────────────────────────┘   │
│  ┌──────────────────┐  │           └─────────────────────────────────────────┘
│  │  Credential      │  │                           │
│  │  Provider        │  │                           ▼
│  │  (Google OAuth2) │  │           ┌─────────────────────────────────────────┐
│  └──────────────────┘  │           │           AWS Lambda                    │
└────────────────────────┘           │  ┌─────────────────────────────────┐   │
        │                            │  │  Calendar Tool Function         │   │
        │                            │  │  - Google Calendar API Client   │   │
        ▼                            │  │  - events.list 呼び出し          │   │
┌────────────────────────┐           │  └─────────────────────────────────┘   │
│  Google OAuth2 Server  │           └─────────────────────────────────────────┘
│  (accounts.google.com) │                           │
└────────────────────────┘                           ▼
                                     ┌─────────────────────────────────────────┐
                                     │        Google Calendar API              │
                                     │  (www.googleapis.com/calendar/v3)       │
                                     └─────────────────────────────────────────┘
```

### 2.2 認証フロー（3-Legged OAuth）

```
┌──────┐      ┌─────────────┐      ┌──────────────┐      ┌────────────┐
│ User │      │   Agent     │      │  AgentCore   │      │   Google   │
│      │      │  (Runtime)  │      │  Identity    │      │  OAuth2    │
└──┬───┘      └──────┬──────┘      └──────┬───────┘      └─────┬──────┘
   │                 │                    │                    │
   │ 1. "今週の予定を教えて"              │                    │
   │────────────────>│                    │                    │
   │                 │                    │                    │
   │                 │ 2. トークン要求    │                    │
   │                 │───────────────────>│                    │
   │                 │                    │                    │
   │                 │ 3. トークンなし    │                    │
   │                 │   (認証URL返却)    │                    │
   │                 │<───────────────────│                    │
   │                 │                    │                    │
   │ 4. 認証URL表示  │                    │                    │
   │<────────────────│                    │                    │
   │                 │                    │                    │
   │ 5. ブラウザでログイン                │                    │
   │────────────────────────────────────────────────────────>│
   │                 │                    │                    │
   │                 │                    │ 6. コールバック    │
   │                 │                    │   (認証コード)     │
   │                 │                    │<───────────────────│
   │                 │                    │                    │
   │                 │                    │ 7. トークン取得    │
   │                 │                    │───────────────────>│
   │                 │                    │                    │
   │                 │                    │ 8. アクセストークン│
   │                 │                    │<───────────────────│
   │                 │                    │                    │
   │                 │                    │ 9. Token Vault保存 │
   │                 │                    │                    │
   │ 10. 再度リクエスト                   │                    │
   │────────────────>│                    │                    │
   │                 │                    │                    │
   │                 │ 11. トークン取得   │                    │
   │                 │───────────────────>│                    │
   │                 │                    │                    │
   │                 │ 12. アクセストークン                    │
   │                 │<───────────────────│                    │
   │                 │                    │                    │
   │                 │ 13. Gateway経由でLambda呼び出し        │
   │                 │                    │                    │
   │ 14. カレンダー予定一覧               │                    │
   │<────────────────│                    │                    │
```

---

## 3. コンポーネント設計

### 3.1 Lambda関数（カレンダーツール）

#### handler.py

```python
# lambda/calendar_tool/handler.py
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def get_calendar_events(
    access_token: str,
    time_min: Optional[str] = None,
    time_max: Optional[str] = None,
    max_results: int = 10,
    calendar_id: str = "primary"
) -> Dict[str, Any]:
    """
    Google Calendar から予定を取得する

    Args:
        access_token: Google OAuth2 アクセストークン
        time_min: 取得開始日時 (RFC3339形式、省略時は現在時刻)
        time_max: 取得終了日時 (RFC3339形式、省略時はtime_minから7日後)
        max_results: 最大取得件数 (デフォルト10、最大2500)
        calendar_id: カレンダーID (デフォルト "primary")

    Returns:
        イベント一覧を含む辞書
    """
    try:
        # 認証情報を構築
        credentials = Credentials(token=access_token)

        # Calendar API クライアントを構築
        service = build('calendar', 'v3', credentials=credentials)

        # デフォルト時間範囲を設定
        if not time_min:
            time_min = datetime.utcnow().isoformat() + 'Z'
        if not time_max:
            time_max = (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'

        # イベントを取得
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()

        events = events_result.get('items', [])

        # レスポンスを整形
        formatted_events = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))

            formatted_events.append({
                'id': event.get('id'),
                'summary': event.get('summary', '(無題)'),
                'description': event.get('description', ''),
                'start': start,
                'end': end,
                'location': event.get('location', ''),
                'status': event.get('status', 'confirmed'),
                'html_link': event.get('htmlLink', '')
            })

        return {
            'success': True,
            'events': formatted_events,
            'count': len(formatted_events),
            'time_range': {
                'from': time_min,
                'to': time_max
            }
        }

    except HttpError as error:
        logger.error(f"Google Calendar API error: {error}")
        return {
            'success': False,
            'error': f"Calendar API error: {error.resp.status}",
            'message': str(error)
        }
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {
            'success': False,
            'error': 'Internal error',
            'message': str(e)
        }


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Lambda ハンドラー - MCP Gateway からの呼び出しを処理

    Expected event format (from MCP Gateway):
    {
        "tool_name": "get_calendar_events",
        "arguments": {
            "access_token": "...",
            "time_min": "...",
            "time_max": "...",
            "max_results": 10,
            "calendar_id": "primary"
        }
    }
    """
    logger.info(f"Received event: {json.dumps(event, default=str)}")

    tool_name = event.get('tool_name', event.get('name', ''))
    arguments = event.get('arguments', event.get('input', {}))

    if tool_name == 'get_calendar_events':
        result = get_calendar_events(
            access_token=arguments.get('access_token'),
            time_min=arguments.get('time_min'),
            time_max=arguments.get('time_max'),
            max_results=arguments.get('max_results', 10),
            calendar_id=arguments.get('calendar_id', 'primary')
        )
        return {
            'statusCode': 200,
            'body': json.dumps(result, ensure_ascii=False, default=str)
        }

    return {
        'statusCode': 400,
        'body': json.dumps({
            'success': False,
            'error': 'Unknown tool',
            'message': f"Tool '{tool_name}' not found"
        })
    }
```

#### requirements.txt

```
google-api-python-client>=2.100.0
google-auth>=2.20.0
google-auth-httplib2>=0.1.0
google-auth-oauthlib>=1.0.0
```

### 3.2 AgentCore Gateway設定

#### ツール定義（MCP Gateway用）

```python
lambda_config = {
    "arn": "arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:CalendarToolFunction",
    "tools": [
        {
            "name": "get_calendar_events",
            "description": "ユーザーのGoogleカレンダーから予定を取得します。指定した期間内のイベント一覧を返します。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "access_token": {
                        "type": "string",
                        "description": "Google OAuth2 アクセストークン"
                    },
                    "time_min": {
                        "type": "string",
                        "description": "取得開始日時 (RFC3339形式、例: 2025-01-01T00:00:00Z)。省略時は現在時刻"
                    },
                    "time_max": {
                        "type": "string",
                        "description": "取得終了日時 (RFC3339形式)。省略時はtime_minから7日後"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "最大取得件数 (デフォルト10、最大2500)"
                    },
                    "calendar_id": {
                        "type": "string",
                        "description": "カレンダーID。省略時は 'primary' (メインカレンダー)"
                    }
                },
                "required": ["access_token"]
            }
        }
    ]
}
```

#### Gateway作成コマンド

```bash
# 1. MCP Gateway を作成
agentcore gateway create-mcp-gateway \
    --name goal-management-calendar-gateway \
    --region ap-northeast-1

# 2. Lambda Target を追加
agentcore gateway create-mcp-gateway-target \
    --gateway-arn <gateway-arn> \
    --gateway-url <gateway-url> \
    --role-arn <execution-role-arn> \
    --name CalendarToolTarget \
    --target-type lambda
```

### 3.3 AgentCore Identity設定（Google OAuth2）

#### Credential Provider作成

```bash
# Google OAuth2 Credential Provider を作成
aws bedrock-agentcore-control create-oauth2-credential-provider \
    --name "google-calendar-provider" \
    --credential-provider-vendor "GoogleOauth2" \
    --oauth2-provider-config-input '{
        "googleOauth2ProviderConfig": {
            "clientId": "'$GOOGLE_CLIENT_ID'",
            "clientSecret": "'$GOOGLE_CLIENT_SECRET'"
        }
    }' \
    --region ap-northeast-1
```

#### エージェント側でのトークン取得

```python
# agent/calendar_agent.py
from bedrock_agentcore.identity import requires_access_token
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models.bedrock import BedrockModel

app = BedrockAgentCoreApp()

# Google Calendar API用スコープ
GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

async def handle_auth_url(url: str):
    """認証URLをユーザーに返す"""
    yield f"Googleカレンダーへのアクセス許可が必要です。以下のURLを開いてログインしてください:\n{url}"

@requires_access_token(
    provider_name="google-calendar-provider",
    scopes=GOOGLE_CALENDAR_SCOPES,
    auth_flow="USER_FEDERATION",
    on_auth_url=handle_auth_url,
    force_authentication=False
)
async def get_calendar_events_with_auth(
    time_min: str = None,
    time_max: str = None,
    max_results: int = 10,
    *,
    access_token: str  # デコレータによって注入される
):
    """
    認証付きでカレンダーイベントを取得
    """
    # Gateway経由でLambdaを呼び出す
    # ...
    pass
```

---

## 4. ディレクトリ構造

実装時に作成するファイル一覧:

```
goal-management-app/
├── docs/
│   ├── design_calendar_tool.md      # この設計書
│   ├── design_reminder.md
│   └── requirements.md
├── agent/                            # AgentCore Runtime にデプロイ
│   ├── main.py                       # エージェントエントリーポイント
│   ├── tools/
│   │   ├── __init__.py
│   │   └── calendar_tool.py          # カレンダーツール呼び出し
│   └── requirements.txt
├── lambda/                           # Lambda関数
│   └── calendar_tool/
│       ├── handler.py                # Lambdaハンドラー
│       └── requirements.txt
├── infra/                            # CDKインフラ
│   ├── lib/
│   │   ├── lambda-stack.ts           # Lambda定義
│   │   ├── gateway-stack.ts          # Gateway定義（手動作成の場合は不要）
│   │   └── identity-stack.ts         # Identity設定
│   ├── bin/
│   │   └── app.ts
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
└── scripts/
    ├── setup_google_oauth.sh         # Google OAuth設定スクリプト
    ├── deploy_lambda.sh              # Lambdaデプロイスクリプト
    └── deploy_agent.sh               # エージェントデプロイスクリプト
```

---

## 5. Google Cloud Console設定手順

### 5.1 OAuth2クライアント作成手順

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/

2. **新規プロジェクト作成または既存プロジェクト選択**

3. **Google Calendar API を有効化**
   - APIs & Services > Library > "Google Calendar API" を検索 > Enable

4. **OAuth同意画面の設定**
   - APIs & Services > OAuth consent screen
   - User Type: External (テスト用) または Internal (組織内)
   - 必要情報を入力:
     - App name: Goal Management App
     - User support email: your-email@example.com
     - Developer contact: your-email@example.com

5. **スコープの追加**
   - Add or Remove Scopes をクリック
   - `https://www.googleapis.com/auth/calendar.readonly` を選択

6. **テストユーザーの追加** (External の場合)
   - テストユーザーのGmailアドレスを追加

7. **OAuth2クライアントIDの作成**
   - APIs & Services > Credentials > Create Credentials > OAuth client ID
   - Application type: Web application
   - Name: Goal Management Calendar Tool
   - Authorized redirect URIs:
     - `https://bedrock-agentcore.ap-northeast-1.amazonaws.com/identities/oauth2/callback`
     - (AgentCore Identity の callback URL)

8. **クライアントID/シークレットを保存**
   - Client ID と Client Secret をメモ

### 5.2 必要なスコープ

| スコープ | 説明 | 用途 |
|---------|------|------|
| `https://www.googleapis.com/auth/calendar.readonly` | カレンダーの読み取り専用アクセス | 予定の取得 |

---

## 6. デプロイ手順

### Step 1: 前提条件の確認

```bash
# AWS CLI設定確認
aws sts get-caller-identity

# AgentCore CLI インストール
pip install bedrock-agentcore-starter-toolkit

# CDK インストール
npm install -g aws-cdk
```

### Step 2: Google OAuth設定

```bash
# シークレットをSecrets Managerに保存
aws secretsmanager create-secret \
    --name "goal-management/google-oauth" \
    --secret-string '{
        "client_id": "<GOOGLE_CLIENT_ID>",
        "client_secret": "<GOOGLE_CLIENT_SECRET>"
    }' \
    --region ap-northeast-1
```

### Step 3: Lambda関数のデプロイ

```bash
cd infra
npm install

# CDK Bootstrap (初回のみ)
cdk bootstrap

# Lambda Stackをデプロイ
cdk deploy CalendarLambdaStack
```

### Step 4: AgentCore Identity設定

```bash
# Credential Provider を作成
aws bedrock-agentcore-control create-oauth2-credential-provider \
    --name "google-calendar-provider" \
    --credential-provider-vendor "GoogleOauth2" \
    --oauth2-provider-config-input '{
        "googleOauth2ProviderConfig": {
            "clientId": "'$(aws secretsmanager get-secret-value --secret-id goal-management/google-oauth --query SecretString --output text | jq -r .client_id)'",
            "clientSecret": "'$(aws secretsmanager get-secret-value --secret-id goal-management/google-oauth --query SecretString --output text | jq -r .client_secret)'"
        }
    }' \
    --region ap-northeast-1
```

### Step 5: MCP Gatewayの作成

```bash
# Gateway作成
agentcore gateway create-mcp-gateway \
    --name goal-management-calendar-gateway \
    --region ap-northeast-1

# 出力されたGateway ARN, URL, Role ARNをメモ

# Lambda Targetを追加
agentcore gateway create-mcp-gateway-target \
    --gateway-arn <GATEWAY_ARN> \
    --gateway-url <GATEWAY_URL> \
    --role-arn <ROLE_ARN> \
    --name CalendarTool \
    --target-type lambda \
    --region ap-northeast-1
```

### Step 6: エージェントのデプロイ

```bash
cd agent

# 設定
agentcore configure -e main.py --region ap-northeast-1

# デプロイ
agentcore launch

# テスト
agentcore invoke '{"prompt": "今週の予定を教えて"}' \
    --user-id "test-user-001" \
    --session-id "test-session-$(date +%s)"
```

---

## 7. 環境変数・シークレット管理

| 環境変数/シークレット | 説明 | 保存場所 |
|----------------------|------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 クライアントID | Secrets Manager |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 クライアントシークレット | Secrets Manager / AgentCore Identity |
| `AGENTCORE_GATEWAY_URL` | MCP Gateway URL | 環境変数 |
| `AGENTCORE_GATEWAY_CLIENT_ID` | Gateway認証用クライアントID | 環境変数 |
| `AGENTCORE_GATEWAY_CLIENT_SECRET` | Gateway認証用シークレット | Secrets Manager |

---

## 8. CDKインフラ設計

### Lambda Stack

```typescript
// infra/lib/lambda-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class CalendarLambdaStack extends cdk.Stack {
  public readonly calendarFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda Layer for Python dependencies
    const dependenciesLayer = new lambda.LayerVersion(this, 'CalendarDepsLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/calendar_tool/layer')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Google API client dependencies',
    });

    // Calendar Tool Lambda Function
    this.calendarFunction = new lambda.Function(this, 'CalendarToolFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      functionName: 'CalendarToolFunction',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/calendar_tool')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      layers: [dependenciesLayer],
      architecture: lambda.Architecture.ARM_64,
      environment: {
        LOG_LEVEL: 'INFO',
      },
    });

    // AgentCore Gateway からの呼び出しを許可
    this.calendarFunction.addPermission('AllowAgentCoreGateway', {
      principal: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    // Output: Lambda ARN
    new cdk.CfnOutput(this, 'CalendarFunctionArn', {
      value: this.calendarFunction.functionArn,
      description: 'Calendar Tool Lambda ARN',
    });
  }
}
```

---

## 9. セキュリティ考慮事項

1. **最小権限の原則**: `calendar.readonly` スコープのみ使用
2. **トークンの安全な管理**: AgentCore Identity Token Vault で管理
3. **Lambda IAMロール**: 必要最小限の権限のみ付与
4. **シークレット管理**: Secrets Manager使用、ハードコーディング禁止
5. **監査ログ**: CloudWatch Logs, CloudTrail で操作ログを記録

---

## 10. 将来の拡張計画

| 機能 | 優先度 | 説明 |
|------|-------|------|
| 予定の作成 | 中 | events.insert API の実装 |
| 予定の更新 | 中 | events.update API の実装 |
| 予定の削除 | 低 | events.delete API の実装 |
| 複数カレンダー対応 | 低 | calendarList.list で取得可能 |
| リマインダー連携 | 高 | 目標と予定の自動マッピング |
