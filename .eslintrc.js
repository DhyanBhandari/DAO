module.exports = {
    env: {
      browser: false,
      es2021: true,
      mocha: true,
      node: true,
    },
    extends: [
      "standard",
      "plugin:prettier/recommended",
      "plugin:node/recommended",
    ],
    parserOptions: {
      ecmaVersion: 12,
    },
    overrides: [
      {
        files: ["hardhat.config.js"],
        globals: { task: true },
      },
      {
        files: ["scripts/**"],
        rules: { "no-process-exit": "off" },
      },
      {
        files: ["*.js"],
        rules: {
          "node/no-unpublished-require": "off",
        },
      },
    ],
    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
      "node/no-unsupported-features/es-syntax": [
        "error",
        { ignores: ["modules"] },
      ],
      "node/no-missing-import": "off",
    },
  };