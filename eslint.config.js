// eslint.config.js
import pluginJs from "@eslint/js"; // Для js.configs.recommended
import pluginJest from "eslint-plugin-jest";
import globals from "globals"; // Для Node.js глобалов в других файлах
// Уберем пока Prettier и pluginN для максимального упрощения

export default [
  // Глобальные игноры
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

  // Базовые правила ESLint - применяются ко всему
  pluginJs.configs.recommended,

  // Конфигурация для файлов, НЕ являющихся тестами Jest
  {
    name: "project/non-test-files",
    files: ["**/*.js"], // Ко всем js
    ignores: [
      "__tests__/**/*.js", // КРОМЕ тестов
      "eslint.config.js", // КРОМЕ самого конфига
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      "no-console": "off",
      // Здесь пока не добавляем правила 'n/' для простоты
    },
  },

  // Конфигурация для тестовых файлов Jest, СТРОГО по документации plugin-jest
  // Она должна идти ПОСЛЕ общей конфигурации, чтобы переопределить globals
  {
    name: "project/jest-tests",
    files: ["**/*.test.js", "**/*.spec.js"], // Убедись, что это соответствует твоим тестовым файлам
    // У тебя это __tests__/**/*.js
    // Заменим на files: ["__tests__/**/*.js"],

    // Вариант А: Используем их рекомендуемую flat-конфигурацию
    ...pluginJest.configs["flat/recommended"],
    // И если нужно, добавляем свои правила или переопределяем
    // rules: {
    //   ...pluginJest.configs['flat/recommended'].rules, // Чтобы сохранить их правила
    //   "какое-то-правило-jest": "off" // Пример переопределения
    // }
  },
  /*
  // Вариант Б (если Вариант А не сработал, как было раньше): Явная настройка по их документации
  // Этот вариант мы уже пробовали, и он работал в минимальном конфиге!
  {
    name: "project/jest-tests-explicit",
    files: ["__tests__/**\/*.js"],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: pluginJest.environments.globals.globals,
    },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/valid-expect': 'error',
    },
  },
  */

  // Конфигурация для файла eslint.config.js
  {
    name: "project/eslint-config-file",
    files: ["eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      // Здесь пока не добавляем правила 'n/' для простоты
      "no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^(eslintConfigPrettier|pluginPrettier|pluginN)$",
        },
      ],
    },
  },

  // Конфигурация для папки test/ (не Jest)
  {
    name: "project/other-test-files",
    files: ["test/**/*.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-unused-vars": "off",
      "no-console": "off",
    },
  },
];
