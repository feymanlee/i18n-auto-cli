/**
 * 模板变量接口
 * 表示模板字符串或插值表达式中的变量
 */
export interface TemplateVariable {
  /** 变量名 */
  name: string;
  /** 变量在模板中的原始表达式 */
  expression: string;
}

/**
 * 解析项接口
 * 表示从源代码中提取的待翻译文本项
 */
export interface ParseItem {
  /** 原始文本（含前后缀） */
  text: string;
  /** 核心文本（去除前后缀） */
  coreText: string;
  /** 前缀（空白字符） */
  prefix: string;
  /** 后缀（空白字符） */
  suffix: string;
  /** 在源代码中的起始位置 */
  start: number;
  /** 在源代码中的结束位置 */
  end: number;
  /** 文件路径 */
  filePath: string;
  /** 模块作用域 */
  scope: string;
  /** 文本类型 */
  type: string;
  /** 属性名（如果是属性） */
  attrName?: string;
  /** 最终替换的 key */
  finalKey?: string;
  /** 模板变量列表（用于插值替换） */
  variables?: TemplateVariable[];
  /** 完整的模板字符串起始位置（用于替换整个模板字符串） */
  templateStart?: number;
  /** 完整的模板字符串结束位置 */
  templateEnd?: number;
}

/**
 * 解析器基类
 * 提供解析器的通用接口
 */
export abstract class BaseParser {
  /**
   * 解析文件并提取中文文本
   * @param filePath 文件路径
   * @param content 文件内容
   */
  abstract parse(filePath: string, content?: string): Promise<ParseItem[]>;
}
