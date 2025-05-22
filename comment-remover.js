#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ignore from "ignore";
import { fileURLToPath } from "url"; // Импорт для определения прямого запуска

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
const multiLineCommentRegexCSS = /\/\*[\s\S]*?\*\//g;
const htmlCommentRegex = /<!--[\s\S]*?-->/g;
const hashCommentRegex = /#.*$/gm;
const cStyleSingleLineRegex = /\/\/.*$/gm;
const cStyleMultiLineRegex = /\/\*[\s\S]*?\*\//g;

// --- Инициализация `ignore` ---
const ig = ignore();
let gitignoreLoaded = false;

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
      if (!inMultiLineComment && !inSingleLineComment) {
        result += char;
      }
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      if (!inMultiLineComment && !inSingleLineComment) {
        result += char;
      }
      continue;
    }

    if (
      !inSingleQuote &&
      !inDoubleQuote &&
      !inTemplateLiteral &&
      !inRegexLiteral
    ) {
      if (char === "/" && nextChar === "*") {
        if (code[i + 2] === "*" && code[i + 3] !== "/") {
          // JSDoc, не удаляем
        } else if (!inMultiLineComment) {
          inMultiLineComment = true;
          i++;
          continue;
        }
      } else if (char === "*" && nextChar === "/") {
        if (inMultiLineComment) {
          inMultiLineComment = false;
          i++;
          continue;
        }
      }
    }

    if (inMultiLineComment) {
      continue;
    }

    if (
      !inSingleQuote &&
      !inDoubleQuote &&
      !inTemplateLiteral &&
      !inRegexLiteral
    ) {
      if (char === "/" && nextChar === "/") {
        if (!inSingleLineComment) {
          inSingleLineComment = true;
          i++;
          continue;
        }
      } else if (char === "\n") {
        if (inSingleLineComment) {
          inSingleLineComment = false;
          result += char;
          continue;
        }
      }
    }

    if (inSingleLineComment) {
      continue;
    }

    if (!inRegexLiteral && !inTemplateLiteral) {
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
    }
    if (char === "`" && !inSingleQuote && !inDoubleQuote && !inRegexLiteral) {
      inTemplateLiteral = !inTemplateLiteral;
    }

    if (
      !inSingleQuote &&
      !inDoubleQuote &&
      !inTemplateLiteral &&
      !inMultiLineComment &&
      !inSingleLineComment
    ) {
      if (char === "/") {
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
          if (prevChar !== "\\" && prevChar !== "[") {
            inRegexLiteral = false;
          }
        }
      }
    }
    result += char;
  }
  return result;
}

// --- Функция удаления комментариев из одного файла ---
async function removeCommentsFromFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return;
  }

  try {
    const originalContent = await fs.readFile(filePath, "utf8");
    let newContent = originalContent;

    const jsTsExtensions = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
    const cssLikeExtensions = [".css", ".scss", ".less"];
    const htmlLikeExtensions = [".html", ".vue", ".svelte", ".xml", ".svg"];
    const hashCommentLangs = [".py", ".rb", ".yml", ".yaml"];
    const cStyleLangs = [".java", ".cs", ".go", ".swift", ".kt", ".php"];

    if (jsTsExtensions.includes(extension)) {
      newContent = removeJsTsComments(originalContent);
    } else if (cssLikeExtensions.includes(extension)) {
      newContent = newContent.replace(multiLineCommentRegexCSS, ""); // /* ... */
      // Для SCSS и Less также удаляем однострочные комментарии //
      if (extension === ".scss" || extension === ".less") {
        if (VERBOSE && newContent.includes("//"))
          console.log(
            `   -> Применение удаления // для ${path.basename(filePath)}`
          );
        newContent = newContent.replace(cStyleSingleLineRegex, "");
      }
    } else if (htmlLikeExtensions.includes(extension)) {
      // Сначала удаляем HTML-комментарии <!-- ... -->
      newContent = newContent.replace(htmlCommentRegex, "");

      // Пытаемся обработать <script> теги (упрощенный подход)
      newContent = newContent.replace(
        /(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
        (match, scriptTagStart, scriptContent, scriptTagEnd) => {
          if (VERBOSE)
            console.log(
              `   -> Обработка <script> в ${path.basename(filePath)}`
            );
          return (
            scriptTagStart + removeJsTsComments(scriptContent) + scriptTagEnd
          );
        }
      );

      // Пытаемся обработать <style> теги (упрощенный подход)
      newContent = newContent.replace(
        /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
        (match, styleTagStart, styleContent, styleTagEnd) => {
          if (VERBOSE)
            console.log(`   -> Обработка <style> в ${path.basename(filePath)}`);
          let processedCss = styleContent.replace(multiLineCommentRegexCSS, "");
          if (/\blang\s*=\s*["'](scss|less)["']/i.test(styleTagStart)) {
            if (VERBOSE)
              console.log(
                `      -> Обнаружен lang="scss/less" в <style>, применяем удаление //`
              );
            processedCss = processedCss.replace(cStyleSingleLineRegex, "");
          }
          return styleTagStart + processedCss + styleTagEnd;
        }
      );
    } else if (hashCommentLangs.includes(extension)) {
      newContent = newContent.replace(hashCommentRegex, "");
    } else if (cStyleLangs.includes(extension)) {
      newContent = newContent.replace(cStyleSingleLineRegex, "");
      newContent = newContent.replace(cStyleMultiLineRegex, "");
      if (extension === ".php") {
        newContent = newContent.replace(hashCommentRegex, "");
      }
    } else if (extension === ".json") {
      // JSON не трогаем
    } else if (extension === ".md") {
      newContent = newContent.replace(htmlCommentRegex, "");
    }

    // Обработка пустых строк (менее агрессивная)
    // newContent = newContent.replace(/^[ \t]*[\r\n]/gm, ""); // Закомментировано
    newContent = newContent.replace(/(\r?\n){3,}/g, "\n\n"); // 3+ перевода в 2

    if (newContent !== originalContent) {
      const relativePath = path.relative(ROOT_DIRECTORY, filePath);
      if (DRY_RUN) {
        console.log(
          `[DRY RUN] 🧹 Комментарии будут удалены из: ${relativePath}`
        );
      } else {
        try {
          await fs.writeFile(filePath, newContent.trim() + "\n", "utf8");
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
    if (error.code === "EACCES")
      console.warn(`⚠️ Нет доступа к файлу: ${relativePath}`);
    else if (error.code === "EISDIR") {
      /* Игнорируем */
    } else if (error.code === "ENOENT")
      console.warn(`⚠️ Файл не найден: ${relativePath}`);
    else
      console.error(
        `❌ Ошибка обработки файла ${relativePath}: ${error.message}`
      );
  }
}

// --- Рекурсивная функция обхода директорий ---
async function processDirectory(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    const relativePath = path.relative(ROOT_DIRECTORY, directory);
    if (error.code === "EACCES")
      console.warn(`⚠️ Нет доступа к директории: ${relativePath}`);
    else
      console.error(
        `❌ Ошибка чтения директории ${relativePath}: ${error.message}`
      );
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
  // Загрузка .gitignore и стандартных правил игнорирования
  ig.add(argv.excludeDirs.map((dir) => `${dir}/`));
  ig.add(EXCLUDE_FILES_PATTERNS);
  try {
    const gitignorePath = path.join(ROOT_DIRECTORY, ".gitignore");
    const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
    ig.add(gitignoreContent);
    gitignoreLoaded = true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`⚠️ Ошибка при чтении .gitignore: ${error.message}`);
    }
  }

  console.log(
    "--- Удаление комментариев (v1.4 - улучшена обработка CSS/HTML) ---"
  );
  console.log(`Директория: ${ROOT_DIRECTORY}`);
  console.log(
    `Обрабатываемые расширения: ${[...ALLOWED_EXTENSIONS].join(", ")}`
  );
  console.log(`Исключенные директории: ${argv.excludeDirs.join(", ")}`);
  console.log(
    `Исключенные файлы/паттерны: ${EXCLUDE_FILES_PATTERNS.join(", ")}`
  );
  if (gitignoreLoaded) console.log("ℹ️ Используются правила из .gitignore");
  if (DRY_RUN)
    console.log("\n⚠️ РЕЖИМ СУХОГО ЗАПУСКА (ФАЙЛЫ НЕ БУДУТ ИЗМЕНЕНЫ) ⚠️");
  if (VERBOSE) console.log("ℹ️ Включен подробный вывод.");
  console.log("------------------------------------");

  try {
    console.log("\n🔍 Поиск и обработка файлов...");
    await processDirectory(ROOT_DIRECTORY);
    console.log("\n✅ Обработка завершена.");
    if (DRY_RUN) console.log("ℹ️ Файлы не были изменены (--dry-run).");
  } catch (error) {
    console.error("\n❌ Произошла глобальная ошибка:", error);
    process.exit(1);
  }
}

// --- Экспорты для тестирования ---
export { removeJsTsComments };

// --- Запуск ---
// Это условие проверяет, является ли текущий модуль главным запущенным модулем.
const scriptPath = path.resolve(process.argv[1]);
const modulePath = path.resolve(fileURLToPath(import.meta.url));

if (scriptPath === modulePath) {
  // console.log("Запускаем run() потому что scriptPath === modulePath (прямой запуск)"); // Отладка
  // console.log(`scriptPath: ${scriptPath}`);
  // console.log(`modulePath: ${modulePath}`);
  run();
} else {
  // Этот лог может быть полезен при отладке импортов/запуска, если что-то идет не так
  // console.log("НЕ запускаем run() потому что scriptPath !== modulePath (вероятно, импорт в другом модуле)");
  // console.log(`scriptPath: ${scriptPath}`);
  // console.log(`modulePath: ${modulePath}`);
}
