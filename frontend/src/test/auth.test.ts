/**
 * 認証ユーティリティ関数のテスト
 *
 * テスト対象: src/lib/auth.ts
 *
 * テストケース:
 * - handleSignIn: サインイン成功/失敗
 * - handleSignUp: サインアップ成功/失敗
 * - handleConfirmSignUp: メール検証成功/失敗
 * - handleSignOut: サインアウト成功/失敗
 * - getAuthenticatedUser: ユーザー取得成功/失敗
 * - isAuthenticated: 認証状態確認
 *
 * 各関数は AWS Amplify の Auth API をラップしており、
 * 成功時は { success: true, data }、
 * 失敗時は { success: false, error } を返します。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleSignIn,
  handleSignUp,
  handleConfirmSignUp,
  handleSignOut,
  getAuthenticatedUser,
  isAuthenticated,
} from "../lib/auth";
import {
  signIn,
  signUp,
  confirmSignUp,
  signOut,
  getCurrentUser,
} from "aws-amplify/auth";
import type {
  SignInOutput,
  SignUpOutput,
  ConfirmSignUpOutput,
  AuthUser,
} from "aws-amplify/auth";

/**
 * aws-amplify/auth モジュールのモック
 *
 * setup.ts でグローバルにモックされていますが、
 * このテストファイルでは各関数の戻り値を個別に制御します。
 */
vi.mock("aws-amplify/auth");

describe("認証ユーティリティ関数", () => {
  /**
   * 各テスト前にモックをリセット
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleSignIn", () => {
    /**
     * テスト: サインイン成功時の動作
     *
     * 期待動作:
     * - success が true を返す
     * - data に Amplify の戻り値が含まれる
     */
    it("サインイン成功時は success: true を返す", async () => {
      const mockResult: SignInOutput = {
        isSignedIn: true,
        nextStep: { signInStep: "DONE" },
      };
      vi.mocked(signIn).mockResolvedValue(mockResult);

      const result = await handleSignIn({
        username: "test@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockResult);
      }
    });

    /**
     * テスト: サインイン失敗時の動作
     *
     * 期待動作:
     * - success が false を返す
     * - error にエラーオブジェクトが含まれる
     */
    it("サインイン失敗時は success: false を返す", async () => {
      const mockError = new Error("認証情報が無効です");
      vi.mocked(signIn).mockRejectedValue(mockError);

      const result = await handleSignIn({
        username: "test@example.com",
        password: "wrongpassword",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe("handleSignUp", () => {
    /**
     * テスト: サインアップ成功時の動作
     *
     * 期待動作:
     * - success が true を返す
     * - signUp が正しいパラメータで呼び出される
     * - userAttributes.email にユーザー名（メールアドレス）が設定される
     */
    it("サインアップ成功時は success: true を返す", async () => {
      const mockResult: SignUpOutput = {
        isSignUpComplete: false,
        nextStep: {
          signUpStep: "CONFIRM_SIGN_UP",
          codeDeliveryDetails: {
            deliveryMedium: "EMAIL",
            destination: "t***@example.com",
          },
        },
      };
      vi.mocked(signUp).mockResolvedValue(mockResult);

      const result = await handleSignUp({
        username: "test@example.com",
        password: "password123",
      });

      expect(result.success).toBe(true);
      // signUp が正しいパラメータで呼び出されたことを確認
      expect(signUp).toHaveBeenCalledWith({
        username: "test@example.com",
        password: "password123",
        options: {
          userAttributes: {
            email: "test@example.com",
          },
        },
      });
    });

    /**
     * テスト: サインアップ失敗時の動作
     *
     * 期待動作:
     * - success が false を返す
     * - error にエラーオブジェクトが含まれる
     */
    it("サインアップ失敗時は success: false を返す", async () => {
      const mockError = new Error("ユーザーは既に存在します");
      vi.mocked(signUp).mockRejectedValue(mockError);

      const result = await handleSignUp({
        username: "test@example.com",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe("handleConfirmSignUp", () => {
    /**
     * テスト: メール検証成功時の動作
     *
     * 期待動作:
     * - success が true を返す
     */
    it("メール検証成功時は success: true を返す", async () => {
      const mockResult: ConfirmSignUpOutput = {
        isSignUpComplete: true,
        nextStep: { signUpStep: "DONE" },
      };
      vi.mocked(confirmSignUp).mockResolvedValue(mockResult);

      const result = await handleConfirmSignUp({
        username: "test@example.com",
        confirmationCode: "123456",
      });

      expect(result.success).toBe(true);
    });

    /**
     * テスト: メール検証失敗時の動作（無効なコード）
     *
     * 期待動作:
     * - success が false を返す
     * - error にエラーオブジェクトが含まれる
     */
    it("メール検証失敗時は success: false を返す", async () => {
      const mockError = new Error("無効な検証コードです");
      vi.mocked(confirmSignUp).mockRejectedValue(mockError);

      const result = await handleConfirmSignUp({
        username: "test@example.com",
        confirmationCode: "000000",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe("handleSignOut", () => {
    /**
     * テスト: サインアウト成功時の動作
     *
     * 期待動作:
     * - success が true を返す
     */
    it("サインアウト成功時は success: true を返す", async () => {
      vi.mocked(signOut).mockResolvedValue(undefined);

      const result = await handleSignOut();

      expect(result.success).toBe(true);
    });

    /**
     * テスト: サインアウト失敗時の動作
     *
     * 期待動作:
     * - success が false を返す
     * - error にエラーオブジェクトが含まれる
     */
    it("サインアウト失敗時は success: false を返す", async () => {
      const mockError = new Error("サインアウトに失敗しました");
      vi.mocked(signOut).mockRejectedValue(mockError);

      const result = await handleSignOut();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe("getAuthenticatedUser", () => {
    /**
     * テスト: 認証済みユーザー取得成功時の動作
     *
     * 期待動作:
     * - success が true を返す
     * - data にユーザー情報が含まれる
     */
    it("認証済み時はユーザー情報を返す", async () => {
      const mockUser: AuthUser = {
        username: "test@example.com",
        userId: "123",
      };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await getAuthenticatedUser();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockUser);
      }
    });

    /**
     * テスト: 未認証時の動作
     *
     * 期待動作:
     * - success が false を返す
     * - error にエラーオブジェクトが含まれる
     */
    it("未認証時はエラーを返す", async () => {
      const mockError = new Error("認証されていません");
      vi.mocked(getCurrentUser).mockRejectedValue(mockError);

      const result = await getAuthenticatedUser();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe("isAuthenticated", () => {
    /**
     * テスト: 認証済み時は true を返す
     *
     * getCurrentUser が成功した場合、ユーザーは認証済みとみなす
     */
    it("認証済み時は true を返す", async () => {
      const mockUser: AuthUser = {
        username: "test",
        userId: "123",
      };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await isAuthenticated();

      expect(result).toBe(true);
    });

    /**
     * テスト: 未認証時は false を返す
     *
     * getCurrentUser が例外をスローした場合、ユーザーは未認証とみなす
     */
    it("未認証時は false を返す", async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(
        new Error("認証されていません")
      );

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });
});
