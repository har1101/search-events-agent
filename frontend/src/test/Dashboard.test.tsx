/**
 * Dashboard コンポーネントのテスト
 *
 * テスト対象: src/pages/Dashboard.tsx
 *
 * テストケース:
 * 1. ユーザーメールアドレスを含むウェルカムメッセージが表示される
 * 2. サインアウトボタンが表示される
 * 3. 目標一覧セクションが表示される
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Dashboard } from "../pages/Dashboard";

/**
 * useAuthenticator フックのモック
 *
 * Dashboard コンポーネントは Amplify UI の useAuthenticator を使用して
 * ユーザー情報を取得するため、テスト用のモックを設定します。
 */
vi.mock("@aws-amplify/ui-react", () => ({
  useAuthenticator: () => ({
    user: {
      signInDetails: {
        loginId: "test@example.com",
      },
    },
    signOut: vi.fn(),
  }),
}));

describe("Dashboard", () => {
  /**
   * テスト: ユーザーメールアドレスを含むウェルカムメッセージが表示される
   *
   * 期待動作:
   * - "ダッシュボード" というタイトルが表示される
   * - モックで設定したメールアドレス "test@example.com" が表示される
   */
  it("ユーザーメールアドレスを含むウェルカムメッセージが表示される", () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    // ページタイトルの確認
    expect(screen.getByText("ダッシュボード")).toBeInTheDocument();
    // ユーザーメールアドレスの確認
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  /**
   * テスト: サインアウトボタンが表示される
   *
   * 期待動作:
   * - "サインアウト" というテキストを持つボタンが存在する
   */
  it("サインアウトボタンが表示される", () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(
      screen.getByRole("button", { name: /サインアウト/i })
    ).toBeInTheDocument();
  });

  /**
   * テスト: 目標一覧セクションが表示される
   *
   * 期待動作:
   * - "目標一覧" というセクション見出しが表示される
   */
  it("目標一覧セクションが表示される", () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(screen.getByText("目標一覧")).toBeInTheDocument();
  });
});
