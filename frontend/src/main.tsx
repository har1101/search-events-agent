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
  } catch {
    // 開発初期やファイル生成前の状態では警告のみ出力
    // `npx ampx sandbox` を実行すると自動生成される
    console.warn(
      "amplify_outputs.json が見つかりません。" +
        "'npx ampx sandbox' を実行して生成してください。"
    );
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

// アプリケーション起動
configureAndRender();
