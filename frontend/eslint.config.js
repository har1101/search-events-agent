/**
 * ESLint フラットコンフィグ設定
 *
 * CodeRabbit指摘対応: ESLint 9.x のフラットコンフィグ形式に準拠
 * 理由: defineConfig/globalIgnores は存在しないエクスポートのため、
 *       正しいフラットコンフィグの配列形式に修正
 *
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @see https://typescript-eslint.io/getting-started/
 */

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // CodeRabbit指摘対応: globalIgnores() の代わりに ignores プロパティを使用
  // 理由: ESLint フラットコンフィグでは ignores キーでグローバル除外を指定
  { ignores: ["dist"] },

  // JavaScript 推奨ルール
  js.configs.recommended,

  // TypeScript 推奨ルール（tseslint.config で正しくプラグインが登録される）
  ...tseslint.configs.recommended,

  // TypeScript/TSX ファイル用のカスタム設定
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React Hooks ルール
      ...reactHooks.configs.recommended.rules,
      // React Refresh ルール
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
);
