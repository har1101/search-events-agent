/**
 * Vitest テスト設定ファイル
 *
 * テスト実行時の環境設定を定義します。
 *
 * 設定内容:
 * - environment: jsdom（ブラウザ環境をシミュレート）
 * - setupFiles: テスト前に実行するセットアップスクリプト
 * - globals: describe, it, expect などをグローバルで使用可能に
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // React プラグイン（JSX 変換など）
  plugins: [react()],
  test: {
    // jsdom でブラウザ環境をシミュレート
    // DOM API（document, window など）が使用可能になる
    environment: "jsdom",
    // テスト実行前に読み込むセットアップファイル
    // モックの設定や jest-dom のカスタムマッチャー追加を行う
    setupFiles: ["./src/test/setup.ts"],
    // describe, it, expect などをインポートなしで使用可能にする
    globals: true,
  },
});
