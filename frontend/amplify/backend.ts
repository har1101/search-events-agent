import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";

/**
 * Amplify Gen2 バックエンドのエントリーポイント
 *
 * このファイルは Amplify Gen2 バックエンドの全リソースを統合します。
 * 各リソース（auth, data, functions など）をここでインポートし、
 * defineBackend に渡すことで、デプロイ時に AWS リソースとして構築されます。
 *
 * 現在の構成:
 * - auth: Cognito User Pool による認証機能
 *
 * TODO: Phase 2 以降で以下を追加予定
 * - data: Aurora DSQL との連携（API Gateway + Lambda）
 * - functions: カスタム Lambda 関数
 */
defineBackend({
  auth,
});
