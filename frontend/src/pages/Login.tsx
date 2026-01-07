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
import { Navigate, useLocation } from "react-router-dom";

/**
 * ログイン前にアクセスしようとしたページの情報を保持する型
 * ProtectedRoute から渡される location state の型定義
 */
interface LocationState {
  /** リダイレクト元のパス情報 */
  readonly from?: {
    readonly pathname: string;
  };
}

interface LoginProps {
  /** 認証後に表示する子コンポーネント（省略時はダッシュボードへリダイレクト） */
  readonly children?: React.ReactNode;
}

/**
 * ログインページ
 *
 * 認証済みの場合:
 * - children が渡されていれば、それを表示
 * - children がなければ、元々アクセスしようとしていたページ（または ダッシュボード）へリダイレクト
 *
 * 未認証の場合:
 * - Authenticator コンポーネントがサインインフォームを表示
 *
 * レビュー指摘対応: ログイン後のリダイレクト先を元のページに戻す
 * 理由: ProtectedRoute から渡される location.state.from を使用して、
 *       認証前にアクセスしようとしていたページに戻ることで、UXを向上させる
 *
 * @param children - 認証後に表示するコンテンツ
 */
export function Login({ children }: LoginProps): JSX.Element {
  // レビュー指摘対応: useLocation を使用して、リダイレクト元のパス情報を取得
  const location = useLocation();
  const state = location.state as LocationState | null;
  // リダイレクト先を決定: state.from があればそのパス、なければダッシュボード
  const redirectTo = state?.from?.pathname ?? "/";

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
          // レビュー指摘対応: 元々アクセスしようとしていたページにリダイレクト
          return <Navigate to={redirectTo} replace />;
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
