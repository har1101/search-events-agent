/**
 * 認証ユーティリティ関数
 *
 * AWS Amplify Auth API をラップし、アプリケーション全体で
 * 一貫した認証操作を提供します。
 *
 * 主な機能:
 * - サインイン / サインアップ / サインアウト
 * - メール検証コードの確認
 * - 認証状態の取得
 * - セッション情報の取得
 *
 * すべての認証関数は判別可能ユニオン型（AuthResult）を返し、
 * 型の絞り込みが正しく機能するようになっています。
 */

import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  type SignInInput,
  type SignUpInput,
  type ConfirmSignUpInput,
  type SignInOutput,
  type SignUpOutput,
  type ConfirmSignUpOutput,
  type AuthSession,
  type AuthUser,
} from "aws-amplify/auth";

// ============================================================================
// 型定義
// ============================================================================

/**
 * 認証操作の成功結果
 *
 * success: true で判別可能なユニオン型
 * @template T - 成功時のデータ型
 */
interface AuthSuccess<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * 認証操作の失敗結果
 *
 * success: false で判別可能なユニオン型
 */
interface AuthFailure {
  readonly success: false;
  readonly error: unknown;
}

/**
 * 認証操作の結果型（判別可能ユニオン）
 *
 * @template T - 成功時のデータ型
 *
 * @example
 * const result = await handleSignIn({ username, password });
 * if (result.success) {
 *   // result.data が SignInOutput として推論される
 *   console.log(result.data.isSignedIn);
 * } else {
 *   // result.error が unknown として推論される
 *   console.error(result.error);
 * }
 */
type AuthResult<T> = AuthSuccess<T> | AuthFailure;

// ============================================================================
// 認証関数
// ============================================================================

/**
 * メールアドレスとパスワードでサインインする
 *
 * @param username - メールアドレス
 * @param password - パスワード
 * @returns 成功時は { success: true, data: SignInOutput }、
 *          失敗時は { success: false, error }
 *
 * @example
 * const result = await handleSignIn({
 *   username: "user@example.com",
 *   password: "password123"
 * });
 * if (result.success) {
 *   console.log("サインイン成功:", result.data.isSignedIn);
 * }
 */
export async function handleSignIn({
  username,
  password,
}: SignInInput): Promise<AuthResult<SignInOutput>> {
  try {
    const data = await signIn({ username, password });
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 新規ユーザーを登録する
 *
 * サインアップ後、Cognito からメール検証コードが送信されます。
 * ユーザーは handleConfirmSignUp でコードを入力して登録を完了する必要があります。
 *
 * @param username - メールアドレス（ユーザー名として使用）
 * @param password - パスワード（Cognito のパスワードポリシーに準拠）
 * @returns 成功時は { success: true, data: SignUpOutput }、
 *          失敗時は { success: false, error }
 */
export async function handleSignUp({
  username,
  password,
}: SignUpInput): Promise<AuthResult<SignUpOutput>> {
  try {
    const data = await signUp({
      username,
      password,
      options: {
        // メールアドレスをユーザー属性として設定
        // これにより、メール検証フローが有効になる
        userAttributes: {
          email: username,
        },
      },
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * メール検証コードを確認してサインアップを完了する
 *
 * サインアップ後に送信された6桁の検証コードを入力して
 * ユーザー登録を完了します。
 *
 * @param username - サインアップ時のメールアドレス
 * @param confirmationCode - メールで受信した6桁の検証コード
 * @returns 成功時は { success: true, data: ConfirmSignUpOutput }、
 *          失敗時は { success: false, error }
 */
export async function handleConfirmSignUp({
  username,
  confirmationCode,
}: ConfirmSignUpInput): Promise<AuthResult<ConfirmSignUpOutput>> {
  try {
    const data = await confirmSignUp({ username, confirmationCode });
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 現在のユーザーをサインアウトする
 *
 * ローカルのセッション情報をクリアし、Cognito からサインアウトします。
 *
 * @returns 成功時は { success: true, data: undefined }、
 *          失敗時は { success: false, error }
 */
export async function handleSignOut(): Promise<AuthResult<void>> {
  try {
    await signOut();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 現在認証済みのユーザー情報を取得する
 *
 * ユーザーがサインインしていない場合はエラーを返します。
 *
 * @returns 成功時は { success: true, data: AuthUser }、
 *          失敗時は { success: false, error }
 */
export async function getAuthenticatedUser(): Promise<AuthResult<AuthUser>> {
  try {
    const data = await getCurrentUser();
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * ユーザーが認証済みかどうかを確認する
 *
 * ProtectedRoute などで認証状態を簡単にチェックするために使用します。
 *
 * @returns 認証済みの場合は true、未認証の場合は false
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

/**
 * 現在のセッション情報を取得する
 *
 * JWT トークン（ID Token, Access Token）やユーザー属性にアクセスする際に使用します。
 * API 呼び出し時の認証ヘッダーに Access Token を使用する場合などに便利です。
 *
 * @returns 成功時は { success: true, data: AuthSession }、
 *          失敗時は { success: false, error }
 *
 * @example
 * const result = await getSession();
 * if (result.success && result.data.tokens) {
 *   const accessToken = result.data.tokens.accessToken.toString();
 *   // API 呼び出しのヘッダーに使用
 * }
 */
export async function getSession(): Promise<AuthResult<AuthSession>> {
  try {
    const data = await fetchAuthSession();
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
