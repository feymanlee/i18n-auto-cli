import { parse as vueParse } from 'vue-eslint-parser';
import fs from 'fs-extra';
import { BaseParser, ParseItem, TemplateVariable } from './BaseParser';
import { SmartSlicer } from '../utils/smartSlicer';
import { ScriptParser } from './ScriptParser';
import { ConfigManager } from '../config/ConfigManager';

/**
 * Vue 文件解析器
 * 负责解析 .vue 文件，包括 Template 和 Script 部分
 */
export class VueParser extends BaseParser {
  private scriptParser = new ScriptParser();

  /**
   * 解析 Vue 文件
   * @param filePath 文件路径
   * @param content 文件内容
   */
  async parse(filePath: string, content?: string): Promise<ParseItem[]> {
    const code = content ?? await fs.readFile(filePath, 'utf-8');
    const items: ParseItem[] = [];
    const config = ConfigManager.getInstance().getConfig();

    try {
      // 动态加载 TypeScript 解析器
      let tsParser: any;
      try {
        tsParser = require('@typescript-eslint/parser');
      } catch (e) {
        tsParser = null;
      }

      const parserOptions: any = {
        sourceType: 'module',
        ecmaVersion: 2020,
      };

      // 配置 TypeScript 解析器用于解析 <script> 块
      if (tsParser) {
        parserOptions.parser = {
          ts: tsParser,
          tsx: tsParser,
        };
      }

      const ast = vueParse(code, parserOptions);

      const templateBody = ast.templateBody;
      const expressions: { code: string; start: number }[] = [];

      if (templateBody) {
        this.traverseTemplate(templateBody, items, filePath, code, expressions);
      }

      // 处理收集到的表达式
      for (const exp of expressions) {
        let wrappedCode = `(${exp.code}\n)`;
        let offset = 1;

        try {
          const scriptItems = await this.scriptParser.parse(filePath + '.ts', wrappedCode);
          this.processScriptItems(scriptItems, items, exp.start, offset);
        } catch (err) {
          // 尝试用函数包装解析
          wrappedCode = `function _() { ${exp.code}\n }`;
          offset = 15;
          try {
            const scriptItems = await this.scriptParser.parse(filePath + '.ts', wrappedCode);
            this.processScriptItems(scriptItems, items, exp.start, offset);
          } catch (err2) {
            // 忽略表达式解析错误，继续处理其他内容
            // console.error(`解析表达式失败: ${wrappedCode.slice(0, 100)}...`);
          }
        }
      }

      // 解析脚本
      const scriptRegex = /<script(?:\s+[^>]*>|>)([\s\S]*?)<\/script>/g;
      let match;
      while ((match = scriptRegex.exec(code)) !== null) {
        const scriptContent = match[1];
        const scriptStart = match.index + match[0].indexOf(scriptContent);

        try {
          const scriptItems = await this.scriptParser.parse(filePath + '.ts', scriptContent);
          scriptItems.forEach(item => {
            item.start += scriptStart;
            item.end += scriptStart;
            if (item.type !== 'TEMPLATE_QUASI') {
              item.type = 'JS_STRING';
            }
            items.push(item);
          });
        } catch (err) {
          console.error(`解析脚本失败: ${scriptContent.slice(0, 100)}...`);
          throw err;
        }
      }
    } catch (e: any) {
      throw new Error(`解析 Vue 文件 ${filePath} 时出错: ${e.message}`);
    }

    return items;
  }

  private processScriptItems(
    scriptItems: ParseItem[],
    items: ParseItem[],
    expStart: number,
    offset: number
  ): void {
    scriptItems.forEach(item => {
      const adjustment = expStart - offset;
      item.start += adjustment;
      item.end += adjustment;
      // 同时调整 templateStart 和 templateEnd
      if (item.templateStart !== undefined) {
        item.templateStart += adjustment;
      }
      if (item.templateEnd !== undefined) {
        item.templateEnd += adjustment;
      }
      if (item.type === 'TEMPLATE_LITERAL') {
        item.type = 'VUE_TEMPLATE_LITERAL';
      } else if (item.type === 'TEMPLATE_QUASI') {
        item.type = 'VUE_TEMPLATE_QUASI';
      } else {
        item.type = 'VUE_TEMPLATE_JS_STRING';
      }
      items.push(item);
    });
  }

  /**
   * 递归遍历模板 AST
   */
  private traverseTemplate(
    node: any,
    items: ParseItem[],
    filePath: string,
    code: string,
    expressions: { code: string; start: number }[]
  ): void {
    if (!node) return;

    // 处理 VText
    if (node.type === 'VText') {
      const text = node.value;
      const sliced = SmartSlicer.slice(text, true);
      if (sliced.hasChinese) {
        items.push({
          text,
          coreText: sliced.coreText,
          prefix: '',
          suffix: '',
          start: node.range[0] + sliced.prefix.length,
          end: node.range[1] - sliced.suffix.length,
          filePath,
          scope: '',
          type: 'VUE_TEMPLATE_TEXT',
        });
      }
    }

    // 处理 VExpressionContainer
    if (node.type === 'VExpressionContainer') {
      if (node.expression) {
        const [start, end] = node.expression.range;
        expressions.push({
          code: code.slice(start, end),
          start,
        });
      }
    }

    // 处理 VAttribute
    if (node.type === 'VAttribute') {
      const config = ConfigManager.getInstance().getConfig();
      const ignoreAttributes = config.ignoreAttributes || [];

      let attrName = '';
      if (node.directive) {
        const key = node.key;
        if (key.argument && key.argument.type === 'VIdentifier') {
          attrName = key.argument.name;
        } else if (key.name && key.name.type === 'VIdentifier') {
          attrName = key.name.name;
        }
      } else {
        attrName = node.key.name;
      }

      if (attrName && ignoreAttributes.includes(attrName)) return;

      if (node.directive) {
        if (node.value) {
          this.traverseTemplate(node.value, items, filePath, code, expressions);
        }
      } else {
        if (node.value && node.value.type === 'VLiteral') {
          const text = node.value.value;
          // 只处理简单的文本属性值，排除可能包含 HTML 的属性
          const complexAttrs = ['innerHTML', 'innerText', 'html', 'v-html', 'v-text'];
          if (complexAttrs.includes(node.key.name)) {
            return;
          }

          const sliced = SmartSlicer.slice(text, true);
          if (sliced.hasChinese) {
            items.push({
              text,
              coreText: sliced.coreText,
              prefix: sliced.prefix,
              suffix: sliced.suffix,
              start: node.range[0],
              end: node.range[1],
              filePath,
              scope: '',
              type: 'VUE_TEMPLATE_ATTR',
              attrName: node.key.name,
            });
          }
        }
      }
    }

    // 处理 VDirective
    if (node.type === 'VDirective') {
      if (node.value) {
        this.traverseTemplate(node.value, items, filePath, code, expressions);
      }
    }

    // 递归遍历子节点
    if (node.children) {
      node.children.forEach((child: any) => this.traverseTemplate(child, items, filePath, code, expressions));
    }

    if (node.startTag && node.startTag.attributes) {
      node.startTag.attributes.forEach((attr: any) => this.traverseTemplate(attr, items, filePath, code, expressions));
    }
  }
}
