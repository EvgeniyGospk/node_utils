#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// --- Настройка и парсинг аргументов командной строки ---
const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("output", {
    alias: "o",
    type: "string",
    description: "Имя файла для вывода дерева каталогов",
    default: "directory_tree.txt",
  })
  .option("dir", {
    alias: "d",
    type: "string",
    description: "Корневая директория для построения дерева",
    default: ".", // Текущая директория по умолчанию
  })
  .option("exclude-dirs", {
    alias: "ed",
    type: "array",
    description:
      "Имена директорий для исключения (можно указать несколько раз)",
    default: ["node_modules", ".git"], // Стандартные исключения
  })
  .option("max-depth", {
    alias: "md",
    type: "number",
    description: "Максимальная глубина сканирования (0 - только корень)",
    // default: Infinity // Можно сделать без ограничения по умолчанию
  })
  .help()
  .alias("help", "h")
  .alias("version", "v")
  .epilog("Генерирует текстовое представление дерева каталогов.")
  .parseSync();

// --- Параметры ---
const ROOT_DIRECTORY = path.resolve(argv.dir);
const OUTPUT_FILENAME = argv.output;
const OUTPUT_FILEPATH = path.resolve(process.cwd(), OUTPUT_FILENAME);
const EXCLUDE_DIRS_SET = new Set(argv.excludeDirs); // Используем Set для быстрого поиска
const MAX_DEPTH = argv.maxDepth ?? Infinity; // Если не указано, глубина не ограничена

// Символы для отрисовки дерева
const TEE = "├── ";
const ELBOW = "└── ";
const PIPE = "│   ";
const SPACE = "    ";

// --- Основная рекурсивная функция для построения дерева ---
async function generateTree(directory, currentDepth, prefix = "") {
  if (currentDepth > MAX_DEPTH) {
    return ""; // Прекращаем рекурсию, если достигли максимальной глубины
  }

  let treeString = "";
  let entries;

  try {
    // Читаем содержимое директории, получая типы (файл/директория)
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "EACCES") {
      return `${prefix}${ELBOW} [Нет доступа] ${path.basename(directory)}\n`;
    } else {
      console.error(
        `\n❌ Ошибка чтения директории ${directory}: ${error.message}`
      );
      return `${prefix}${ELBOW} [Ошибка чтения] ${path.basename(directory)}\n`;
    }
  }

  // Фильтруем исключенные директории и сам выходной файл (если он в этой папке)
  const filteredEntries = entries.filter(
    (entry) =>
      !EXCLUDE_DIRS_SET.has(entry.name) &&
      path.join(directory, entry.name) !== OUTPUT_FILEPATH // Не показываем сам выходной файл
  );

  // Сортируем: сначала директории, потом файлы (алфавитно внутри групп)
  filteredEntries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const count = filteredEntries.length;
  for (let i = 0; i < count; i++) {
    const entry = filteredEntries[i];
    const isLast = i === count - 1; // Последний ли элемент в списке?

    const connector = isLast ? ELBOW : TEE;
    const entryPath = path.join(directory, entry.name);

    treeString += `${prefix}${connector}${entry.name}\n`;

    if (entry.isDirectory()) {
      // Определяем префикс для следующего уровня
      const nextPrefix = prefix + (isLast ? SPACE : PIPE);
      // Рекурсивно вызываем для поддиректории
      treeString += await generateTree(entryPath, currentDepth + 1, nextPrefix);
    }
  }

  return treeString;
}

// --- Функция запуска ---
async function run() {
  console.log("--- Генерация дерева каталогов ---");
  console.log(`Корневая директория: ${ROOT_DIRECTORY}`);
  console.log(`Выходной файл: ${OUTPUT_FILEPATH}`);
  console.log(
    `Исключенные директории: ${argv.excludeDirs.join(", ") || "Нет"}`
  );
  if (MAX_DEPTH !== Infinity) {
    console.log(`Максимальная глубина: ${MAX_DEPTH}`);
  }
  console.log("---------------------------------\n");

  try {
    // Добавляем имя корневой директории в начало вывода
    const rootDirName = path.basename(ROOT_DIRECTORY) || ROOT_DIRECTORY; // На случай если указали '/' или '.'
    let finalTree = `${rootDirName}\n`;

    console.log("🌳 Построение дерева...");
    finalTree += await generateTree(ROOT_DIRECTORY, 0); // Начинаем с глубины 0

    console.log(`\n💾 Запись дерева в файл: ${OUTPUT_FILEPATH}`);
    await fs.writeFile(OUTPUT_FILEPATH, finalTree.trim() + "\n", "utf8");

    console.log(
      `\n✅ Успешно! Дерево каталогов сохранено в ${OUTPUT_FILENAME}`
    );
  } catch (error) {
    console.error("\n❌ Произошла ошибка при генерации дерева:", error);
    process.exit(1);
  }
}

// --- Запуск ---
run();
