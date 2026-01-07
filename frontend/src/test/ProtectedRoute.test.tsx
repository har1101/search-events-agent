/**
 * ProtectedRoute コンポーネントのテスト
 *
 * テスト対象: src/components/ProtectedRoute.tsx
 *
 * テストケース:
 * 1. 認証設定中（configuring）はローディング表示
 * 2. 未認証時はログインページへリダイレクト
 * 3. 認証済み時は children を表示
 *
 * このテストでは useAuthenticator フックの戻り値を動的にモックして
 * 各認証状態での動作を検証します。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";

/**
 * useAuthenticator フックのモック関数
 *
 * 各テストケースで異なる認証状態をシミュレートするため、
 * モック関数として定義し、テストごとに戻り値を変更します。
 */
const mockUseAuthenticator = vi.fn();

/**
 * @aws-amplify/ui-react のモック
 *
 * useAuthenticator フックを mockUseAuthenticator に置き換えることで、
 * テスト内で認証状態を自由に制御できるようにします。
 */
vi.mock("@aws-amplify/ui-react", () => ({
  useAuthenticator: () => mockUseAuthenticator(),
}));

describe("ProtectedRoute", () => {
  /**
   * 各テスト前にモックをリセット
   *
   * テスト間の状態の干渉を防ぐため、
   * 各テスト実行前にすべてのモックをクリアします。
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * テスト: 認証設定中はローディング表示
   *
   * authStatus が "configuring" の場合、
   * Amplify がまだ初期化中であることを示します。
   * この間は "Loading..." テキストを表示し、ユーザーを待機させます。
   */
  it("認証設定中はローディング表示", () => {
    mockUseAuthenticator.mockReturnValue({ authStatus: "configuring" });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>保護されたコンテンツ</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // ローディングテキストが表示されることを確認
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  /**
   * テスト: 未認証時はログインページへリダイレクト
   *
   * authStatus が "unauthenticated" の場合、
   * ユーザーを /login ページへリダイレクトし、
   * 保護されたコンテンツは表示しません。
   */
  it("未認証時はログインページへリダイレクト", () => {
    mockUseAuthenticator.mockReturnValue({ authStatus: "unauthenticated" });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>保護されたコンテンツ</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>ログインページ</div>} />
        </Routes>
      </MemoryRouter>
    );

    // ログインページが表示されることを確認
    expect(screen.getByText("ログインページ")).toBeInTheDocument();
    // 保護されたコンテンツは表示されないことを確認
    expect(screen.queryByText("保護されたコンテンツ")).not.toBeInTheDocument();
  });

  /**
   * テスト: 認証済み時は children を表示
   *
   * authStatus が "authenticated" の場合、
   * ProtectedRoute の children（保護されたコンテンツ）を
   * そのまま表示します。
   */
  it("認証済み時は children を表示", () => {
    mockUseAuthenticator.mockReturnValue({ authStatus: "authenticated" });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>保護されたコンテンツ</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // 保護されたコンテンツが表示されることを確認
    expect(screen.getByText("保護されたコンテンツ")).toBeInTheDocument();
  });
});
