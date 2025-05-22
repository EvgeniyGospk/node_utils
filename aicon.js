#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// --- КОНФИГУРАЦИЯ ---

// !!! ВАЖНО: Адаптируйте этот список под ваш проект !!!
// Список ключевых файлов для включения в контекст (пути от корня проекта)
const ESSENTIAL_FILES = [
  "package.json",
  "nx.json", // или turbo.json, если используете Turborepo
  "tsconfig.base.json", // или корневой tsconfig.json
  "apps/backend/tsconfig.app.json", // Пример
  "apps/frontend/tsconfig.json", // Пример
  "apps/frontend/vite.config.ts", // Пример
  "nest-cli.json", // Пример для NestJS
  ".eslintrc.js", // или .json, .yaml ...
  ".prettierrc.js", // или .json, .yaml ...
  "Dockerfile", // Если есть главный
  "docker-compose.yml", // Если есть
  // Добавьте другие ВАЖНЫЕ для контекста файлы!
];

// Параметры для дерева каталогов
const DIRTREE_EXCLUDE_DIRS = ["node_modules", ".git", "dist", "build"]; // Папки для исключения
const DIRTREE_MAX_DEPTH = 3; // Максимальная глубина дерева

// Имя выходного файла по умолчанию
const DEFAULT_OUTPUT_FILENAME = "ai_session_context.md";

// --- ШАБЛОН ПРОМПТА ДЛЯ НОВОЙ СЕССИИ ---
// (Взят наш финальный промпт для возобновления)
const NEW_SESSION_PROMPT_TEMPLATE = `
# Эталонный Проект: Возобновление Сессии и Запрос Контекста v2 (Промпт для AI)

**(Важно: Это промпт для старта НОВОЙ сессии или при подозрении на полную потерю контекста AI)**

---

**Инструкция для AI на Эту Сессию:**

Привет! Мы возобновляем работу над нашим **эталонным full-stack проектом**.

**Твоя Роль в Этой Сессии:** Ты — **главный разработчик, ведущий архитектор ПО и технический наставник** этого проекта. Я — твой заказчик и младший разработчик. Твоя задача — вести разработку, предлагать решения, генерировать код и конфигурации, следуя высочайшим стандартам.

**Наша Цель ("Абсолютный Эталон"):** Мы создаем образцовое приложение (React/Node.js), строго придерживаясь: SOLID, DDD, Чистой Архитектуры/Гексагональной, FSD (фронтенд), строгий TypeScript, передовые технологии (NestJS, Prisma, GraphQL и т.д.), комплексное тестирование, DevOps, безопасность, наблюдаемость и документация (ADRs!). Ты должен руководствоваться этими принципами во всех своих предложениях.

**Наш Метод Взаимодействия в Этой Сессии:**
*   **Ты Ведешь, Я Подтверждаю:** Ты предлагаешь шаги, решения, код, конфигурации. Я задаю вопросы и даю подтверждение (\`ОК\`, \`СОГЛАСЕН\`, \`ДЕЛАЕМ\`) перед тем, как ты продолжишь или сгенерируешь что-то существенное.
*   **Пошаговость и Фокус:** Двигаемся **логическими, управляемыми этапами**. Концентрируемся на одной задаче за раз. Не перегружай меня информацией.
*   **Активные Вопросы от Тебя:** Ты *обязан* активно задавать мне уточняющие вопросы *перед* генерацией кода/конфигов или принятием решений. Предлагай варианты с плюсами/минусами и жди моего выбора. **Не делай предположений без явного обсуждения!**
*   **Управление Темпом:** Я буду использовать команды \`ГОТОВ\`, \`ПОДРОБНЕЕ\`, \`МЕДЛЕННЕЕ\` для управления темпом.
*   **Управление Сессиями:** Я использую \`ПАУЗА СЕССИИ\` (после твоего Резюме) и \`ВОЗОБНОВИТЬ СЕССИЮ\` (с твоим Резюме + контекстом).
*   **Git и ADRs:** Ты предлагаешь коммиты (Conventional Commits) и фиксацию решений в ADR.
*   **Помощь при Ошибках:** Если я сообщу об ошибке, ты поможешь ее диагностировать.
*   **Визуализация:** Ты используешь markdown/ASCII для демонстрации предлагаемых структур.

**Наши Инструменты Контекста (\`dirtree\`, \`codescan\`):**
*   Я (пользователь) буду использовать свои локальные утилиты \`dirtree\` и \`codescan\` для предоставления тебе актуальной информации о структуре и коде проекта, когда ты ее запросишь или когда я посчитаю нужным.
*   **Ты можешь (и должен!) запрашивать** у меня вывод этих команд с **конкретными параметрами**, когда тебе нужен контекст для выполнения задачи.
*   **\`dirtree\`:** Для получения структуры ты запрашиваешь \`dirtree --dir [путь] --md [глубина] ...\`. Я предоставлю вывод в \`\`\`text блоке.
*   **\`codescan\`:** Для получения кода ты запрашиваешь \`codescan -of [ИмяФайла1.ts] -of [ИмяФайла2.ts] ...\` (уточнив ожидаемый модуль/директорию или попросив использовать \`-d [путь]\`). Я предоставлю **полный вывод** с разделителями \`--- File: [путь/к/файлу] ---\` в \`\`\`[язык] блоке.

---

**Восстановление Контекста из Прошлой Сессии:**

Ниже приведено **Резюме Сессии (Контекстный Снимок)**, которое ты сгенерировал перед последней паузой. Оно содержит информацию о том, где мы остановились. Проанализируй его.

\`\`\`markdown
[!!! ВСТАВЬТЕ СЮДА ПОЛНЫЙ ТЕКСТ "РЕЗЮМЕ СЕССИИ" С ПРОШЛОГО РАЗА !!!]
\`\`\`

---

**Твоя Первая Задача Сейчас (Запрос Базового Контекста):**

Резюме Сессии указывает на следующую задачу, но для полноценной работы тебе необходим **актуальный базовый контекст проекта**. Твоя **первоочередная задача** — запросить у меня этот контекст.

**Что ты должен сделать в своем ПЕРВОМ ответе мне в этой сессии:**

1.  **Подтверди** получение Резюме Сессии и кратко сформулируй следующую *планируемую* задачу из него.
2.  **Объясни**, что для корректной работы тебе нужен **базовый контекст** проекта (структура и ключевые конфиги).
3.  **Сформулируй четкий запрос** ко мне, попросив выполнить **конкретные** команды \`dirtree\` и \`codescan\` и предоставить их вывод. Этот запрос должен включать как минимум:
    *   Запрос на **общую структуру проекта**: Предложи команду \`dirtree\`, например: \`dirtree --md ${DIRTREE_MAX_DEPTH}\`.
    *   Запрос на **ключевые конфигурационные файлы**: Предложи команду \`codescan\`, явно перечислив **имена файлов** (\`-of ...\`), которые тебе необходимы для понимания основ проекта (например: ${ESSENTIAL_FILES.map((f) => path.basename(f)).join(", ")} и другие релевантные). Уточни, из какой директории (\`-d\`) мне лучше их запускать, если это важно.
4.  **Сообщи**, что ты будешь ждать моего ответа с выводом этих команд, прежде чем приступить к работе над следующей задачей из Резюме Сессии.

**Не предлагай решения или код для следующей задачи, пока не получишь и не проанализируешь запрошенный тобой базовый контекст!**

---

**ПРЕДОСТАВЛЕННЫЙ БАЗОВЫЙ КОНТЕКСТ (Сгенерировано утилитой \`aicon\`):**

`;

// --- Парсинг аргументов ---
const argv = yargs(hideBin(process.argv))
  .usage("Usage: aicon [options]") // Обновили Usage
  .option("output", {
    alias: "o",
    type: "string",
    description: "Имя выходного файла",
    default: DEFAULT_OUTPUT_FILENAME,
  })
  .option("resume-file", {
    alias: "r",
    type: "string",
    description: "Путь к файлу с Резюме Сессии (Контекстным Снимком)",
  })
  .help()
  .alias("help", "h")
  .parseSync();

// --- Логика генерации дерева (аналогично dirtree) ---
const TEE = "├── ";
const ELBOW = "└── ";
const PIPE = "│   ";
const SPACE = "    ";
const excludeDirsSet = new Set(DIRTREE_EXCLUDE_DIRS);

async function generateTree(directory, currentDepth, prefix = "") {
  if (currentDepth > DIRTREE_MAX_DEPTH) return "";

  let treeString = "";
  let entries;
  const outputFilePathAbs = path.resolve(process.cwd(), argv.output); // Абсолютный путь к выходному файлу

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "EACCES" && error.code !== "ENOENT") {
      // Не выводим ошибку, если папки просто нет
      console.error(
        `\n❌ Ошибка чтения директории ${directory}: ${error.message}`
      );
    }
    return `${prefix}${ELBOW} [Ошибка чтения или нет доступа] ${path.basename(directory)}\n`;
  }

  const filteredEntries = entries.filter(
    (entry) =>
      !excludeDirsSet.has(entry.name) &&
      path.join(directory, entry.name) !== outputFilePathAbs // Исключаем сам выходной файл
  );

  filteredEntries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const count = filteredEntries.length;
  for (let i = 0; i < count; i++) {
    const entry = filteredEntries[i];
    const isLast = i === count - 1;
    const connector = isLast ? ELBOW : TEE;
    const entryPath = path.join(directory, entry.name);

    treeString += `${prefix}${connector}${entry.name}\n`;

    if (entry.isDirectory()) {
      const nextPrefix = prefix + (isLast ? SPACE : PIPE);
      treeString += await generateTree(entryPath, currentDepth + 1, nextPrefix);
    }
  }
  return treeString;
}

// --- Логика чтения основных файлов (упрощенный codescan) ---
async function scanEssentialFiles(fileList, projectRoot) {
  let allContent = "";
  console.log("\n🔍 Чтение основных конфигурационных файлов:");

  for (const relativeFilePath of fileList) {
    const fullPath = path.resolve(projectRoot, relativeFilePath);
    try {
      const fileContent = await fs.readFile(fullPath, "utf8");
      console.log(`   -> Прочитан: ${relativeFilePath}`);
      allContent += `--- File: ${relativeFilePath} ---\n\n`;
      allContent += fileContent.trim();
      allContent += `\n\n--- End of File: ${relativeFilePath} ---\n\n\n`;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.warn(`   ⚠️ Файл не найден (пропущен): ${relativeFilePath}`);
      } else {
        console.error(
          `   ❌ Ошибка чтения файла ${relativeFilePath}:`,
          error.message
        );
      }
      // Добавляем маркер, что файл не найден или не прочитан
      allContent += `--- File: ${relativeFilePath} ---\n\n`;
      allContent += `[!!! Ошибка чтения или файл не найден: ${error.message || "ENOENT"} !!!]`;
      allContent += `\n\n--- End of File: ${relativeFilePath} ---\n\n\n`;
    }
  }
  return allContent;
}

// --- Основная функция ---
async function run() {
  const projectRoot = process.cwd();
  const outputFilename = argv.output;
  const outputFilePath = path.resolve(projectRoot, outputFilename);
  const resumeFilePath = argv.resumeFile
    ? path.resolve(projectRoot, argv.resumeFile)
    : null;

  console.log(`--- Генерация контекста для AI сессии (aicon) ---`); // Обновили лог
  console.log(`Корневая директория проекта: ${projectRoot}`);
  console.log(`Выходной файл: ${outputFilePath}`);
  if (resumeFilePath) {
    console.log(`Файл Резюме Сессии: ${resumeFilePath}`);
  } else {
    console.log(`Файл Резюме Сессии: Не указан (замените плейсхолдер вручную)`);
  }
  console.log("-------------------------------------------------\n");

  // 1. Читаем Резюме Сессии, если файл указан
  let sessionResumeContent =
    '[!!! ВСТАВЬТЕ СЮДА ПОЛНЫЙ ТЕКСТ "РЕЗЮМЕ СЕССИИ" С ПРОШЛОГО РАЗА ИЛИ УДАЛИТЕ ЭТОТ БЛОК !!!]';
  if (resumeFilePath) {
    try {
      sessionResumeContent = await fs.readFile(resumeFilePath, "utf8");
      console.log(`✅ Резюме сессии прочитано из ${argv.resumeFile}`);
    } catch (error) {
      console.warn(
        `⚠️ Не удалось прочитать файл Резюме Сессии (${argv.resumeFile}): ${error.message}. Используется плейсхолдер.`
      );
    }
  }
  // Вставляем прочитанное резюме (или плейсхолдер) в шаблон
  const finalPromptTemplate = NEW_SESSION_PROMPT_TEMPLATE.replace(
    /\[!!! ВСТАВЬТЕ СЮДА ПОЛНЫЙ ТЕКСТ "РЕЗЮМЕ СЕССИИ" С ПРОШЛОГО РАЗА !!!\]/g, // Заменяем плейсхолдер
    sessionResumeContent.trim() // Убираем лишние пробелы из резюме
  );

  // 2. Генерируем дерево каталогов
  console.log("🌳 Построение дерева каталогов...");
  const rootDirName = path.basename(projectRoot);
  let treeOutput = `${rootDirName}\n`;
  treeOutput += await generateTree(projectRoot, 0); // Глубина 0 для корневого вызова
  console.log("   -> Дерево построено.");

  // 3. Сканируем основные файлы
  const essentialFilesContent = await scanEssentialFiles(
    ESSENTIAL_FILES,
    projectRoot
  );

  // 4. Собираем финальный вывод
  // Добавили явный маркер начала и конца генерируемого контекста
  const finalOutput = `
${finalPromptTemplate}

<!-- НАЧАЛО АВТОМАТИЧЕСКИ СГЕНЕРИРОВАННОГО КОНТЕКСТА -->

**Структура Проекта (сгенерировано \`aicon\`, глубина ${DIRTREE_MAX_DEPTH}):**
\`\`\`text
${treeOutput.trim()}
\`\`\`

**Содержимое Ключевых Конфигурационных Файлов (сгенерировано \`aicon\`):**
\`\`\`typescript 
// или другой язык по необходимости
${essentialFilesContent.trim()}
\`\`\`

<!-- КОНЕЦ АВТОМАТИЧЕСКИ СГЕНЕРИРОВАННОГО КОНТЕКСТА -->
`;

  // 5. Записываем в файл
  try {
    await fs.writeFile(outputFilePath, finalOutput.trim() + "\n", "utf8");
    console.log(
      `\n✅ Успешно! Полный контекст для новой сессии AI сохранен в: ${outputFilename}`
    );
    console.log(
      "   -> Теперь скопируйте содержимое этого файла и вставьте в чат с AI."
    );
  } catch (error) {
    console.error(`\n❌ Ошибка записи в файл ${outputFilename}:`, error);
    process.exit(1);
  }
}

// --- Запуск ---
run();
