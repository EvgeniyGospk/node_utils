// eslint.config.js
import pluginJs from "@eslint/js";
import pluginJest from "eslint-plugin-jest";
import globals from "globals";
import pluginN from "eslint-plugin-n";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginPrettier from "eslint-plugin-prettier";

export default [
  // 1. Глобальные игноры
  {
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      "*.txt",
      "ai_session_context.md",
      "directory_tree.txt",
    ],
  },

  // 2. Базовые рекомендуемые правила ESLint
  pluginJs.configs.recommended,

  // 3. Конфигурация для ОСНОВНЫХ .js файлов
  {
    name: "project/source-files",
    files: ["**/*.js"],
    ignores: ["__tests__/**/*.js", "eslint.config.js", "test/**/*.js"],
    plugins: { n: pluginN, prettier: pluginPrettier },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      ...eslintConfigPrettier.rules,
      "prettier/prettier": "warn",
      "no-console": "off",
      "n/no-deprecated-api": "error",
      "n/no-unpublished-bin": "error",
      "n/no-unsupported-features/es-builtins": [
        "error",
        { version: ">=16.0.0" },
      ],
      "n/no-unsupported-features/es-syntax": [
        "error",
        { version: ">=16.0.0", ignores: [] },
      ],
      "n/no-unsupported-features/node-builtins": [
        "error",
        { version: ">=16.0.0" },
      ],
      "n/process-exit-as-throw": "error",
      "n/shebang": "error",
    },
  },

  // 4. Конфигурация для тестовых файлов Jest
  {
    name: "project/jest-tests",
    files: ["__tests__/**/*.js"],
    // Сначала применяем рекомендуемую конфигурацию Jest для flat config
    // Это должно принести с собой languageOptions с jest globals и базовые правила jest.
    ...pluginJest.configs["flat/recommended"],

    // Затем ДОПОЛНЯЕМ или ПЕРЕОПРЕДЕЛЯЕМ плагины и правила.
    // Если мы определяем новый объект `plugins` или `rules`,
    // то то, что было в `...pluginJest.configs['flat/recommended']` для `plugins` и `rules`
    // может быть перетерто, если ключи совпадают.
    // Поэтому, если мы определяем `plugins` здесь, нужно снова включить `jest`.
    plugins: {
      jest: pluginJest, // <--- ЯВНО УКАЗЫВАЕМ JEST ПЛАГИН ЗДЕСЬ
      prettier: pluginPrettier,
      n: pluginN,
    },
    // languageOptions из `flat/recommended` должны остаться, если мы их не переопределяем.
    // Если хотим быть уверены или дополнить:
    // languageOptions: {
    //   globals: {
    //     ...pluginJest.environments.globals.globals, // Гарантируем Jest глобалы
    //     myCustomTestGlobal: true, // Пример добавления своего
    //   }
    // },
    rules: {
      // Сначала правила Prettier
      ...eslintConfigPrettier.rules,
      "prettier/prettier": "warn",

      // Потом можно добавить/переопределить правила Jest.
      // Многие уже будут из `flat/recommended`.
      "jest/no-commented-out-tests": "warn",
      // "jest/no-disabled-tests": "warn", // уже должно быть
      // "jest/no-focused-tests": "error", // уже должно быть
      // "jest/no-identical-title": "error", // уже должно быть
      // "jest/valid-expect": "error", // уже должно быть

      // Другие правила
      "no-console": "off",
      "n/no-unpublished-import": "off",
      "n/no-extraneous-import": "off",
      "n/no-missing-import": "off",
    },
  },

  // 5. Конфигурация для файла eslint.config.js
  {
    name: "project/eslint-config-file",
    files: ["eslint.config.js"],
    plugins: { n: pluginN },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "n/no-unpublished-import": "off",
      "n/no-extraneous-import": "off",
      "no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^(eslintConfigPrettier)$" },
      ],
    },
  },

  // 6. Конфигурация для папки test/ (не Jest)
  {
    name: "project/other-test-files",
    files: ["test/**/*.js"],
    languageOptions: { globals: { ...globals.node } },
    plugins: { n: pluginN, prettier: pluginPrettier },
    rules: {
      ...eslintConfigPrettier.rules,
      "prettier/prettier": "warn",
      "no-unused-vars": "off",
      "no-console": "off",
    },
  },
];
