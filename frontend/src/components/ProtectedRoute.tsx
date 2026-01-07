/**
 * 認証保護ルートコンポーネント
 *
 * 認証済みユーザーのみがアクセスできるルートを作成します。
 * 未認証の場合は /login へリダイレクト、認証設定中は Loading を表示します。
 *
 * 使用例:
 * ```tsx
 * <Route
 *   path="/dashboard"
 *   element={
 *     <ProtectedRoute>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   }
 * />
 * ```
 *
 * @see docs/design.md - 受け入れ条件「未認証ユーザーは保護されたページにアクセスできない」
 */

import { useAuthenticator } from "@aws-amplify/ui-react";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  /** 認証済み時に表示する子コンポーネント */
  readonly children: React.ReactNode;
}

/**
 * 認証保護ルート
 *
 * Amplify UI の useAuthenticator フックを使用して認証状態を監視し、
 * 状態に応じて適切なコンテンツを表示します。
 *
 * 認証状態（authStatus）の値:
 * - "configuring": Amplify 初期化中（Loading 表示）
 * - "authenticated": 認証済み（children を表示）
 * - "unauthenticated": 未認証（/login へリダイレクト）
 *
 * @param children - 認証済み時に表示するコンポーネント
 */
export function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  // useAuthenticator で認証状態を取得
  // context.authStatus を依存配列に指定することで、状態変更時に再レンダリング
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  // 現在のロケーションを取得（リダイレクト元の記録用）
  const location = useLocation();

  // Amplify 初期化中はローディング表示
  // この間はまだ認証状態が確定していないため、判定を待つ
  if (authStatus === "configuring") {
    return <div>Loading...</div>;
  }

  // 未認証の場合は /login へリダイレクト
  // state に現在のロケーションを渡すことで、ログイン後に元のページへ戻れる
  // FIXME: 現在は state を活用したリダイレクト先復元が未実装
  if (authStatus !== "authenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 認証済みの場合は children を表示
  return <>{children}</>;
}

export default ProtectedRoute;
