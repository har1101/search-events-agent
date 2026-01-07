/**
 * アプリケーションのルートコンポーネント
 *
 * React Router を使用したルーティング設定と
 * Amplify Authenticator.Provider による認証コンテキストを提供します。
 *
 * ルーティング構成:
 * - /login: ログインページ（公開）
 * - /: ダッシュボード（認証必須）
 *
 * Phase 2 以降で追加予定のルート:
 * - /chat: チャットページ（エージェントとの対話）
 * - /goals/:id: 目標詳細ページ
 * - /settings: 設定ページ
 *
 * @see docs/design.md - 3.1 フロントエンド設計（画面構成）
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { ProtectedRoute } from "./components/ProtectedRoute";

/**
 * メインアプリケーションコンポーネント
 *
 * Authenticator.Provider でアプリ全体を囲むことで、
 * どのコンポーネントからでも useAuthenticator フックで
 * 認証状態にアクセスできるようになります。
 */
function App(): JSX.Element {
  return (
    // Authenticator.Provider: 認証コンテキストをアプリ全体に提供
    // これにより、子コンポーネントで useAuthenticator フックが使用可能になる
    <Authenticator.Provider>
      {/* BrowserRouter: HTML5 History API を使用したルーティング */}
      <BrowserRouter>
        <Routes>
          {/* ログインページ（公開ルート） */}
          {/* 認証済みの場合は自動的にダッシュボードへリダイレクト */}
          <Route path="/login" element={<Login />} />

          {/* ダッシュボード（認証保護ルート） */}
          {/* 未認証の場合は ProtectedRoute が /login へリダイレクト */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* TODO: Phase 2 以降で追加
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/goals/:id" element={<ProtectedRoute><GoalDetail /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          */}
        </Routes>
      </BrowserRouter>
    </Authenticator.Provider>
  );
}

export default App;
