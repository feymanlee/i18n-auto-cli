import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptParser } from '../dist/parsers/ScriptParser.js';
import { VueParser } from '../dist/parsers/VueParser.js';
import { ConfigManager } from '../dist/config/ConfigManager.js';

describe('ScriptParser', () => {
  let parser: ScriptParser;

  beforeEach(() => {
    parser = new ScriptParser();
    // 重置配置
    ConfigManager.getInstance().loadConfig({});
  });

  describe('JS/TS 文件解析', () => {
    it('应提取 JS 文件中的中文字符串', async () => {
      const code = `const name = "你好世界";`;
      const items = await parser.parse('test.js', code);

      expect(items).toHaveLength(1);
      expect(items[0].coreText).toBe('你好世界');
      expect(items[0].type).toBe('JS_STRING');
    });

    it('应提取多个中文字符串', async () => {
      const code = `
const a = "第一段";
const b = "第二段";
      `;
      const items = await parser.parse('test.js', code);

      expect(items).toHaveLength(2);
    });

    it('应提取 JSX 中的中文', async () => {
      const code = `
import React from 'react';
export default function App() {
  return <div>欢迎使用</div>;
}
      `;
      const items = await parser.parse('test.jsx', code);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].coreText).toBe('欢迎使用');
    });

    it('应提取模板字符串中的中文', async () => {
      const code = `const msg = \`你好\`;`;
      const items = await parser.parse('test.js', code);

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('TEMPLATE_LITERAL');
    });

    it('应提取带变量的模板字符串并识别变量', async () => {
      const code = 'const name = "Tom"; const msg = `欢迎 ${name}`;';
      const items = await parser.parse('test.js', code);

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('TEMPLATE_LITERAL');
      expect(items[0].coreText).toBe('欢迎 {arg0}');
      expect(items[0].variables).toBeDefined();
      expect(items[0].variables).toHaveLength(1);
      expect(items[0].variables![0].name).toBe('name');
      expect(items[0].variables![0].expression).toBe('name');
    });

    it('应提取带多个变量的模板字符串', async () => {
      const code = 'const msg = `你好 ${firstName} ${lastName}`;';
      const items = await parser.parse('test.js', code);

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('TEMPLATE_LITERAL');
      expect(items[0].coreText).toBe('你好 {arg0} {arg1}');
      expect(items[0].variables).toHaveLength(2);
    });

    it('应提取带对象属性的模板字符串', async () => {
      const code = 'const msg = `欢迎 ${user.name}`;';
      const items = await parser.parse('test.js', code);

      expect(items).toHaveLength(1);
      expect(items[0].variables).toHaveLength(1);
      expect(items[0].variables![0].name).toBe('name');
      expect(items[0].variables![0].expression).toBe('user.name');
    });
  });
});

describe('VueParser', () => {
  let parser: VueParser;

  beforeEach(() => {
    parser = new VueParser();
  });

  describe('Vue 文件解析', () => {
    it('应提取 Vue 模板中的中文', async () => {
      const code = `<template>
  <div>你好世界</div>
</template>`;
      const items = await parser.parse('Test.vue', code);

      expect(items).toHaveLength(1);
      expect(items[0].coreText).toBe('你好世界');
      expect(items[0].type).toBe('VUE_TEMPLATE_TEXT');
    });

    it('应提取 Vue script 中的中文', async () => {
      const code = `<script>
export default {
  data() {
    return { name: "用户名" }
  }
}
</script>`;
      const items = await parser.parse('Test.vue', code);

      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('应提取 Vue script setup 中的中文', async () => {
      const code = `<script setup>
const msg = "测试消息";
</script>
<template>
  <div>{{ msg }}</div>
</template>`;
      const items = await parser.parse('Test.vue', code);

      // 应该有 script 中的中文
      const hasChinese = items.some(item => item.coreText === '测试消息');
      expect(hasChinese).toBe(true);
    });

    it('应提取 Vue 属性中的中文', async () => {
      const code = `<template>
  <input placeholder="请输入名称" />
</template>`;
      const items = await parser.parse('Test.vue', code);

      expect(items.length).toBeGreaterThan(0);
      const attrItem = items.find(item => item.type === 'VUE_TEMPLATE_ATTR');
      expect(attrItem).toBeDefined();
    });

    it('应提取 Vue 模板中的插值表达式', async () => {
      const code = '<template>\n  <div>{{ `欢迎 ${name}` }}</div>\n</template>';
      const items = await parser.parse('Test.vue', code);

      const literalItem = items.find(item => item.type === 'VUE_TEMPLATE_LITERAL');
      expect(literalItem).toBeDefined();
      expect(literalItem!.coreText).toBe('欢迎 {arg0}');
      expect(literalItem!.variables).toHaveLength(1);
      expect(literalItem!.variables![0].name).toBe('name');
    });
  });
});
