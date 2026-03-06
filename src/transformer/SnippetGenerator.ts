import { ParseItem } from '../parsers/BaseParser';

/**
 * 代码片段生成器
 * 负责根据不同的上下文（Vue 模板、JSX、脚本）生成对应的 i18n 调用代码
 */
export class SnippetGenerator {
  /**
   * 生成替换代码片段
   * @param item 提取项
   * @param key 完整的 i18n key
   * @param isVue3 是否是 Vue 3 环境
   * @param isReact 是否是 React 环境
   */
  static generate(item: ParseItem, key: string, isVue3: boolean, isReact: boolean): string {
    const { type, suffix, prefix } = item;

    let tCall: string;
    if (isReact || isVue3) {
      tCall = `$t('${key}')`;
    } else {
      tCall = `this.$t('${key}')`;
    }

    switch (type) {
      case 'VUE_TEMPLATE_TEXT':
        return `{{ ${tCall} }}`;

      case 'TEMPLATE_QUASI':
        return `\${${tCall}}`;

      case 'VUE_TEMPLATE_QUASI':
        return `\${$t('${key}')}`;

      case 'VUE_TEMPLATE_ATTR':
        tCall = `$t('${key}')`;
        if (prefix || suffix) {
          return `\`${prefix || ''}\${${tCall}}${suffix || ''}\``;
        }
        return tCall;

      case 'VUE_TEMPLATE_JS_STRING':
        tCall = `$t('${key}')`;
        if (prefix || suffix) {
          return `\`${prefix || ''}\${${tCall}}${suffix || ''}\``;
        }
        return tCall;

      case 'JSX_ATTR':
        tCall = `t('${key}')`;
        if (prefix || suffix) {
          return `{\`${prefix || ''}\${${tCall}}${suffix || ''}\`}`;
        }
        return `{${tCall}}`;

      case 'JS_STRING':
      case 'JSX_TEXT':
        if (prefix || suffix) {
          const expr = `\`${prefix || ''}\${${tCall}}${suffix || ''}\``;
          if (type === 'JSX_TEXT') {
            return `{${expr}}`;
          }
          return expr;
        }
        if (type === 'JSX_TEXT') {
          return `{${tCall}}`;
        }
        return tCall;

      default:
        return item.text;
    }
  }
}
