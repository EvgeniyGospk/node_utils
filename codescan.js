#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ignore from "ignore"; // Убедись, что пакет установлен

// --- Получаем абсолютный путь к текущему скрипту ---
const __filename = fileURLToPath(import.meta.url);
const SCRIPT_BASENAME = path.basename(__filename);

// --- Настройка и парсинг аргументов командной строки ---
const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("output", {
    alias: "o",
    type: "string",
    description: "Имя выходного файла",
    default: "all_code_output.txt",
  })
  .option("dir", {
    alias: "d",
    type: "string",
    description: "Директория для сканирования",
    default: ".",
  })
  .option("only-files", {
    alias: "of",
    type: "array",
    description:
      "Обрабатывать только файлы с этими именами (можно указать несколько раз)",
    default: [],
  })
  .option("include-exts", {
    alias: "ie",
    type: "array",
    description:
      "Расширения файлов для включения (игнорируется, если указан --only-files)",
    // --- Default extensions now include .tsx and .jsx ---
    default: [
      ".js",
      ".mjs",
      ".cjs",
      ".json",
      ".html",
      ".css",
      ".cs",
      ".tsx",
      ".jsx",
      ".ts",
    ],
    // --- End of modification ---
  })
  .option("exclude-files", {
    // Проверяем эту опцию
    alias: "ef",
    type: "array",
    description: "Паттерны файлов для исключения (можно использовать glob)",
    default: ["package-lock.json"], // Убираем дефолт, чтобы точно видеть, передалось ли что-то
  })
  .option("exclude-dirs", {
    alias: "ed",
    type: "array",
    description: "Паттерны директорий для исключения (можно использовать glob)",
    default: ["node_modules", ".git"], // Стандартные оставляем как дефолт
  })
  // .option("use-gitignore", { ... }) // Функционал .gitignore убран
  .help()
  .alias("help", "h")
  .alias("version", "v")
  .epilog("Собирает содержимое указанных типов файлов в один.")
  .parseSync(); // Используем sync для простоты в CLI

// --- ОТЛАДОЧНЫЙ ЛОГ: Проверка распарсенных аргументов ---
console.log("--- [DEBUG] Parsed argv ---");
console.dir(argv, { depth: 3 }); // Показываем argv с большей глубиной для массивов
console.log("--------------------------");
// --- КОНЕЦ ОТЛАДОЧНОГО ЛОГА ---

// --- Формируем параметры сканирования ---
const OUTPUT_FILENAME = argv.output;
const SCAN_DIRECTORY = path.resolve(argv.dir);
const INCLUDE_EXTENSIONS = argv.includeExts.map((ext) =>
  ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
);
const ONLY_FILES_LIST = argv.onlyFiles;
const IS_ONLY_FILES_MODE = ONLY_FILES_LIST.length > 0;

// --- Инициализация обработчика игнорирования ---
function createIgnoreMatcher(baseDir) {
  // Функция теперь синхронная
  let ig;
  try {
    ig = ignore(); // Создаем экземпляр ignore
  } catch (err) {
    console.error("--- [DEBUG] ОШИБКА при вызове ignore() ---", err);
    // Если сам вызов ignore() падает, возвращаем null или бросаем ошибку
    // чтобы это было видно при проверке дальше
    return null;
  }

  console.log("--- [DEBUG] Создание ignoreMatcher (без .gitignore) ---");

  // 1. Базовые исключения (скрипт, выходной файл)
  // Исключаем по полному относительному пути от baseDir, если возможно
  const selfScriptRelativePath = path.relative(baseDir, __filename);
  if (selfScriptRelativePath && !selfScriptRelativePath.startsWith("..")) {
    ig.add(selfScriptRelativePath);
    console.log(
      `[DEBUG] Добавлено правило игнорирования (скрипт): ${selfScriptRelativePath}`
    );
  } else {
    // Фоллбэк на имя файла, если скрипт вне директории сканирования
    const selfScriptPattern = `**/${SCRIPT_BASENAME}`;
    ig.add(selfScriptPattern);
    console.log(
      `[DEBUG] Добавлено правило игнорирования (скрипт, fallback): ${selfScriptPattern}`
    );
  }

  const outputFilePath = path.resolve(process.cwd(), OUTPUT_FILENAME); // Полный путь к вых. файлу
  const outputRelativePath = path.relative(baseDir, outputFilePath);
  if (outputRelativePath && !outputRelativePath.startsWith("..")) {
    ig.add(outputRelativePath);
    console.log(
      `[DEBUG] Добавлено правило игнорирования (вых. файл): ${outputRelativePath}`
    );
  } else {
    const outputFilenamePattern = `**/${OUTPUT_FILENAME}`;
    ig.add(outputFilenamePattern);
    console.log(
      `[DEBUG] Добавлено правило игнорирования (вых. файл, fallback): ${outputFilenamePattern}`
    );
  }

  // --- ИСКЛЮЧЕНИЯ ИЗ ОПЦИЙ ---
  // Убедимся, что argv.excludeFiles существует и является массивом
  if (Array.isArray(argv.excludeFiles) && argv.excludeFiles.length > 0) {
    console.log("[DEBUG] Добавление правил из --exclude-files:");
    argv.excludeFiles.forEach((pattern) => {
      const rule = pattern.includes("/") ? pattern : `**/${pattern}`;
      ig.add(rule);
      console.log(`  -> ${rule}`);
    });
  } else {
    console.log("[DEBUG] Правила из --exclude-files не найдены или пусты.");
  }

  // Убедимся, что argv.excludeDirs существует и является массивом
  if (Array.isArray(argv.excludeDirs) && argv.excludeDirs.length > 0) {
    console.log("[DEBUG] Добавление правил из --exclude-dirs:");
    argv.excludeDirs.forEach((pattern) => {
      const rule = pattern.endsWith("/") ? pattern : `${pattern}/`;
      const finalRule = pattern.includes("/") ? rule : `**/${rule}`;
      ig.add(finalRule);
      console.log(`  -> ${finalRule}`);
      // Добавим и просто имя без **/, если оно простое (без слешей)
      if (!pattern.includes("/")) {
        ig.add(pattern);
        console.log(`  -> ${pattern} (дополнительно)`);
      }
    });
  } else {
    console.log(
      "[DEBUG] Правила из --exclude-dirs не найдены или пусты (используются только дефолтные, если они были)."
    );
    // Если дефолтные были перезаписаны пустым массивом, их не будет.
    // Добавим стандартные сюда на всякий случай, если они могли пропасть из-за yargs
    console.log(
      "[DEBUG] Добавляем стандартные исключения dirs на всякий случай:"
    );
    ["node_modules", ".git"].forEach((pattern) => {
      ig.add(`**/${pattern}/`);
      console.log(`  -> **/${pattern}/`);
      ig.add(pattern);
      console.log(`  -> ${pattern} (дополнительно)`);
    });
  }

  // --- ОТЛАДОЧНЫЙ ЛОГ: Проверка перед возвратом ---
  console.log("--- [DEBUG] Проверка ignoreMatcher перед возвратом ---");
  console.log(`[DEBUG] Тип объекта ig: ${typeof ig}`);
  console.log(
    `[DEBUG] Наличие метода ig.ignores: ${typeof ig?.ignores === "function"}`
  );
  console.log("-------------------------------------------");
  // --- КОНЕЦ ОТЛАДОЧНОГО ЛОГА ---

  return ig; // Возвращаем созданный объект
}

// --- Основная функция сканирования ---
async function getAllCodeInDirectory(
  directory,
  baseScanDirectory,
  ignoreMatcher, // <-- Получаем матчер
  includeExts,
  isOnlyFilesMode,
  onlyFilesList
) {
  const relativeDirPath = path.relative(baseScanDirectory, directory) || ".";
  console.log(`🔍 Сканирую директорию: ${relativeDirPath}`);

  // --- ОТЛАДОЧНЫЙ ЛОГ: Проверка полученного ignoreMatcher ---
  console.log(
    `--- [DEBUG] Проверка ignoreMatcher при входе в getAllCodeInDirectory (${relativeDirPath}) ---`
  );
  console.log(`[DEBUG] Тип полученного ignoreMatcher: ${typeof ignoreMatcher}`);
  // Добавим проверку на null, который мог вернуться из createIgnoreMatcher при ошибке
  const hasIgnoresMethod =
    ignoreMatcher && typeof ignoreMatcher.ignores === "function";
  console.log(
    `[DEBUG] Наличие метода ignoreMatcher.ignores: ${hasIgnoresMethod}`
  );
  console.log("-------------------------------------------------------------");
  // --- КОНЕЦ ОТЛАДОЧНОГО ЛОГА ---

  // Если ignoreMatcher не создан или сломан, прерываем сканирование этой ветки
  if (!hasIgnoresMethod) {
    console.error(
      `❌ [FATAL] Невалидный ignoreMatcher в директории ${relativeDirPath}. Прерываю сканирование этой ветки.`
    );
    return { content: "", count: 0 }; // Возвращаем пустой результат
  }

  let allContent = "";
  let processedFilesCount = 0;

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      // Путь относительно БАЗОВОЙ директории сканирования для ignore
      const relativePathForIgnore = path.relative(baseScanDirectory, entryPath);

      if (!relativePathForIgnore) continue; // Пропускаем корень (пустой отн. путь)

      // Добавляем слеш для директорий при проверке
      const pathToCheck = entry.isDirectory()
        ? `${relativePathForIgnore}/`
        : relativePathForIgnore;

      // --- ОТЛАДОЧНЫЙ ЛОГ: Проверка пути перед ignore ---
      // console.log(`  [DEBUG] Проверяю путь для ignore: '${pathToCheck}'`); // Раскомментировать при необходимости (очень много вывода)
      // --- КОНЕЦ ОТЛАДОЧНОГО ЛОГА ---

      // Проверка игнорирования
      if (ignoreMatcher.ignores(pathToCheck)) {
        const type = entry.isDirectory() ? "директорию" : "файл";
        console.log(
          `   -> Игнорирую ${type} (правило): ${relativePathForIgnore}`
        );
        continue; // Пропускаем этот элемент
      }

      // Если не игнорируется:
      if (entry.isDirectory()) {
        // console.log(`   -> Вхожу в директорию: ${relativePathForIgnore}`); // Можно раскомментировать
        const { content: subContent, count: subCount } =
          await getAllCodeInDirectory(
            entryPath,
            baseScanDirectory,
            ignoreMatcher, // Передаем дальше
            includeExts,
            isOnlyFilesMode,
            onlyFilesList
          );
        allContent += subContent;
        processedFilesCount += subCount;
      } else if (entry.isFile()) {
        const relativeFilePath = relativePathForIgnore;
        let shouldInclude = false;

        // Логика включения файла
        if (isOnlyFilesMode) {
          if (onlyFilesList.includes(entry.name)) {
            shouldInclude = true;
          }
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (includeExts.includes(ext)) {
            shouldInclude = true;
          } else {
            // Закомментируем лог пропуска по расширению, чтобы не загромождать вывод
            // console.log(`   -> Пропускаю файл (расширение ${ext}): ${relativeFilePath}`);
          }
        }

        if (shouldInclude) {
          try {
            console.log(`   -> Читаю файл: ${relativeFilePath}`);
            const fileContent = await fs.readFile(entryPath, "utf8");
            allContent += `--- File: ${relativeFilePath} ---\n\n`;
            allContent += fileContent.trim();
            allContent += `\n\n--- End of File: ${relativeFilePath} ---\n\n\n`;
            processedFilesCount++;
          } catch (readError) {
            console.error(
              `   ❌ Ошибка чтения файла ${relativeFilePath}:`,
              readError.message
            );
          }
        }
      }
    }
  } catch (dirError) {
    if (dirError.code === "EACCES") {
      console.warn(
        `   ⚠️ Нет доступа к директории ${relativeDirPath}, пропускаю.`
      );
    } else {
      // Выводим ошибку, но не прерываем выполнение полностью
      console.error(
        `❌ Ошибка чтения директории ${relativeDirPath}:`,
        dirError.message // Не выводим полный стек по умолчанию
      );
      // Не бросаем ошибку дальше, чтобы попытаться обработать другие ветки
    }
  }

  return { content: allContent, count: processedFilesCount };
}

// --- Функция запуска ---
async function run() {
  console.log("--- Запуск code-scanner ---");
  console.log(`Директория сканирования: ${SCAN_DIRECTORY}`);
  console.log(`Выходной файл: ${OUTPUT_FILENAME}`);
  if (IS_ONLY_FILES_MODE) {
    console.log(`Режим: Только файлы [${ONLY_FILES_LIST.join(", ")}]`);
  } else {
    console.log(`Включаемые расширения: ${INCLUDE_EXTENSIONS.join(", ")}`); // Теперь покажет .tsx и .jsx
  }
  // Логи для переданных исключений
  console.log(`Исключаемые файлы (передано): ${argv.ef?.join(", ") || "Нет"}`); // Используем короткое имя 'ef'
  console.log(
    `Исключаемые директории (передано): ${argv.ed?.join(", ") || "Нет"}`
  ); // Используем короткое имя 'ed'
  console.log("---------------------------\n");

  let ignoreMatcher; // Объявим здесь
  try {
    // Создаем обработчик игнорирования СИНХРОННО
    ignoreMatcher = createIgnoreMatcher(SCAN_DIRECTORY);

    // Дополнительная проверка после создания
    if (!ignoreMatcher || typeof ignoreMatcher.ignores !== "function") {
      console.error(
        "❌ [FATAL] Не удалось создать корректный ignoreMatcher. Выполнение прервано."
      );
      process.exit(1); // Выходим, так как без матчера продолжать нет смысла
    }

    const { content, count } = await getAllCodeInDirectory(
      SCAN_DIRECTORY,
      SCAN_DIRECTORY, // Передаем как базовую директорию
      ignoreMatcher, // Передаем созданный матчер
      INCLUDE_EXTENSIONS,
      IS_ONLY_FILES_MODE,
      ONLY_FILES_LIST
    );

    if (count === 0 && content.length === 0) {
      // Проверяем и контент на случай ошибок
      console.log(
        "\n✅ Не найдено подходящих файлов для включения или произошли ошибки при сканировании."
      );
      // Не выходим с ошибкой, просто констатируем факт
      return;
    } else if (count === 0 && content.length > 0) {
      console.log(
        "\n⚠️ Не найдено подходящих файлов, но был собран контент (возможно, только разделители). Проверьте вывод."
      );
    }

    const outputFilePath = path.resolve(process.cwd(), OUTPUT_FILENAME);
    console.log(`\n💾 Записываю результат в файл: ${outputFilePath}`);

    await fs.writeFile(outputFilePath, content.trim() + "\n"); // Убираем лишние пробелы/переносы строк в конце

    console.log(
      `\n✅ Успешно! Содержимое ${count} файлов записано в ${OUTPUT_FILENAME}`
    );
  } catch (error) {
    // Ловим ошибки, которые могли возникнуть в run (например, при записи файла)
    // или если getAllCodeInDirectory все же бросит ошибку (хотя он пытается этого не делать)
    console.error("\n❌ Произошла общая ошибка выполнения скрипта:", error);
    // console.error(error.stack); // Раскомментировать для полного стека
    process.exit(1); // Выходим с кодом ошибки
  }
}

// --- Запускаем выполнение ---
run();
