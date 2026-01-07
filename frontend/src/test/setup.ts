/**
 * Vitest テストセットアップファイル
 *
 * テスト実行前に共通の設定やモックを行います。
 * vitest.config.ts の setupFiles で指定されています。
 *
 * 設定内容:
 * - @testing-library/jest-dom のカスタムマッチャー追加
 * - AWS Amplify のモック（テスト環境では実際の AWS 接続を行わない）
 */

import "@testing-library/jest-dom";
import { vi } from "vitest";

/**
 * AWS Amplify コアライブラリのモック
 *
 * テスト環境では実際の Amplify 設定を行わないため、
 * configure メソッドを空の関数でモックします。
 */
vi.mock("aws-amplify", () => ({
  Amplify: {
    configure: vi.fn(),
  },
}));

/**
 * AWS Amplify Auth モジュールのモック
 *
 * 認証関連の関数をすべてモック化し、テスト内で
 * 任意の戻り値を設定できるようにします。
 *
 * 使用例（テストファイル内）:
 * ```ts
 * vi.mocked(signIn).mockResolvedValue({ isSignedIn: true });
 * ```
 */
vi.mock("aws-amplify/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  confirmSignUp: vi.fn(),
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
}));
