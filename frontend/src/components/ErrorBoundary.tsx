/**
 * エラーバウンダリコンポーネント
 *
 * レビュー指摘対応: App.tsx にエラーバウンダリを追加
 * 理由: ランタイムレンダーエラーが発生した場合に白い画面になるのを防ぎ、
 *       ユーザーフレンドリーなフォールバックUIを表示する
 *
 * React のエラーバウンダリは class コンポーネントで実装する必要がある
 * （関数コンポーネントでは getDerivedStateFromError が使えないため）
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  /** 子コンポーネント */
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  /** エラーが発生したかどうか */
  hasError: boolean;
  /** 発生したエラー */
  error: Error | null;
  /**
   * CodeRabbit指摘対応: リトライ時に子コンポーネントを再マウントするためのキー
   * 理由: 状態をリセットするだけでは子コンポーネントの内部状態が残る可能性があるため、
   *       キーを変更することで強制的に再マウントさせる
   */
  retryKey: number;
}

/**
 * エラーバウンダリクラスコンポーネント
 *
 * 子コンポーネントツリー内で発生したJavaScriptエラーをキャッチし、
 * クラッシュしたコンポーネントツリーの代わりにフォールバックUIを表示する
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  /**
   * エラー発生時に状態を更新するための静的メソッド
   * このメソッドでエラー状態を更新すると、再レンダリング時にフォールバックUIが表示される
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * エラー情報をログに記録するためのライフサイクルメソッド
   * 本番環境では外部エラー監視サービス（Sentry等）に送信することを推奨
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // エラーログを記録
    console.error("ErrorBoundary がエラーをキャッチしました:", error);
    console.error("エラー情報:", errorInfo.componentStack);
  }

  /**
   * エラー状態をリセットして再試行するハンドラ
   *
   * CodeRabbit指摘対応: retryKey をインクリメントして子コンポーネントを再マウント
   * 理由: 状態をリセットするだけでは子コンポーネントの破損した内部状態が残る可能性がある
   */
  handleRetry = (): void => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // フォールバックUI
      return (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            fontFamily: "sans-serif",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <h1 style={{ color: "#dc3545", marginBottom: "20px" }}>
            エラーが発生しました
          </h1>
          <p style={{ color: "#666", marginBottom: "20px" }}>
            申し訳ございません。予期しないエラーが発生しました。
          </p>
          {/* 開発環境ではエラー詳細を表示 */}
          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                background: "#f8f9fa",
                padding: "15px",
                borderRadius: "5px",
                maxWidth: "600px",
                overflow: "auto",
                textAlign: "left",
                fontSize: "12px",
                marginBottom: "20px",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                cursor: "pointer",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
              }}
            >
              再試行
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                cursor: "pointer",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "5px",
              }}
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      );
    }

    // CodeRabbit指摘対応: key を使用してリトライ時に子コンポーネントを再マウント
    // Fragment に key を設定することで、キーが変わると子コンポーネントが再生成される
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

export default ErrorBoundary;
