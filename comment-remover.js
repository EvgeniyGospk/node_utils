#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ignore from "ignore";

// --- Настройка и парсинг аргументов ---
const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("dir", {
    alias: "d",
    type: "string",
    description: "Корневая директория для обработки файлов",
    default: ".",
  })
  .option("exclude-dirs", {
    alias: "ed",
    type: "array",
    description: "Имена директорий для исключения",
    default: [
      "node_modules",
      ".git",
      "dist",
      "build",
      "coverage",
      ".vscode",
      ".idea",
    ],
  })
  .option("exclude-files", {
    alias: "ef",
    type: "array",
    description: "Шаблоны файлов для исключения (глоб-паттерны)",
    default: ["package-lock.json", "*.log", "*.min.js", "*.min.css", "*.map"],
  })
  .option("extensions", {
    alias: "ext",
    type: "array",
    description: "Расширения файлов для обработки (без точки)",
    // Основные веб + некоторые другие
    default: [
      "js",
      "jsx",
      "ts",
      "tsx",
      "mjs",
      "cjs",
      "css",
      "scss",
      "less",
      "html",
      "vue",
      "svelte",
      "json",
      "md",
      "yaml",
      "yml",
      "py",
      "java",
      "cs",
      "php",
      "rb",
      "go",
      "swift",
      "kt",
    ],
  })
  .option("dry-run", {
    alias: "dr",
    type: "boolean",
    description: "Выполнить без реального изменения файлов",
    default: false,
  })
  .option("verbose", {
    alias: "v",
    type: "boolean",
    description: "Более подробный вывод (что игнорируется)",
    default: false,
  })
  .help()
  .alias("help", "h")
  // Убрал alias -v для version, т.к. он используется для verbose
  .epilog(
    "Удаляет комментарии из указанных файлов, стараясь не затрагивать строки и regex."
  )
  .parseSync();

// --- Параметры ---
const ROOT_DIRECTORY = path.resolve(argv.dir);
const EXCLUDE_DIRS_SET = new Set(argv.excludeDirs);
const EXCLUDE_FILES_PATTERNS = argv.excludeFiles;
const ALLOWED_EXTENSIONS = new Set(
  argv.extensions.map((ext) => `.${ext.toLowerCase()}`)
);
const DRY_RUN = argv.dryRun;
const VERBOSE = argv.verbose;

// --- Регулярные выражения (для не-JS/TS) ---
const multiLineCommentRegexCSS = /\/\*[\s\S]*?\*\//g; // CSS/SCSS/Less
const htmlCommentRegex = /<!--[\s\S]*?-->/g; // HTML/XML/Vue/Svelte
const hashCommentRegex = /#.*$/gm; // Python, Ruby, Yaml, Shell
const cStyleSingleLineRegex = /\/\/.*$/gm; // Java, C#, Go, Swift, Kotlin, PHP (иногда)
const cStyleMultiLineRegex = /\/\*[\s\S]*?\*\//g; // Java, C#, Go, Swift, Kotlin, PHP

// --- Инициализация `ignore` ---
const ig = ignore();
ig.add(argv.excludeDirs.map((dir) => `${dir}/`));
ig.add(EXCLUDE_FILES_PATTERNS);

// Загрузка .gitignore
let gitignoreLoaded = false;
try {
  const gitignorePath = path.join(ROOT_DIRECTORY, ".gitignore");
  const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
  ig.add(gitignoreContent);
  gitignoreLoaded = true;
} catch {
  // Игнорируем ошибку, если .gitignore нет
}

// --- Улучшенная функция удаления комментариев для JS/TS/JSX/TSX ---
function removeJsTsComments(code) {
  let result = "";
  let inMultiLineComment = false;
  let inSingleLineComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let inRegexLiteral = false;
  let isEscaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prevChar = i > 0 ? code[i - 1] : null;
    const nextChar = i < code.length - 1 ? code[i + 1] : null;

    if (isEscaped) {
      isEscaped = false;
      // Если мы были в комментарии, символ после экранирования все равно пропускаем
      // Иначе - добавляем его как есть
      if (!inMultiLineComment && !inSingleLineComment) {
        result += char;
      }
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      // Добавляем сам \ если он не в комментарии
      if (!inMultiLineComment && !inSingleLineComment) {
        result += char;
      }
      continue;
    }

    // Обработка многострочных комментариев /* ... */
    if (
      !inSingleQuote &&
      !inDoubleQuote &&
      !inTemplateLiteral &&
      !inRegexLiteral
    ) {
      if (char === "/" && nextChar === "*") {
        if (!inMultiLineComment) {
          // Начало комментария
          inMultiLineComment = true;
          i++; // Пропускаем *
          continue;
        }
      } else if (char === "*" && nextChar === "/") {
        if (inMultiLineComment) {
          // Конец комментария
          inMultiLineComment = false;
          i++; // Пропускаем /
          continue;
        }
      }
    }

    // Если внутри многострочного комментария, пропускаем символ
    if (inMultiLineComment) {
      continue;
    }

    // Обработка однострочных комментариев // ...
    if (
      !inSingleQuote &&
      !inDoubleQuote &&
      !inTemplateLiteral &&
      !inRegexLiteral
    ) {
      if (char === "/" && nextChar === "/") {
        if (!inSingleLineComment) {
          // Начало комментария
          inSingleLineComment = true;
          i++; // Пропускаем второй /
          continue;
        }
      } else if (char === "\n") {
        if (inSingleLineComment) {
          // Конец комментария
          inSingleLineComment = false;
          // Добавляем сам перенос строки, так как он не часть комментария
          result += char;
          continue;
        }
      }
    }

    // Если внутри однострочного комментария (и это не \n), пропускаем символ
    if (inSingleLineComment) {
      continue;
    }

    // Обработка строк
    if (!inRegexLiteral) {
      if (char === "'" && !inDoubleQuote && !inTemplateLiteral) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inTemplateLiteral) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === "`" && !inSingleQuote && !inDoubleQuote) {
        inTemplateLiteral = !inTemplateLiteral;
      }
    }

    // Обработка регулярных выражений (упрощенная, но лучше чем ничего)
    // Стараемся определить, является ли / началом regex или оператором деления
    if (
      !inSingleQuote &&
      !inDoubleQuote &&
      !inTemplateLiteral &&
      !inMultiLineComment &&
      !inSingleLineComment
    ) {
      if (char === "/") {
        // Очень грубая проверка: если / идет после определенных символов, считаем regex
        // Не идеально, но отсекает большинство случаев деления
        const prevNonWs = (() => {
          for (let j = i - 1; j >= 0; j--) {
            if (!/\s/.test(code[j])) return code[j];
          }
          return null;
        })();

        if (
          !inRegexLiteral &&
          [
            "(",
            ",",
            "=",
            ":",
            "[",
            "!",
            "&",
            "|",
            "?",
            "{",
            "}",
            ";",
            "\n",
            null,
          ].includes(prevNonWs)
        ) {
          inRegexLiteral = true;
        } else if (inRegexLiteral) {
          // Конец regex, если / не экранирован и не начало классового символа [...]
          if (prevChar !== "\\" && prevChar !== "[") {
            // Простая проверка на экранирование и классы
            inRegexLiteral = false;
          }
        }
      }
    }

    // Добавляем символ в результат, если он не является частью комментария
    result += char;
  }

  return result;
}

// --- Функция удаления комментариев из одного файла ---
async function removeCommentsFromFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return; // Пропускаем нецелевые расширения
  }

  try {
    const originalContent = await fs.readFile(filePath, "utf8");
    let newContent = originalContent;

    const jsTsExtensions = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
    const cssLikeExtensions = [".css", ".scss", ".less"];
    const htmlLikeExtensions = [".html", ".vue", ".svelte", ".xml", ".svg"];
    const hashCommentLangs = [".py", ".rb", ".yml", ".yaml"]; // .sh, .pl etc.
    const cStyleLangs = [".java", ".cs", ".go", ".swift", ".kt", ".php"]; // PHP поддерживает и #, и //, и /* */

    if (jsTsExtensions.includes(extension)) {
      newContent = removeJsTsComments(originalContent);
    } else if (cssLikeExtensions.includes(extension)) {
      newContent = newContent.replace(multiLineCommentRegexCSS, "");
    } else if (htmlLikeExtensions.includes(extension)) {
      newContent = newContent.replace(htmlCommentRegex, "");
      // TODO: Потенциально можно вызывать removeJsTsComments/removeCssComments для <script>/<style>
    } else if (hashCommentLangs.includes(extension)) {
      newContent = newContent.replace(hashCommentRegex, "");
    } else if (cStyleLangs.includes(extension)) {
      newContent = newContent.replace(cStyleSingleLineRegex, "");
      newContent = newContent.replace(cStyleMultiLineRegex, "");
      if (extension === ".php") {
        // PHP может иметь #
        newContent = newContent.replace(hashCommentRegex, "");
      }
    } else if (extension === ".json") {
      // JSON формально не поддерживает комментарии, не трогаем
    } else if (extension === ".md") {
      // Markdown может иметь HTML комментарии
      newContent = newContent.replace(htmlCommentRegex, "");
    }

    // Убираем лишние пустые строки, которые могли образоваться
    // Удаляет строки, состоящие только из пробельных символов
    newContent = newContent.replace(/^[ \t]*[\r\n]/gm, "");
    // Удаляет множественные пустые строки, оставляя одну
    newContent = newContent.replace(/(\r?\n){2,}/g, "\n\n");

    if (newContent !== originalContent) {
      const relativePath = path.relative(ROOT_DIRECTORY, filePath);
      if (DRY_RUN) {
        console.log(
          `[DRY RUN] 🧹 Комментарии будут удалены из: ${relativePath}`
        );
        // Можно добавить вывод diff для наглядности, но это усложнит код
      } else {
        try {
          await fs.writeFile(filePath, newContent.trim() + "\n", "utf8"); // trim + \n для чистоты
          console.log(`🧹 Комментарии удалены из: ${relativePath}`);
        } catch (writeError) {
          console.error(
            `❌ Ошибка записи файла ${relativePath}: ${writeError.message}`
          );
        }
      }
    }
  } catch (error) {
    const relativePath = path.relative(ROOT_DIRECTORY, filePath);
    if (error.code === "EACCES") {
      console.warn(`⚠️ Нет доступа к файлу: ${relativePath}`);
    } else if (error.code === "EISDIR") {
      // Игнорируем
    } else if (error.code === "ENOENT") {
      console.warn(
        `⚠️ Файл не найден (возможно, удален во время работы): ${relativePath}`
      );
    } else {
      console.error(
        `❌ Ошибка обработки файла ${relativePath}: ${error.message}`
      );
    }
  }
}

// --- Рекурсивная функция обхода директорий ---
async function processDirectory(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    const relativePath = path.relative(ROOT_DIRECTORY, directory);
    if (error.code === "EACCES") {
      console.warn(`⚠️ Нет доступа к директории: ${relativePath}`);
    } else {
      console.error(
        `❌ Ошибка чтения директории ${relativePath}: ${error.message}`
      );
    }
    return;
  }

  for (const entry of entries) {
    const currentPath = path.join(directory, entry.name);
    const relativePath = path.relative(ROOT_DIRECTORY, currentPath);

    if (ig.ignores(relativePath)) {
      if (VERBOSE) console.log(`-- Игнорирование (правило): ${relativePath}`);
      continue;
    }

    if (entry.isDirectory()) {
      // Доп. проверка стандартных исключений (на случай если .gitignore их разрешает)
      if (EXCLUDE_DIRS_SET.has(entry.name)) {
        if (VERBOSE)
          console.log(`-- Игнорирование (стандартное): ${relativePath}/`);
        continue;
      }
      await processDirectory(currentPath);
    } else if (entry.isFile()) {
      await removeCommentsFromFile(currentPath);
    }
  }
}

// --- Функция запуска ---
async function run() {
  console.log("--- Удаление комментариев (v1.2) ---");
  console.log(`Директория: ${ROOT_DIRECTORY}`);
  console.log(
    `Обрабатываемые расширения: ${[...ALLOWED_EXTENSIONS].join(", ")}`
  );
  console.log(`Исключенные директории: ${argv.excludeDirs.join(", ")}`);
  console.log(
    `Исключенные файлы/паттерны: ${EXCLUDE_FILES_PATTERNS.join(", ")}`
  );
  if (gitignoreLoaded) console.log("ℹ️ Используются правила из .gitignore");
  if (DRY_RUN) {
    console.log("\n⚠️ РЕЖИМ СУХОГО ЗАПУСКА (ФАЙЛЫ НЕ БУДУТ ИЗМЕНЕНЫ) ⚠️");
  }
  console.log("------------------------------------");

  try {
    console.log("\n🔍 Поиск и обработка файлов...");
    await processDirectory(ROOT_DIRECTORY);
    console.log("\n✅ Обработка завершена.");
    if (DRY_RUN) {
      console.log("ℹ️ Файлы не были изменены (--dry-run).");
    }
  } catch (error) {
    console.error("\n❌ Произошла глобальная ошибка:", error);
    process.exit(1);
  }
}

// --- Запуск ---
run();
