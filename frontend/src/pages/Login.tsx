/**
 * ログインページコンポーネント
 *
 * Amplify UI の Authenticator コンポーネントを使用して、
 * サインイン / サインアップ / メール検証のUIを提供します。
 *
 * Authenticator は以下の機能を自動的に提供:
 * - サインインフォーム
 * - サインアップフォーム（パスワードポリシー検証付き）
 * - メール検証コード入力フォーム
 * - パスワードリセットフロー
 *
 * @see https://ui.docs.amplify.aws/react/connected-components/authenticator
 */

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Navigate } from "react-router-dom";

interface LoginProps {
  /** 認証後に表示する子コンポーネント（省略時はダッシュボードへリダイレクト） */
  readonly children?: React.ReactNode;
}

/**
 * ログインページ
 *
 * 認証済みの場合:
 * - children が渡されていれば、それを表示
 * - children がなければ、ダッシュボード（/）へリダイレクト
 *
 * 未認証の場合:
 * - Authenticator コンポーネントがサインインフォームを表示
 *
 * @param children - 認証後に表示するコンテンツ
 */
export function Login({ children }: LoginProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <Authenticator>
      {({ user }) => {
        // 認証済みの場合の処理
        if (user) {
          // children が渡されている場合はそれを表示
          if (children) {
            return <>{children}</>;
          }
          // children がない場合はダッシュボードへリダイレクト
          return <Navigate to="/" replace />;
        }
        // 未認証の場合は Authenticator が自動的にサインインフォームを表示
        // （この return は Authenticator の仕様上必要だが、実際には到達しない）
        return null;
      }}
      </Authenticator>
    </div>
  );
}

export default Login;
