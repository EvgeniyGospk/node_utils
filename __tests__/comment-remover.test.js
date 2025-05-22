import { removeJsTsComments } from "../comment-remover.js"; 

describe("CommentRemover Utility - removeJsTsComments", () => {
  
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
    
    
    
    const expected =
      "const template = `template with // comment like text ${/* внутри */ `nested`}` "; 
    expect(removeJsTsComments(code)).toBe(expected);
  });

  
  it("should PRESERVE JSDoc/Swagger style comments /** ... */", () => {
    const code =
      "/**\n * This is a JSDoc comment.\n * @param {string} name\n */\nfunction greet(name) {\n  // regular comment\n  return `Hello, ${name}`;\n}";
    const expectedAfterRemovalOfRegular =
      "/**\n * This is a JSDoc comment.\n * @param {string} name\n */\nfunction greet(name) {\n  \n  return `Hello, ${name}`;\n}";
    
    expect(removeJsTsComments(code)).toBe(expectedAfterRemovalOfRegular);
  });

  it("should remove regular multi-line comments but preserve JSDoc", () => {
    const code = "/* обычный многострочный */\n/** JSDoc */\nlet val = 10;";
    const expected = "\n/** JSDoc */\nlet val = 10;";
    expect(removeJsTsComments(code)).toBe(expected);
  });

  
  
  it("should not remove meaningful empty lines between code blocks by removeJsTsComments", () => {
    const code =
      "function a() {\n  return 1;\n}\n\nfunction b() {\n  return 2;\n}";
    
    expect(removeJsTsComments(code)).toBe(code);
  });

  it("should remove empty lines left after comment removal if they were the only content", () => {
    const code = "line1;\n// comment on its own line\nline3;";
    const expected = "line1;\n\nline3;"; 
    expect(removeJsTsComments(code)).toBe(expected);
  });

  
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
