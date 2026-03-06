import MagicString from 'magic-string';
import { SnippetGenerator } from './SnippetGenerator';
import { ContextAnalyzer } from '../core/ContextAnalyzer';
import { ParseItem } from '../parsers/BaseParser';

/**
 * 代码替换器
 * 使用 magic-string 进行非破坏性的代码替换
 */
export class CodeReplacer {
  private content: string;
  private filePath: string;
  private magicString: MagicString;

  constructor(content: string, filePath: string) {
    this.content = content;
    this.filePath = filePath;
    this.magicString = new MagicString(content);
  }

  /**
   * 执行替换
   * @param items 提取项列表（必须包含 finalKey）
   */
  applyReplacements(items: ParseItem[]): void {
    const isReact = ContextAnalyzer.isReact(this.filePath);
    const isVue2 = ContextAnalyzer.isVue2(this.content, this.filePath);
    const useTFunction = !isVue2;

    // 倒序替换，防止索引偏移
    const sortedItems = [...items].sort((a, b) => b.start - a.start);

    for (const item of sortedItems) {
      if (!item.finalKey) continue;

      const snippet = SnippetGenerator.generate(item, item.finalKey, useTFunction, isReact);

      if (item.type === 'VUE_TEMPLATE_ATTR' && item.attrName) {
        const newAttr = `:${item.attrName}="${snippet}"`;
        this.magicString.overwrite(item.start, item.end, newAttr);
      } else if (item.type === 'TEMPLATE_QUASI' || item.type === 'VUE_TEMPLATE_QUASI') {
        this.magicString.overwrite(item.start, item.end, snippet);
      } else {
        this.magicString.overwrite(item.start, item.end, snippet);
      }
    }
  }

  /**
   * 注入 import 语句
   * @param statement import 语句
   * @param type 文件类型 'vue' | 'js'
   */
  injectImport(statement: string, type: 'vue' | 'js' = 'js'): void {
    if (type === 'vue') {
      const match = /<script.*setup.*>/.exec(this.content);
      if (match) {
        const insertPos = match.index + match[0].length;
        this.magicString.appendRight(insertPos, `\n${statement}`);
      }
    } else {
      this.magicString.prepend(`${statement}\n`);
    }
  }

  /**
   * 获取替换后的结果
   */
  getResult(): string {
    return this.magicString.toString();
  }

  /**
   * 检查是否有变更
   */
  hasChanges(): boolean {
    return this.magicString.toString() !== this.content;
  }
}
