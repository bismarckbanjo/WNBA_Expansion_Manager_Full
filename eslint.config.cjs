const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "CODEBASE_REVIEW.html"],
  },
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
        p: "readonly",
        team: "readonly",
        slug: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { "checkLoops": false }],
      eqeqeq: ["error", "always"],
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
];
