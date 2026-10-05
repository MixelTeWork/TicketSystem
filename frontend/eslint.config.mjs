import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["build/**", "dist/**", "node_modules/**", "**/*.d.ts"] },
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{js,mjs,ts,tsx}"],
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		plugins: { "@stylistic": stylistic, "react-hooks": reactHooks },
		rules: {
			"@stylistic/brace-style": ["error", "allman", { allowSingleLine: true }],
			"@stylistic/indent": ["error", "tab", { SwitchCase: 1 }],
			"@stylistic/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: "always" }],
			"@stylistic/semi": ["error", "always"],
			"@stylistic/comma-dangle": ["error", "always-multiline"],
			"@stylistic/arrow-parens": ["error", "as-needed"],
			"@stylistic/space-before-function-paren": ["error", { anonymous: "always", named: "never", asyncArrow: "always", catch: "always" }],
			"@stylistic/block-spacing": "error",
			"@stylistic/space-before-blocks": ["error", "always"],
			"@stylistic/space-in-parens": ["error", "never"],
			"@stylistic/comma-spacing": ["error", { before: false, after: true }],
			"@stylistic/object-curly-spacing": ["error", "always"],
			"@stylistic/keyword-spacing": ["error", { before: true, after: true }],
			"@stylistic/space-infix-ops": "error",
			"@stylistic/arrow-spacing": "error",
			"@stylistic/semi-spacing": "error",
			"@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
			"no-unused-vars": "off",
			"no-empty": ["error", { allowEmptyCatch: true }],
			"no-case-declarations": "off",
			"prefer-const": "error",
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
		},
	},
);
