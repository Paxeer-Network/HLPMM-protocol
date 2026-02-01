module.exports = {
  root: true,
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "prettier/prettier": "error",
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],
  },
  overrides: [
    {
      files: ["*.ts"],
      extends: [
        "plugin:@typescript-eslint/recommended",
      ],
      rules: {
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "warn",
      },
    },
    {
      files: ["scripts/**/*.js", "test/**/*.js"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  ignorePatterns: [
    "node_modules/",
    "artifacts/",
    "cache/",
    "coverage/",
    "typechain-types/",
    "lib/",
    "out/",
  ],
};
