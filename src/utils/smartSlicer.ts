/**
 * 智能切片工具
 * 用于分离核心中文文本与首尾空白字符。
 */

export interface SliceResult {
  coreText: string;
  prefix: string;
  suffix: string;
  hasChinese: boolean;
}

/**
 * 智能切片器
 * 负责提取包含中文的核心文本片段。
 *
 * 策略：仅去除字符串首尾的空白字符，中间的所有内容（包括标点）都视为核心文本整体进行翻译。
 * 这样可以保证句子内部的标点、数字等不被拆分，维护翻译上下文的完整性。
 */
export class SmartSlicer {
  static readonly CHINESE_REGEX = /[\u4e00-\u9fa5]+/;

  /**
   * 对文本进行切片
   *
   * 策略：如果文本包含中文，则将去除首尾空白后的整体作为核心文本。
   *
   * @param text 原始文本
   * @param _isTemplateText 预留参数
   */
  static slice(text: string, _isTemplateText = false): SliceResult {
    // 1. 检查是否包含中文
    if (!this.CHINESE_REGEX.test(text)) {
      return {
        coreText: '',
        prefix: '',
        suffix: text,
        hasChinese: false,
      };
    }

    // 2. 提取核心文本
    const trimmed = text.trim();
    const start = text.indexOf(trimmed);
    const end = start + trimmed.length;

    return {
      coreText: trimmed,
      prefix: text.slice(0, start),
      suffix: text.slice(end),
      hasChinese: true,
    };
  }
}
