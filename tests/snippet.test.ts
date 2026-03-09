import { describe, it, expect } from 'vitest';
import { SnippetGenerator } from '../dist/transformer/SnippetGenerator.js';
import { ParseItem, TemplateVariable } from '../dist/parsers/BaseParser.js';

describe('SnippetGenerator', () => {
  describe('生成 $t 调用', () => {
    it('应生成简单的 $t 调用', () => {
      const item: ParseItem = {
        text: '你好',
        coreText: '你好',
        prefix: '',
        suffix: '',
        start: 0,
        end: 6,
        filePath: 'test.js',
        scope: '',
        type: 'JS_STRING',
      };

      const result = SnippetGenerator.generate(item, 'abc123', true, false);
      expect(result).toBe("$t('abc123')");
    });

    it('应生成带变量的 $t 调用（Vue3）', () => {
      const item: ParseItem = {
        text: '欢迎 {0}',
        coreText: '欢迎 {0}',
        prefix: '',
        suffix: '',
        start: 0,
        end: 20,
        filePath: 'test.js',
        scope: '',
        type: 'TEMPLATE_LITERAL',
        variables: [{ name: 'name', expression: 'name' }],
      };

      const result = SnippetGenerator.generate(item, 'abc123', true, false);
      expect(result).toBe("$t('abc123', { arg0: name })");
    });

    it('应生成带多个变量的 $t 调用', () => {
      const item: ParseItem = {
        text: '你好 {0} {1}',
        coreText: '你好 {0} {1}',
        prefix: '',
        suffix: '',
        start: 0,
        end: 30,
        filePath: 'test.js',
        scope: '',
        type: 'TEMPLATE_LITERAL',
        variables: [
          { name: 'firstName', expression: 'firstName' },
          { name: 'lastName', expression: 'lastName' },
        ],
      };

      const result = SnippetGenerator.generate(item, 'abc123', true, false);
      expect(result).toBe("$t('abc123', { arg0: firstName, arg1: lastName })");
    });

    it('应生成带对象属性的 $t 调用', () => {
      const item: ParseItem = {
        text: '欢迎 {0}',
        coreText: '欢迎 {0}',
        prefix: '',
        suffix: '',
        start: 0,
        end: 25,
        filePath: 'test.js',
        scope: '',
        type: 'TEMPLATE_LITERAL',
        variables: [{ name: 'name', expression: 'user.name' }],
      };

      const result = SnippetGenerator.generate(item, 'abc123', true, false);
      expect(result).toBe("$t('abc123', { arg0: user.name })");
    });

    it('Vue2 应生成 this.$t 调用', () => {
      const item: ParseItem = {
        text: '你好',
        coreText: '你好',
        prefix: '',
        suffix: '',
        start: 0,
        end: 6,
        filePath: 'test.js',
        scope: '',
        type: 'JS_STRING',
      };

      const result = SnippetGenerator.generate(item, 'abc123', false, false);
      expect(result).toBe("this.$t('abc123')");
    });

    it('React 应生成 t 调用（不带 $）', () => {
      const item: ParseItem = {
        text: '你好',
        coreText: '你好',
        prefix: '',
        suffix: '',
        start: 0,
        end: 6,
        filePath: 'test.jsx',
        scope: '',
        type: 'JS_STRING',
      };

      const result = SnippetGenerator.generate(item, 'abc123', false, true);
      expect(result).toBe("t('abc123')");
    });

    it('Vue 模板文本应生成 {{ $t() }}', () => {
      const item: ParseItem = {
        text: '你好',
        coreText: '你好',
        prefix: '',
        suffix: '',
        start: 0,
        end: 6,
        filePath: 'test.vue',
        scope: '',
        type: 'VUE_TEMPLATE_TEXT',
      };

      const result = SnippetGenerator.generate(item, 'abc123', true, false);
      expect(result).toBe("{{ $t('abc123') }}");
    });

    it('Vue 模板插值应生成带变量的 $t()', () => {
      const item: ParseItem = {
        text: '欢迎 {0}',
        coreText: '欢迎 {0}',
        prefix: '',
        suffix: '',
        start: 0,
        end: 20,
        filePath: 'test.vue',
        scope: '',
        type: 'VUE_TEMPLATE_LITERAL',
        variables: [{ name: 'name', expression: 'name' }],
      };

      const result = SnippetGenerator.generate(item, 'abc123', true, false);
      expect(result).toBe("$t('abc123', { arg0: name })");
    });
  });
});
