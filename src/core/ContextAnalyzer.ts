/**
 * 上下文分析器
 * 负责分析代码文件的上下文环境，如 Vue 版本、API 类型等
 */
export class ContextAnalyzer {
  /**
   * 判断文件是否使用 Vue 3 Composition API (Script Setup)
   * @param content 文件内容
   */
  static isVue3ScriptSetup(content: string): boolean {
    return /<script\s+.*setup.*>/.test(content);
  }

  /**
   * 判断文件是否是 React / JSX 环境
   * @param filePath 文件路径
   */
  static isReact(filePath: string): boolean {
    return /\.(jsx|tsx)$/.test(filePath);
  }

  /**
   * 判断文件是否使用 Vue 2 Options API
   * @param content 文件内容
   * @param filePath 文件路径
   */
  static isVue2(content: string, filePath: string): boolean {
    if (!filePath.endsWith('.vue')) return false;
    return !this.isVue3ScriptSetup(content);
  }

  /**
   * 判断是否需要注入 useI18n (Vue 3)
   * @param content 文件内容
   */
  static needsImportInjection(content: string): boolean {
    return !/import\s+.*useI18n.*\s+from\s+['"]vue-i18n['"]/.test(content);
  }

  /**
   * 判断是否需要注入 t 函数 (JS/TS/React)
   * @param content 文件内容
   */
  static needsTFunctionInjection(content: string): boolean {
    const hasImportT = /import\s+.*(\W|^)t(\W|$).*\s+from/.test(content);
    const hasConstT = /const\s+\{\s*t\s*\}\s*=/.test(content);
    const hasDefT = /function\s+t\s*\(/.test(content) || /const\s+t\s*=\s*/.test(content);
    return !(hasImportT || hasConstT || hasDefT);
  }

  /**
   * 获取 Script Setup 的范围
   * @param content 文件内容
   */
  static getScriptSetupRange(content: string): { start: number; end: number } | null {
    const match = /<script\s+[^>]*setup[^>]*>([\s\S]*?)<\/script>/i.exec(content);
    if (match) {
      return {
        start: match.index,
        end: match.index + match[0].length
      };
    }
    return null;
  }
}
