import { parse as babelParse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs-extra';
import { BaseParser, ParseItem } from './BaseParser';
import { SmartSlicer } from '../utils/smartSlicer';
import { ConfigManager } from '../config/ConfigManager';

/**
 * 脚本解析器
 * 使用 Babel 解析 JS/TS/JSX/TSX 文件，提取中文文本
 */
export class ScriptParser extends BaseParser {
  /**
   * 解析脚本文件
   * @param filePath 文件路径
   * @param content 文件内容
   */
  async parse(filePath: string, content?: string): Promise<ParseItem[]> {
    const code = content ?? await fs.readFile(filePath, 'utf-8');
    const items: ParseItem[] = [];
    const config = ConfigManager.getInstance().getConfig();
    const ignoreAttributes = config.ignoreAttributes || [];
    const ignoreMethods = config.ignoreMethods || [];

    const ast = babelParse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'nullishCoalescingOperator',
        'optionalChaining',
      ],
    });

    traverse(ast, {
      DirectiveLiteral: (path) => {
        const { value, start, end } = path.node;
        if (start == null || end == null) return;

        const sliced = SmartSlicer.slice(value);
        if (sliced.hasChinese) {
          items.push({
            text: value,
            coreText: sliced.coreText,
            prefix: sliced.prefix,
            suffix: sliced.suffix,
            start,
            end,
            filePath,
            scope: '',
            type: 'JS_STRING',
          });
        }
      },

      StringLiteral: (path) => {
        if (path.parentPath.isImportDeclaration()) return;
        if (path.parentPath.isObjectProperty() && path.key === 'key') return;

        // 忽略指定的方法调用参数
        if (path.parentPath.isCallExpression()) {
          const callNode = path.parentPath.node;
          let methodName = '';
          if (t.isIdentifier(callNode.callee)) {
            methodName = callNode.callee.name;
          } else if (t.isMemberExpression(callNode.callee) && t.isIdentifier(callNode.callee.property)) {
            methodName = callNode.callee.property.name;
          }
          if (methodName && ignoreMethods.includes(methodName)) return;
        }

        // 忽略指定的 JSX 属性
        if (path.parentPath.isJSXAttribute()) {
          const attrNode = path.parentPath.node;
          if (t.isJSXIdentifier(attrNode.name) && ignoreAttributes.includes(attrNode.name.name)) return;
        }

        const { value, start, end } = path.node;
        if (!start || !end) return;

        const isJsxAttr = path.parentPath.isJSXAttribute();
        const isJsxExpr = path.parentPath.isJSXExpressionContainer();
        const isTemplateLike = isJsxAttr || isJsxExpr;

        const sliced = SmartSlicer.slice(value, isTemplateLike);
        if (sliced.hasChinese) {
          items.push({
            text: value,
            coreText: sliced.coreText,
            prefix: sliced.prefix,
            suffix: sliced.suffix,
            start,
            end,
            filePath,
            scope: '',
            type: isJsxAttr ? 'JSX_ATTR' : 'JS_STRING',
          });
        }
      },

      TemplateLiteral: (path) => {
        // 检查忽略的方法
        if (path.parentPath.isCallExpression()) {
          const callee = path.parentPath.node.callee;
          let methodName = '';
          if (t.isIdentifier(callee)) {
            methodName = callee.name;
          } else if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            methodName = callee.property.name;
          }
          if (methodName && ignoreMethods.includes(methodName)) return;
        }

        // 忽略 JSX 属性中的模板字符串
        if (path.parentPath.isJSXExpressionContainer() && path.parentPath.parentPath.isJSXAttribute()) {
          const attrNode = path.parentPath.parentPath.node;
          if (t.isJSXIdentifier(attrNode.name) && ignoreAttributes.includes(attrNode.name.name)) return;
        }

        path.node.quasis.forEach((quasi) => {
          if (quasi.value.raw && SmartSlicer.slice(quasi.value.raw).hasChinese) {
            const start = quasi.start;
            const end = quasi.end;
            if (start !== undefined && end !== undefined) {
              items.push({
                text: quasi.value.raw,
                coreText: quasi.value.raw,
                prefix: '',
                suffix: '',
                start: start as number,
                end: end as number,
                filePath,
                scope: '',
                type: 'TEMPLATE_QUASI',
              });
            }
          }
        });
      },

      JSXText: (path) => {
        const { value, start, end } = path.node;
        if (!start || !end) return;

        const trimmed = value.trim();
        if (!trimmed) return;

        const sliced = SmartSlicer.slice(value, true);
        if (sliced.hasChinese) {
          items.push({
            text: value,
            coreText: sliced.coreText,
            prefix: sliced.prefix,
            suffix: sliced.suffix,
            start,
            end,
            filePath,
            scope: '',
            type: 'JSX_TEXT',
          });
        }
      },
    });

    return items;
  }
}
