# 目標管理エージェントアプリケーション 設計書

## 1. システム概要

### 1.1 目的・背景

本アプリケーションは、ユーザーが自然言語で目標を設定し、AIエージェントの支援を受けながら目標達成を管理するためのシステムです。

**主な特徴:**
- 自然言語による目標設定（粒度が粗い場合はエージェントが詳細化を支援）
- GitHub/Qiita/connpass等からの進捗自動収集
- LINE経由でのリマインド通知
- Googleカレンダー連携

### 1.2 主要機能一覧

| 機能カテゴリ | 機能名 | 説明 | MVP |
|-------------|--------|------|-----|
| メイン機能 | 目標設定 | チャットで目標を自然言語入力、エージェントが詳細化支援 | Yes |
| メイン機能 | ダッシュボード | 目標一覧と進捗をビジュアル表示 | Yes |
| メイン機能 | ToDoリスト | 日次のタスク管理、エージェントが提案 | Yes |
| メイン機能 | 進捗収集 | GitHub/Qiita/connpass等から自動収集＋手動入力 | Yes |
| メイン機能 | カレンダー連携 | Googleカレンダーへの目標期限登録 | Yes |
| リマインダー機能 | LINE通知 | 進捗状況に応じたリマインド送信 | Yes |
| リマインダー機能 | LINEチャット | LINE経由での簡易的な進捗報告 | Yes（簡易版） |

### 1.3 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React + Vite + TypeScript |
| ホスティング | AWS Amplify Gen2 |
| 認証 | Amazon Cognito |
| API | Amazon API Gateway + AWS Lambda |
| データベース | Amazon Aurora DSQL |
| エージェント基盤 | Amazon Bedrock AgentCore Runtime |
| エージェントフレームワーク | Strands Agents |
| 外部認証連携 | AgentCore Identity |
| API統合 | AgentCore Gateway |
| スケジュール実行 | Amazon EventBridge Scheduler |
| 通知 | LINE Messaging API |

---

## 2. アーキテクチャ

### 2.1 全体構成図

詳細は [architecture.png](architecture.png) を参照。

### 2.2 メイン機能の構成

```
利用者
  │
  ├─[ダッシュボードで目標一覧表示]
  │    │
  │    ▼
  │  Amplify (Dashboard & ChatUI)
  │    │
  │    ▼
  │  API Gateway → Lambda → Aurora DSQL
  │                           ↑
  │                    DSQL MCPサーバー
  │
  └─[チャットで目標設定]
       │
       ▼
     AgentCore Runtime
     (Strands Agents - 目標設定エージェント)
       │
       ├─→ AgentCore Identity → Cognito
       │
       ├─→ AgentCore Gateway → Lambda → Google Calendar
       │
       └─→ AgentCore Memory
```

**処理フロー:**
1. ユーザーがチャット画面で目標を入力
2. 目標設定エージェントが目標の粒度を分析
3. 粒度が粗い場合、質問テンプレートで詳細化
4. 詳細化された目標・マイルストーンをAurora DSQLに保存
5. 必要に応じてGoogleカレンダーに期限を登録

### 2.3 リマインダー機能の構成

```
EventBridge Scheduler
  │
  ▼
AgentCore Runtime
(Strands Agents - リマインダーエージェント)
  │
  ├─→ AgentCore Identity → Cognito
  │
  ├─→ AgentCore Gateway
  │     ├─→ GitHub MCPサーバー
  │     ├─→ Tavily MCPサーバー
  │     └─→ connpass API Tool
  │
  └─→ LINE Bot MCPサーバー → 利用者
```

**処理フロー:**
1. EventBridge Schedulerが定期実行をトリガー
2. リマインダーエージェントがユーザーの目標・進捗を取得
3. GitHub/Qiita/connpass等から最新の活動を収集
4. 進捗状況を分析し、リマインドメッセージを生成
5. LINE経由でユーザーに通知
6. 次回リマインドスケジュールを更新

---

## 3. コンポーネント設計

### 3.1 フロントエンド（Amplify + React + Vite）

#### 画面構成

| 画面 | パス | 説明 |
|------|------|------|
| ダッシュボード | `/` | 目標カード一覧、進捗バー、今日のToDo、週間サマリー |
| チャット | `/chat` | エージェントとの対話UI、目標設定ウィザード |
| 目標詳細 | `/goals/:id` | マイルストーン一覧、進捗グラフ、評価指標の推移 |
| 設定 | `/settings` | 外部サービス連携、リマインド設定 |

#### 主要コンポーネント

```
src/
├── components/
│   ├── dashboard/
│   │   ├── GoalCard.tsx        # 目標カード（進捗バー付き）
│   │   ├── TodoList.tsx        # 今日のToDoリスト
│   │   └── WeeklySummary.tsx   # 週間サマリー
│   ├── chat/
│   │   ├── ChatWindow.tsx      # チャットUI
│   │   └── MessageBubble.tsx   # メッセージ表示
│   └── goals/
│       ├── MilestoneList.tsx   # マイルストーン一覧
│       └── ProgressChart.tsx   # 進捗グラフ
├── pages/
│   ├── Dashboard.tsx
│   ├── Chat.tsx
│   ├── GoalDetail.tsx
│   └── Settings.tsx
└── lib/
    ├── api.ts                  # API呼び出し
    └── auth.ts                 # 認証ユーティリティ
```

### 3.2 バックエンド API（API Gateway + Lambda）

Cognito User Pool Authorizerで保護されたREST API。

詳細は「5. API設計」を参照。

### 3.3 エージェント（AgentCore Runtime + Strands Agents）

#### 目標設定エージェント

**役割:** 目標の設定・詳細化を支援

**ツール構成:**
| ツール名 | 説明 |
|---------|------|
| dsql_query | Aurora DSQLへのクエリ実行 |
| calendar_tool | Googleカレンダー操作（詳細は [design_calendar_tool.md](design_calendar_tool.md) 参照） |
| clarify_goal | 目標の粒度確認・詳細化 |

**システムプロンプト概要:**
- ユーザーの目標を理解し、具体的なマイルストーンに分解
- 粒度が粗い場合は質問テンプレートで詳細化
- 測定可能な評価指標を提案

#### リマインダーエージェント

**役割:** 定期的な進捗確認とリマインド送信

**ツール構成:**
| ツール名 | 説明 |
|---------|------|
| line_notify | LINE通知送信 |
| github_commits | GitHubコミット履歴取得 |
| qiita_posts | Qiita投稿取得 |
| connpass_events | connpass登壇履歴取得 |
| update_next_schedule | 次回リマインドスケジュール更新 |

詳細は [design_reminder.md](design_reminder.md) 参照。

### 3.4 外部連携

| サービス | 用途 | 認証方式 |
|---------|------|---------|
| Google Calendar | 目標期限の登録・取得 | OAuth2（AgentCore Identity） |
| LINE Messaging API | リマインド通知送信 | Channel Access Token |
| GitHub API | コミット履歴収集 | Personal Access Token or OAuth2 |
| Qiita API | 投稿記事数収集 | APIトークン |
| connpass API | 登壇履歴収集 | 認証不要（公開API） |

---

## 4. データベース設計

### 4.1 概要

- **データベース:** Amazon Aurora DSQL（PostgreSQL互換）
- **接続方式:** IAM認証 + Aurora DSQL Connector
- **スキーマ:** カスタムスキーマ（`app_schema`）を使用

#### Aurora DSQL特有の制限事項

| 制限事項 | 対処法 |
|---------|--------|
| JSON/JSONB型非サポート | TEXT型で保存、アプリケーション層でパース |
| `CREATE INDEX`非対応 | `CREATE INDEX ASYNC`を使用（非同期インデックス作成） |
| PL/pgSQL非対応 | トリガー等はアプリケーション層で実装 |
| `public`スキーマ権限制限 | カスタムスキーマ（`app_schema`）を使用 |
| 外部キー制約非サポート | アプリケーション層で整合性管理 |

#### 認証とロールの使い分け

Aurora DSQLは2種類のデータベースロールを持ち、用途に応じて使い分けます。

| ロール | 用途 | トークン生成コマンド | IAMアクション |
|-------|------|---------------------|---------------|
| admin | DDL操作（テーブル作成、スキーマ変更等） | `generate-db-connect-admin-auth-token` | `dsql:DbConnectAdmin` |
| app_user | DML操作（アプリケーション接続） | `generate-db-connect-auth-token` | `dsql:DbConnect` |

**運用方針:**
- 初期セットアップ・マイグレーション: `admin`ロールを使用
- Lambda/AgentCoreからの接続: `app_user`ロールを使用
- IAMロールとデータベースロールは `GRANT` 文でマッピング

### 4.2 ER図（概念）

```
users 1──* goals 1──* milestones 1──* metrics
  │          │            │
  │          │            └──* todos
  │          │
  │          └──* reminder_schedules
  │
  └──1 (Cognito sub で紐付け)
```

### 4.3 テーブル定義

#### スキーマ作成

```sql
-- カスタムスキーマの作成（adminロールで実行）
CREATE SCHEMA IF NOT EXISTS app_schema;

-- app_userロールへの権限付与
GRANT USAGE ON SCHEMA app_schema TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_schema TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_schema
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```

#### users（ユーザー情報）

外部サービス連携用の情報を保持。認証情報はCognitoで管理。

```sql
CREATE TABLE app_schema.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub TEXT UNIQUE NOT NULL,
  line_user_id TEXT,
  github_username TEXT,
  qiita_username TEXT,
  connpass_nickname TEXT,
  reminder_time TIME DEFAULT '09:00',
  timezone TEXT DEFAULT 'Asia/Tokyo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC users_cognito_sub ON app_schema.users(cognito_sub);
```

#### goals（目標）

```sql
CREATE TABLE app_schema.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_sub TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC goals_owner_status ON app_schema.goals(owner_sub, status);
CREATE INDEX ASYNC goals_owner_due ON app_schema.goals(owner_sub, due_date);
```

**status値:** `active`, `completed`, `archived`

#### milestones（マイルストーン）

```sql
CREATE TABLE app_schema.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL,  -- goals.id への参照（アプリ層で整合性管理）
  title TEXT NOT NULL,
  frequency TEXT,
  target_count INT,
  current_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC milestones_goal ON app_schema.milestones(goal_id);
```

**frequency値:** `daily`, `weekly`, `monthly`, `yearly`, `once`

> **注意:** Aurora DSQLは外部キー制約をサポートしないため、`goal_id`の整合性はアプリケーション層で管理します。目標削除時は関連するマイルストーンも削除するトランザクション処理を実装してください。

#### metrics（評価指標）

```sql
CREATE TABLE app_schema.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL,  -- milestones.id への参照（アプリ層で整合性管理）
  metric_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  value NUMERIC NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC metrics_milestone_type ON app_schema.metrics(milestone_id, metric_type);
CREATE INDEX ASYNC metrics_measured_at ON app_schema.metrics(measured_at);
```

**metric_type値:** `qiita_posts`, `github_commits`, `connpass_talks`, `manual`, `other`
**source値:** `auto`, `manual`

#### todos（ToDoリスト）

```sql
CREATE TABLE app_schema.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_sub TEXT NOT NULL,
  goal_id UUID,       -- goals.id への参照（アプリ層で整合性管理、NULL許容）
  milestone_id UUID,  -- milestones.id への参照（アプリ層で整合性管理、NULL許容）
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC todos_owner_status ON app_schema.todos(owner_sub, status);
CREATE INDEX ASYNC todos_owner_due ON app_schema.todos(owner_sub, due_date);
```

**status値:** `pending`, `in_progress`, `completed`

#### reminder_schedules（リマインダースケジュール）

```sql
CREATE TABLE app_schema.reminder_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_sub TEXT NOT NULL,
  goal_id UUID,  -- goals.id への参照（アプリ層で整合性管理、NULL許容）
  schedule_expression TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'line',
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC reminder_owner_status ON app_schema.reminder_schedules(owner_sub, status);
```

**notification_type値:** `line`, `push`

---

## 5. API設計

### 5.1 認証方式

- **認証:** Cognito User Pool Authorizer
- **認可:** JWTの`sub`クレームでユーザー識別、サーバー側で`owner_sub`を決定

### 5.2 エンドポイント一覧

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | /goals | 目標一覧取得 | 必須 |
| POST | /goals | 目標作成 | 必須 |
| GET | /goals/{id} | 目標詳細取得 | 必須 |
| PUT | /goals/{id} | 目標更新 | 必須 |
| DELETE | /goals/{id} | 目標削除 | 必須 |
| GET | /goals/{id}/milestones | マイルストーン一覧 | 必須 |
| POST | /goals/{id}/milestones | マイルストーン作成 | 必須 |
| PUT | /milestones/{id} | マイルストーン更新 | 必須 |
| GET | /todos | ToDoリスト取得（クエリ: date, status） | 必須 |
| POST | /todos | ToDo作成 | 必須 |
| PUT | /todos/{id} | ToDo更新 | 必須 |
| DELETE | /todos/{id} | ToDo削除 | 必須 |
| POST | /chat | エージェントとチャット | 必須 |
| POST | /metrics/collect | 進捗自動収集トリガー | 必須 |
| GET | /users/me | ユーザー情報取得 | 必須 |
| PUT | /users/me | ユーザー情報更新 | 必須 |

### 5.3 リクエスト/レスポンス例

#### POST /goals
```json
// Request
{
  "title": "今年はアウトプット増やす",
  "description": "技術ブログと登壇を増やしたい",
  "due_date": "2025-12-31"
}

// Response
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "今年はアウトプット増やす",
  "description": "技術ブログと登壇を増やしたい",
  "due_date": "2025-12-31",
  "status": "active",
  "created_at": "2025-01-04T10:00:00Z"
}
```

#### POST /chat
```json
// Request
{
  "message": "今年はアウトプット増やしたい",
  "session_id": "chat-session-123"
}

// Response (Streaming)
{
  "type": "message",
  "content": "素晴らしい目標ですね！...",
  "actions": [
    {
      "type": "create_goal",
      "data": { "title": "...", "milestones": [...] }
    }
  ]
}
```

---

## 6. 認証・認可

### 6.1 ユーザー認証（Cognito）

- **認証方式:** Cognito User Pool
- **サインイン方法:** メール + パスワード（将来的にGoogleログイン追加可能）
- **トークン:** ID Token（JWT）をAuthorization ヘッダーで送信

### 6.2 外部サービス連携（AgentCore Identity）

OAuth2が必要なサービス（Google Calendar等）はAgentCore Identityで管理。

**設定済みProvider:**
| Provider名 | サービス | スコープ |
|------------|---------|---------|
| google-calendar-provider | Google Calendar | `calendar.readonly` |

詳細は [design_calendar_tool.md](design_calendar_tool.md) 参照。

### 6.3 認可ルール

- 全てのAPIはCognito認証必須
- ユーザーは自身の`owner_sub`に紐づくデータのみアクセス可能
- サーバー側でJWTの`sub`を使用して`owner_sub`を決定（クライアントからの指定不可）

### 6.4 Aurora DSQLリソースベースポリシー

Aurora DSQLクラスターにリソースベースポリシーをアタッチし、特定のIAMロールのみがアクセスできるよう制限します。

#### 本番環境向けポリシー（特定IAMロールのみ許可）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAccessExceptSpecificRoles",
      "Effect": "Deny",
      "Principal": {
        "AWS": "*"
      },
      "Action": [
        "dsql:DbConnect",
        "dsql:DbConnectAdmin"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": [
            "arn:aws:iam::ACCOUNT_ID:role/goal-management-lambda-role",
            "arn:aws:iam::ACCOUNT_ID:role/goal-management-agentcore-role"
          ]
        }
      }
    }
  ]
}
```

> **注意:** `ACCOUNT_ID`は実際のAWSアカウントIDに置き換えてください。

#### CLIでのポリシー設定

```bash
# 現在のポリシーを確認
aws dsql get-cluster-policy --identifier <cluster-id>

# クラスター作成時にポリシーを設定
aws dsql create-cluster \
  --resource-policy file://dsql-resource-policy.json \
  --region ap-northeast-1

# 既存クラスターへのポリシー追加
aws dsql put-cluster-policy \
  --identifier <cluster-id> \
  --policy file://dsql-resource-policy.json
```

#### 認証・認可レイヤーの整理

| レイヤー | 用途 | 設定場所 |
|---------|------|---------|
| アイデンティティベースポリシー | IAMロールへの`dsql:DbConnect`等の権限付与 | IAMポリシー |
| **リソースベースポリシー** | クラスターへのアクセス元制限 | Aurora DSQLクラスター |
| データベースロール | DB内の操作権限（DDL/DML） | Aurora DSQL内 |

---

## 7. ディレクトリ構成

```
goal-management-app/
├── docs/                           # ドキュメント
│   ├── requirements.md             # 要件定義書
│   ├── design.md                   # 全体設計書（本書）
│   ├── design_calendar_tool.md     # Google Calendar Tool設計書
│   ├── design_reminder.md          # リマインダー機能設計書
│   ├── research_amplify_dsql.md    # 調査メモ
│   └── architecture.png            # アーキテクチャ図
│
├── frontend/                       # フロントエンド（React + Vite）
│   ├── src/
│   │   ├── components/             # Reactコンポーネント
│   │   ├── pages/                  # ページコンポーネント
│   │   ├── lib/                    # ユーティリティ
│   │   └── App.tsx
│   ├── amplify/                    # Amplify Gen2 設定
│   │   ├── auth/
│   │   ├── data/
│   │   └── backend.ts
│   ├── package.json
│   └── vite.config.ts
│
├── agent/                          # エージェント（AgentCore Runtime）
│   ├── goal_agent/                 # 目標設定エージェント
│   │   ├── main.py
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── dsql_tool.py
│   │   │   └── calendar_tool.py
│   │   └── requirements.txt
│   └── reminder_agent/             # リマインダーエージェント
│       ├── main.py
│       ├── tools/
│       │   ├── __init__.py
│       │   ├── line_tool.py
│       │   ├── github_tool.py
│       │   ├── qiita_tool.py
│       │   └── connpass_tool.py
│       └── requirements.txt
│
├── lambda/                         # Lambda関数
│   ├── api/                        # REST API用
│   │   ├── goals/
│   │   ├── todos/
│   │   └── users/
│   └── calendar_tool/              # Google Calendar用
│       ├── handler.py
│       └── requirements.txt
│
├── infra/                          # CDK インフラ
│   ├── lib/
│   │   ├── api-stack.ts
│   │   ├── lambda-stack.ts
│   │   └── database-stack.ts
│   ├── bin/
│   │   └── app.ts
│   ├── cdk.json
│   └── package.json
│
└── scripts/                        # デプロイ・運用スクリプト
    ├── setup_google_oauth.sh
    ├── deploy_lambda.sh
    └── deploy_agent.sh
```

---

## 8. 開発フェーズ

### Phase 1: 基盤構築

**目標:** 認証付きの基本的なCRUD機能

- [ ] Amplify Gen2 プロジェクト初期化
- [ ] Cognito User Pool 設定
- [ ] Aurora DSQL クラスター作成
- [ ] 基本テーブル作成（goals, milestones, todos）
- [ ] REST API 基本エンドポイント（/goals, /todos）
- [ ] フロントエンド基本画面（ダッシュボード、ログイン）

### Phase 2: メイン機能

**目標:** エージェントによる目標設定とダッシュボード

- [ ] 目標設定エージェント実装
- [ ] チャットUI実装
- [ ] 目標詳細化フロー実装
- [ ] ダッシュボード画面完成（進捗表示）
- [ ] ToDoリスト機能

### Phase 3: リマインダー機能

**目標:** 定期リマインドと進捗収集

- [ ] EventBridge Scheduler 設定
- [ ] リマインダーエージェント実装
- [ ] LINE Messaging API 連携
- [ ] GitHub/Qiita 進捗収集
- [ ] AgentCore Memory 統合

### Phase 4: 外部連携強化

**目標:** Google Calendar連携と機能拡充

- [ ] Google Calendar Tool 実装（[design_calendar_tool.md](design_calendar_tool.md)）
- [ ] AgentCore Identity 設定
- [ ] connpass連携
- [ ] LINEからの簡易チャット対応

---

## 9. 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [requirements.md](requirements.md) | 要件定義書 |
| [architecture.png](architecture.png) | アーキテクチャ図 |
| [design_calendar_tool.md](design_calendar_tool.md) | Google Calendar Tool設計書 |
| [design_reminder.md](design_reminder.md) | リマインダー機能設計書 |
| [research_amplify_dsql.md](research_amplify_dsql.md) | Amplify + DSQL連携調査 |
| [aurora_dsql/](aurora_dsql/) | Aurora DSQL技術ドキュメント集 |
| [aurora_dsql/blog-schema.md](aurora_dsql/blog-schema.md) | Aurora DSQLエラーと対処法ガイド |
| [aurora_dsql/aurora_dsql_final_solution.md](aurora_dsql/aurora_dsql_final_solution.md) | 権限設定の最終解決方法 |
| [aurora_dsql/aurora_dsql_token_generation_guide.md](aurora_dsql/aurora_dsql_token_generation_guide.md) | 認証トークン生成ガイド |

---

## 付録A: 目標詳細化の質問テンプレート

エージェントが粒度の粗い目標を詳細化する際に使用する質問項目。

### A.1 質問項目

1. **期限（When）**
   - 「いつまでに達成したいですか？」
   - 「具体的な期日はありますか？（例: 2025年12月末）」

2. **頻度（How often）**
   - 「どのくらいの頻度で取り組みますか？」
   - 「日次/週次/月次のどれが適切ですか？」

3. **成果物（What）**
   - 「具体的に何を作りますか？」
   - 「アウトプットの形は？（記事、コード、登壇など）」

4. **評価指標（Metrics）**
   - 「どうやって進捗を測りますか？」
   - 「自動で収集できるもの（GitHub commits等）を使いますか？」
   - 選択肢: `qiita_posts`, `github_commits`, `connpass_talks`, `manual`

5. **優先度（Priority）**
   - 「他の目標と比べた優先度は？」
   - 「必達目標ですか、チャレンジ目標ですか？」

### A.2 詳細化フローの例

```
User: 「今年はアウトプット増やす」

Agent: 「素晴らしい目標ですね！もう少し具体的にしましょう。
        どのような形でアウトプットしたいですか？
        1. 技術ブログ（Qiita等）
        2. GitHub（コード/PR）
        3. 登壇（connpass等）
        4. その他」

User: 「1と3」

Agent: 「技術ブログと登壇ですね。
        それぞれの目標数と頻度を教えてください。
        例: 月2本のQiita記事、月1回の登壇」

User: 「Qiitaは月2本、登壇は月1回」

Agent: 「了解です！以下の目標を登録しますね。

        【目標】今年はアウトプット増やす
        ├─ マイルストーン1: 月2本のQiita記事
        │   └─ 評価指標: qiita_posts_count（自動収集）
        └─ マイルストーン2: 月1回の登壇
            └─ 評価指標: connpass_talks_count（自動収集）

        期限は年末（2025年12月31日）でよろしいですか？」

User: 「はい」

Agent: 「登録しました！Googleカレンダーにも期限を追加しますか？」
```

---

## 付録B: 環境変数・シークレット

| 名前 | 説明 | 保存場所 |
|------|------|---------|
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | 環境変数 |
| `COGNITO_CLIENT_ID` | Cognito App Client ID | 環境変数 |
| `DSQL_HOST` | Aurora DSQL エンドポイント | 環境変数 |
| `DSQL_USER` | DSQLユーザー名 | 環境変数 |
| `GOOGLE_CLIENT_ID` | Google OAuth2 クライアントID | Secrets Manager |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 シークレット | AgentCore Identity |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Channel Access Token | Secrets Manager |
| `LINE_CHANNEL_SECRET` | LINE Channel Secret | Secrets Manager |
| `BEDROCK_MODEL_ID` | Bedrock モデルID | 環境変数 |
