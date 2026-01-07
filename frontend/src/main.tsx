/**
 * アプリケーションのエントリーポイント
 *
 * このファイルは以下の役割を担います:
 * 1. Amplify ライブラリの設定（amplify_outputs.json の読み込み）
 * 2. React アプリケーションの DOM へのマウント
 *
 * amplify_outputs.json について:
 * - `npx ampx sandbox` 実行時に自動生成される設定ファイル
 * - Cognito User Pool ID、リージョン、Client ID などが含まれる
 * - 本番環境では Amplify Hosting が自動的に生成・注入
 * - .gitignore に追加されており、リポジトリにはコミットされない
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Amplify } from "aws-amplify";
import "./index.css";
import App from "./App.tsx";

/**
 * Amplify 設定を読み込み、アプリケーションをレンダリングする
 *
 * amplify_outputs.json が存在しない場合（開発初期など）は
 * 警告を出力して続行します。この場合、認証機能は動作しませんが、
 * UIの確認などは可能です。
 *
 * 本番環境では必ず amplify_outputs.json が存在するため、
 * 開発時のみこの警告が表示される想定です。
 */
async function configureAndRender() {
  try {
    // 動的インポートでファイルの存在をハンドリング
    // ファイルが存在しない場合は catch ブロックで処理
    const outputs = await import("../amplify_outputs.json");
    Amplify.configure(outputs.default);
  } catch (error) {
    // レビュー指摘対応: モジュール未発見エラーとその他のエラーを区別
    // 理由: JSON解析エラーやネットワークエラーなど、実際の問題を検出するため
    const isModuleNotFound =
      error instanceof Error && error.message.includes("Cannot find module");

    if (isModuleNotFound) {
      // 開発初期やファイル生成前の状態では警告のみ出力
      // `npx ampx sandbox` を実行すると自動生成される
      console.warn(
        "amplify_outputs.json が見つかりません。" +
          "'npx ampx sandbox' を実行して生成してください。"
      );
    } else {
      // その他のエラー（JSON解析エラーなど）は再スローして問題を検出
      console.error("Amplify設定の読み込みに失敗しました:", error);
      throw error;
    }
  }

  // React アプリケーションを #root 要素にマウント
  // StrictMode は開発時の潜在的問題を検出するために使用
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error(
      "ルート要素が見つかりません。index.html に id='root' の要素が存在することを確認してください。"
    );
  }
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// レビュー指摘対応: 未処理のPromise拒否をグローバルでハンドリング
// 理由: 非同期処理での予期しないエラーがサイレントにクラッシュするのを防ぐ
window.addEventListener("unhandledrejection", (event) => {
  console.error("未処理のPromise拒否:", event.reason);
});

// アプリケーション起動
// レビュー指摘対応: configureAndRender の呼び出しにエラーハンドリングを追加
// 理由: 起動時のエラーをログに記録し、ユーザーにフィードバックを提供する
configureAndRender().catch((error) => {
  console.error("アプリケーション起動エラー:", error);
  // フォールバックUIを表示
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h1>アプリケーションの起動に失敗しました</h1>
        <p>ページを再読み込みするか、しばらく経ってからお試しください。</p>
        <button onclick="window.location.reload()">再読み込み</button>
      </div>
    `;
  }
});
