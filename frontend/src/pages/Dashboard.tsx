/**
 * ダッシュボードページコンポーネント
 *
 * 認証済みユーザー向けのメインページです。
 * 目標一覧、進捗バー、今日のToDo、週間サマリーを表示します。
 *
 * 現在は基本構造のみ実装。Phase 2 以降で以下を追加予定:
 * - GoalCard コンポーネント（目標カード）
 * - TodoList コンポーネント（今日のToDoリスト）
 * - WeeklySummary コンポーネント（週間サマリー）
 * - API からのデータ取得
 *
 * @see docs/design.md - 3.1 フロントエンド設計
 */

import { useAuthenticator } from "@aws-amplify/ui-react";

/**
 * ダッシュボードページ
 *
 * useAuthenticator フックを使用して認証済みユーザー情報を取得し、
 * サインアウト機能を提供します。
 *
 * 認証状態は Authenticator.Provider（App.tsx）によって管理されており、
 * このコンポーネントは ProtectedRoute 経由でのみアクセスできます。
 */
export function Dashboard(): JSX.Element {
  // Amplify UI の useAuthenticator フックで認証情報を取得
  // context.user を依存配列に指定することで、ユーザー情報変更時に再レンダリング
  const { user, signOut } = useAuthenticator((context) => [context.user]);

  return (
    <div style={{ padding: "20px" }}>
      {/* ヘッダー: ページタイトルとサインアウトボタン */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1>ダッシュボード</h1>
        {/* CodeRabbit指摘対応: type="button" を明示的に指定 */}
        {/* 理由: フォーム内でなくても、ボタンのデフォルトタイプは "submit" のため、 */}
        {/*       意図しないフォーム送信を防ぐために明示的に "button" を指定する */}
        <button
          type="button"
          onClick={signOut}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          サインアウト
        </button>
      </header>

      <main>
        {/* ウェルカムセクション */}
        <section>
          <h2>ようこそ!</h2>
          {/* ユーザー情報が取得できない場合はフォールバックメッセージを表示 */}
          <p>
            ログイン中:{" "}
            {user?.signInDetails?.loginId ?? user?.username ?? "ユーザー"}
          </p>
        </section>

        {/* 目標一覧セクション（Phase 2 で実装予定） */}
        <section style={{ marginTop: "24px" }}>
          <h2>目標一覧</h2>
          <p>ここに目標カードが表示されます。</p>
          {/* TODO: GoalCard コンポーネントを実装し、API から取得した目標を表示 */}
        </section>

        {/* ToDoリストセクション（Phase 2 で実装予定） */}
        <section style={{ marginTop: "24px" }}>
          <h2>今日のToDo</h2>
          <p>ここにToDoリストが表示されます。</p>
          {/* TODO: TodoList コンポーネントを実装 */}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
