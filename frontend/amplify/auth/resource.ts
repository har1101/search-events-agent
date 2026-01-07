import { defineAuth } from "@aws-amplify/backend";

/**
 * Cognito User Pool の設定
 *
 * このファイルでは Amazon Cognito User Pool の認証設定を定義します。
 * Amplify Gen2 では、このファイルの設定に基づいて Cognito リソースが
 * 自動的にプロビジョニングされます。
 *
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 *
 * 設定内容:
 * - loginWith.email: メールアドレスをユーザー名として使用
 * - userAttributes.email: メールアドレスを必須属性として設定
 *
 * TODO: Google/Apple ソーシャルログインの追加を検討
 */
export const auth = defineAuth({
  // メールアドレス + パスワードによる認証を有効化
  // これにより、サインアップ時にメール検証コードが送信される
  loginWith: {
    email: true,
  },
  // ユーザー属性の設定
  userAttributes: {
    email: {
      required: true, // サインアップ時に必須
      mutable: true, // サインアップ後も変更可能
    },
  },
});
