# 目標管理アプリ - フロントエンド

React + TypeScript + Vite + AWS Amplify Gen2 で構築されたフロントエンドアプリケーションです。

## 必要環境

- Node.js 18+
- AWS CLI（設定済み）
- AWS アカウント（適切な権限付き）

## セットアップ

```bash
# 依存関係のインストール
npm install

# Amplify サンドボックスの起動（別ターミナル）
# これにより amplify_outputs.json が生成されます
npx ampx sandbox

# 開発サーバーの起動
npm run dev
```

## 利用可能なスクリプト

```bash
npm run dev      # 開発サーバーを起動
npm run build    # 本番用ビルド
npm run lint     # ESLint を実行
npm run test     # テストをウォッチモードで実行
npm run test:run # テストを1回実行
npm run preview  # 本番ビルドをプレビュー
```

## プロジェクト構成

```text
frontend/
├── amplify/                 # Amplify Gen2 バックエンド設定
│   ├── auth/
│   │   └── resource.ts     # Cognito User Pool 設定
│   └── backend.ts          # バックエンドエントリーポイント
├── src/
│   ├── components/         # 再利用可能なコンポーネント
│   │   └── ProtectedRoute.tsx  # 認証保護ルート
│   ├── lib/               # ユーティリティ関数
│   │   └── auth.ts        # 認証ヘルパー関数
│   ├── pages/             # ページコンポーネント
│   │   ├── Dashboard.tsx  # ダッシュボード（認証必須）
│   │   └── Login.tsx      # ログイン/サインアップ
│   ├── test/              # テストファイル
│   └── App.tsx            # ルーティング設定
└── package.json
```

## 認証機能

AWS Cognito User Pool を使用した認証機能を Amplify Gen2 経由で提供しています。

### 機能
- メールアドレス + パスワードによるサインアップ/サインイン
- メール検証フロー
- 認証保護ルート（未認証ユーザーは /login へリダイレクト）

### ルート構成
- `/login` - ログイン/サインアップページ（公開）
- `/` - ダッシュボード（認証必須）

## デプロイ

### Amplify Hosting を使用

1. GitHub リポジトリを Amplify Hosting に接続
2. Amplify が Gen2 バックエンドを自動検出してデプロイ

### 手動デプロイ

```bash
# バックエンドのデプロイ
npx ampx pipeline-deploy --branch main

# フロントエンドのビルド
npm run build
```

## 開発時の注意点

- `amplify_outputs.json` は `npx ampx sandbox` 実行時に生成されます
- このファイルは `.gitignore` に追加されており、コミットされません
- 設定のサンプルは `amplify_outputs.json.sample` を参照してください

## 関連ドキュメント

- [設計書](../docs/design.md)
- [要件定義書](../docs/requirements.md)
