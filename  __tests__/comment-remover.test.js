// __tests__/comment-remover.test.js

// Пока что не импортируем саму функцию, просто убедимся, что Jest работает
describe("CommentRemover Utility", () => {
  it("should be a placeholder test", () => {
    expect(true).toBe(true);
  });

  // Пример того, как ты будешь писать тесты позже
  // (пока закомментировано, так как функция removeJsTsComments может быть не экспортирована или иметь другой путь)
  /*
    const { removeJsTsComments } = require('../comment-remover.js'); // Или import, если настроено
  
    it('should remove a single-line comment', () => {
      const code = 'let a = 1; // this is a comment';
      const expected = 'let a = 1; '; // Обрати внимание на пробел, если он важен
      expect(removeJsTsComments(code).trim()).toBe(expected.trim()); // trim() для простоты сравнения
    });
  
    it('should remove a multi-line comment', () => {
      const code = 'let b = 2; /* this is a\nmulti-line comment *\/';
      const expected = 'let b = 2; ';
      expect(removeJsTsComments(code).trim()).toBe(expected.trim());
    });
    */
});
