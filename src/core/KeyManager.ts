import { get } from 'lodash';
import { ConfigManager } from '../config/ConfigManager';
import { LocaleFileService } from '../services/LocaleFileService';
import { AuditReporter } from '../services/AuditReporter';

/**
 * 键值管理器
 * 负责管理翻译键值的查找、生成和注册
 * 实现了三级查找策略：Common -> Existing -> New
 */
export class KeyManager {
  private static instance: KeyManager;

  private constructor() {}

  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  /**
   * 检查是否存在现有的 Key
   * @param text 待翻译的中文文本
   */
  checkExisting(text: string): string | null {
    const config = ConfigManager.getInstance().getConfig();
    const localeService = LocaleFileService.getInstance();
    const auditReporter = AuditReporter.getInstance();

    // 在整个翻译文件中查找 key（不区分 scope）
    const localeData = localeService.getLocaleData();
    const existingKey = this.findKeyByValue(localeData, text);

    if (existingKey) {
      let fullKey = existingKey;
      // 只有当 outputRoot 有值时才添加前缀
      if (config.outputRoot) {
        fullKey = `${config.outputRoot}.${fullKey}`;
      }
      auditReporter.addReusedLog({
        filePath: '',
        sourceText: text,
        matchedKey: fullKey,
        source: 'EXISTING_LOCAL',
      });
      return fullKey;
    }

    return null;
  }

  /**
   * 注册新的 Key
   * @param text 中文文本
   * @param translatedKey 翻译后的 Key (hash)
   */
  registerNewKey(text: string, translatedKey: string): string {
    const config = ConfigManager.getInstance().getConfig();
    // 直接使用 hash 作为 key，不加 scope 前缀
    let fullKey = translatedKey;

    AuditReporter.getInstance().addNewKey('', translatedKey, text);

    // 只有当 outputRoot 有值时才添加前缀
    if (config.outputRoot) {
      fullKey = `${config.outputRoot}.${fullKey}`;
    }

    return fullKey;
  }

  /**
   * 在对象中根据 Value 查找 Key (递归查找)
   */
  private findKeyByValue(obj: Record<string, any>, value: string): string | null {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (v === value) {
          return k;
        }
      } else if (typeof v === 'object' && v !== null) {
        const subKey = this.findKeyByValue(v, value);
        if (subKey) {
          return `${k}.${subKey}`;
        }
      }
    }
    return null;
  }
}
