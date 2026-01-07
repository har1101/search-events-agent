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
 * リダイレクトパスを検証・正規化する
 *
 * CodeRabbit指摘対応: オープンリダイレクト脆弱性の防止
 * 理由: 外部URLや不正なパスへのリダイレクトを防ぐため、
 *       パスが相対パス（/で始まる）かつ安全な形式であることを検証する
 *
 * CodeRabbit追加指摘対応: 多重エンコードバイパスの防止
 * 理由: 1回のデコードでは %252F%252Fevil.com のような多重エンコードを
 *       検出できないため、繰り返しデコードして最終的な値を検証する
 *
 * @param path - 検証するパス
 * @returns 安全なパス、または不正な場合はデフォルトパス "/"
 */
function validateRedirectPath(path: string | undefined): string {
  // パスが未定義または空の場合はデフォルトに
  if (!path) {
    return "/";
  }

  // 相対パスのみ許可（/で始まる）
  // // で始まるプロトコル相対URLは拒否（例: //evil.com）
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  // 多重エンコードバイパス対策: 繰り返しデコードして最終的な値を検証
  // 最大5回まで（無限ループ防止）
  const MAX_DECODE_ITERATIONS = 5;
  let decoded = path;

  try {
    for (let i = 0; i < MAX_DECODE_ITERATIONS; i++) {
      const newDecoded = decodeURIComponent(decoded);
      // デコード結果が変わらなければ安定したのでループ終了
      if (newDecoded === decoded) {
        break;
      }
      decoded = newDecoded;
    }
  } catch {
    // デコード失敗時はデフォルトに
    return "/";
  }

  // 最終デコード結果を検証
  // // で始まるプロトコル相対URL、または / で始まらない場合は拒否
  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return "/";
  }

  // プロトコルを含むURLパターンを拒否（例: /http://evil.com）
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return "/";
  }

  // CodeRabbit指摘対応: 検証済みのデコード結果を返す
  // 理由: 元のpathではなくデコード済みの安全な値を使用する
  return decoded;
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
  // CodeRabbit指摘対応: リダイレクト先を検証してオープンリダイレクト攻撃を防止
  const redirectTo = validateRedirectPath(state?.from?.pathname);

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
