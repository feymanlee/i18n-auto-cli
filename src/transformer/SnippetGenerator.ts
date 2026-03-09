import { ParseItem, TemplateVariable } from '../parsers/BaseParser';

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
    const { type, suffix, prefix, variables } = item;

    // 生成带参数的 t 调用
    const tCall = this.generateTCall(key, variables, isVue3, isReact);

    // 对于模板字符串类型，直接返回带参数的 tCall（已在上面生成）
    if (type === 'TEMPLATE_LITERAL') {
      return tCall;
    }

    // Vue 模板中的模板字符串直接返回 tCall
    // 注意：VUE_TEMPLATE_LITERAL 用于属性绑定如 :title="`xxx${var}`"
    // 不需要包裹 {{ }}，因为 CodeReplacer 会替换整个模板字符串区域
    if (type === 'VUE_TEMPLATE_LITERAL') {
      return tCall;
    }

    switch (type) {
      case 'VUE_TEMPLATE_TEXT':
        return `{{ ${tCall} }}`;

      case 'TEMPLATE_QUASI':
        return `\${${tCall}}`;

      case 'VUE_TEMPLATE_QUASI':
        return `\${$t('${key}')}`;

      case 'VUE_TEMPLATE_ATTR':
        if (prefix || suffix) {
          return `\`${prefix || ''}\${${tCall}}${suffix || ''}\``;
        }
        return tCall;

      case 'VUE_TEMPLATE_JS_STRING':
        if (prefix || suffix) {
          return `\`${prefix || ''}\${${tCall}}${suffix || ''}\``;
        }
        return tCall;

      case 'JSX_ATTR':
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

  /**
   * 生成 $t 调用，支持变量参数
   */
  private static generateTCall(
    key: string,
    variables: TemplateVariable[] | undefined,
    isVue3: boolean,
    isReact: boolean
  ): string {
    // React 使用 t，Vue 使用 $t
    if (isReact) {
      return this.buildTCall('t', key, variables);
    }
    const tFn = isVue3 ? '$t' : 'this.$t';

    return this.buildTCall(tFn, key, variables);
  }

  /**
   * 构建 t 调用字符串
   * Vue i18n 使用对象形式传参: $t('key', { arg0: value0, arg1: value1 })
   * 使用命名参数 arg0, arg1 等，允许不同语言调整参数顺序
   */
  private static buildTCall(
    tFn: string,
    key: string,
    variables: TemplateVariable[] | undefined
  ): string {
    if (!variables || variables.length === 0) {
      return `${tFn}('${key}')`;
    }

    // Vue i18n 使用对象形式传参，使用 arg0, arg1 等作为参数名
    const params = variables.map((v, index) => {
      return `arg${index}: ${v.expression}`;
    });

    return `${tFn}('${key}', { ${params.join(', ')} })`;
  }

}
