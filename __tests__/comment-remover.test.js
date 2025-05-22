// __tests__/comment-remover.test.js
import { removeJsTsComments } from "../comment-remover.js"; // Импортируем функцию

describe("CommentRemover Utility - removeJsTsComments", () => {
  // Тесты на корректное удаление обычных комментариев
  it("should remove a single-line comment //", () => {
    const code = "let a = 1; // this is a comment";
    const expected = "let a = 1; ";
    expect(removeJsTsComments(code)).toBe(expected);
  });

  it("should remove a multi-line comment /* ... */", () => {
    const code = "let b = 2; /* this is a\nmulti-line comment */";
    const expected = "let b = 2; ";
    expect(removeJsTsComments(code)).toBe(expected);
  });

  it("should preserve code when no comments are present", () => {
    const code = 'const c = () => {\n  return "hello";\n};';
    expect(removeJsTsComments(code)).toBe(code);
  });

  it("should not remove comments inside strings", () => {
    const code =
      "const str1 = \"string with // comment like text\";\n/* comment */ const str2 = 'another /* string */';";
    const expected =
      "const str1 = \"string with // comment like text\";\n const str2 = 'another /* string */';";
    expect(removeJsTsComments(code)).toBe(expected);
  });

  it("should PRESERVE comments inside template literal expressions ${...}", () => {
    const code =
      "const template = `template with // comment like text ${/* внутри */ `nested`}` // outer comment";
    // Ожидаем, что комментарий ВНУТРИ ${...} останется, а ВНЕШНИЙ комментарий `// outer comment` удалится.
    // Внешний комментарий `// comment like text` ВНУТРИ шаблонной строки, но НЕ ВНУТРИ `${...}`,
    // согласно нашей текущей логике `!inTemplateLiteral` для поиска комментариев, тоже должен остаться.
    const expected =
      "const template = `template with // comment like text ${/* внутри */ `nested`}` "; // <--- ИСПРАВЛЕННЫЙ EXPECTED
    expect(removeJsTsComments(code)).toBe(expected);
  });

  // Тесты на проблему с JSDoc/Swagger
  it("should PRESERVE JSDoc/Swagger style comments /** ... */", () => {
    const code =
      "/**\n * This is a JSDoc comment.\n * @param {string} name\n */\nfunction greet(name) {\n  // regular comment\n  return `Hello, ${name}`;\n}";
    const expectedAfterRemovalOfRegular =
      "/**\n * This is a JSDoc comment.\n * @param {string} name\n */\nfunction greet(name) {\n  \n  return `Hello, ${name}`;\n}";
    // Текущая реализация УДАЛИТ JSDoc, поэтому тест должен упасть
    expect(removeJsTsComments(code)).toBe(expectedAfterRemovalOfRegular);
  });

  it("should remove regular multi-line comments but preserve JSDoc", () => {
    const code = "/* обычный многострочный */\n/** JSDoc */\nlet val = 10;";
    const expected = "\n/** JSDoc */\nlet val = 10;";
    expect(removeJsTsComments(code)).toBe(expected);
  });

  // Тесты на проблему с пустыми строками (пока для removeJsTsComments)
  // Позже, возможно, понадобятся тесты для removeCommentsFromFile, где происходит обработка пустых строк
  it("should not remove meaningful empty lines between code blocks by removeJsTsComments", () => {
    const code =
      "function a() {\n  return 1;\n}\n\nfunction b() {\n  return 2;\n}";
    // removeJsTsComments сама по себе не должна удалять пустые строки, это делает другой код позже
    expect(removeJsTsComments(code)).toBe(code);
  });

  it("should remove empty lines left after comment removal if they were the only content", () => {
    const code = "line1;\n// comment on its own line\nline3;";
    const expected = "line1;\n\nline3;"; // Ожидаем, что строка от комментария станет пустой, но не удалится полностью (пока)
    expect(removeJsTsComments(code)).toBe(expected);
  });

  // Тест для https://example.com (комментарии, похожие на URL)
  it("should not misinterpret // in URLs as comments", () => {
    const code = "const url = 'https://example.com'; // a comment";
    const expected = "const url = 'https://example.com'; ";
    expect(removeJsTsComments(code)).toBe(expected);
  });

  it("should correctly handle comments after regex literals", () => {
    const code = "const regex = /abc/ig; // comment after regex\nlet x = 1;";
    const expected = "const regex = /abc/ig; \nlet x = 1;";
    expect(removeJsTsComments(code)).toBe(expected);
  });

  it("should correctly handle regex literals containing slashes", () => {
    const code = "const regex = /\\/\\/ escaped slashes/g; /* comment */";
    const expected = "const regex = /\\/\\/ escaped slashes/g; ";
    expect(removeJsTsComments(code)).toBe(expected);
  });
});

// TODO: Позже добавить тесты для `removeCommentsFromFile`
// Эти тесты будут сложнее, так как они включают чтение/запись файлов
// и обработку пустых строк регулярками.
// describe('CommentRemover Utility - removeCommentsFromFile', () => {
//   // Тесты на обработку пустых строк
//   it('should preserve single empty lines between code after full processing', async () => {
//     // Этот тест потребует моки для fs
//   });
//   it('should collapse multiple empty lines to one/two after full processing', async () => {
//     // Этот тест потребует моки для fs
//   });
// });
