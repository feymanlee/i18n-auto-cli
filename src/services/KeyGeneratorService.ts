import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { ConfigManager } from '../config/ConfigManager';
import { GoogleTranslator } from './translators/google';
import { Translator } from './translators/translator/Translator';

/**
 * Key 生成与翻译服务
 * 使用 HMAC-SHA256 生成 key，并支持翻译生成多语言文件
 */
export class KeyGeneratorService {
  private static instance: KeyGeneratorService;
  private translator: Translator;

  private constructor() {
    this.translator = this.initTranslator();
  }

  static getInstance(): KeyGeneratorService {
    if (!KeyGeneratorService.instance) {
      KeyGeneratorService.instance = new KeyGeneratorService();
    }
    return KeyGeneratorService.instance;
  }

  /**
   * 初始化翻译器
   */
  private initTranslator(): Translator {
    const config = ConfigManager.getInstance().getConfig();

    // 如果用户传入了 translator 实例，直接使用
    if (config.translator) {
      return config.translator;
    }

    // 默认使用 GoogleTranslator
    return new GoogleTranslator();
  }

  /**
   * 批量生成 key
   * @param texts 中文文本数组
   */
  async generateKeys(texts: string[]): Promise<Map<string, string>> {
    const config = ConfigManager.getInstance().getConfig();
    const hashLength = config.hashLength ?? 16;
    const hashSecret = config.hashSecret ?? '';
    const targetLangList = config.targetLangList;

    const result = new Map<string, string>();

    // 生成 hash key
    texts.forEach((text) => {
      const key = this.generateHashKey(text, hashSecret, hashLength);
      result.set(text, key);
    });

    // 如果有目标语言列表且不为空，进行翻译
    if (targetLangList && targetLangList.length > 0 && this.translator) {
      const translations = await this.translateTexts(texts, targetLangList);

      // 保存各语言文件
      await this.saveLanguageFiles(result, translations, targetLangList);
    }

    return result;
  }

  /**
   * 翻译文本到多个语言
   */
  private async translateTexts(
    texts: string[],
    targetLangList: string[]
  ): Promise<Map<string, Record<string, string>>> {
    const translations = new Map<string, Record<string, string>>();

    // 为每个文本生成临时 key
    const textToKey = new Map<string, string>();
    const jsonObj: Record<string, string> = {};
    texts.forEach((text, index) => {
      const tempKey = `k${index}`;
      textToKey.set(text, tempKey);
      jsonObj[tempKey] = text;
    });

    for (const lang of targetLangList) {
      try {
        // 批量翻译
        const translatedJson = await this.translator!.translate(jsonObj, 'zh', lang);

        // 将翻译结果映射回原文
        texts.forEach((text) => {
          const tempKey = textToKey.get(text)!;
          const translated = translatedJson[tempKey] || text;

          if (!translations.has(text)) {
            translations.set(text, {});
          }
          translations.get(text)![lang] = translated;
        });
      } catch (error) {
        console.error(`翻译失败 [${lang}]:`, error);
        texts.forEach((text) => {
          if (!translations.has(text)) {
            translations.set(text, {});
          }
          translations.get(text)![lang] = text;
        });
      }
    }

    return translations;
  }

  /**
   * 保存多语言文件
   */
  private async saveLanguageFiles(
    keyMap: Map<string, string>,
    translations: Map<string, Record<string, string>>,
    targetLangList: string[]
  ): Promise<void> {
    const config = ConfigManager.getInstance().getConfig();
    const outputPath = config.output;
    const baseDir = path.dirname(outputPath);
    const baseName = path.basename(outputPath, '.json');

    // 为每种目标语言创建文件
    for (const lang of targetLangList) {
      const langData: Record<string, string> = {};

      // 构建语言数据
      for (const [text, key] of keyMap) {
        const langTranslations = translations.get(text);
        if (langTranslations) {
          langData[key] = langTranslations[lang] || text;
        }
      }

      // 确定输出路径
      let langOutputPath: string;
      if (lang === 'zh') {
        // 中文直接写到主输出文件
        langOutputPath = outputPath;
      } else {
        // 其他语言生成独立文件，如 en.json, ja.json
        langOutputPath = path.join(baseDir, `${lang}.json`);
      }

      // 读取现有数据并合并
      let existingData: Record<string, any> = {};
      if (await fs.pathExists(langOutputPath)) {
        const content = await fs.readFile(langOutputPath, 'utf-8');
        existingData = JSON.parse(content);
        if (config.outputRoot && existingData[config.outputRoot]) {
          existingData = existingData[config.outputRoot];
        }
      }

      // 合并数据
      const mergedData = { ...existingData, ...langData };

      // 如果配置了 outputRoot
      let finalData: Record<string, any>;
      if (config.outputRoot) {
        finalData = { [config.outputRoot]: mergedData };
      } else {
        finalData = mergedData;
      }

      // 保存文件
      await fs.ensureDir(path.dirname(langOutputPath));
      await fs.writeFile(langOutputPath, JSON.stringify(finalData, null, 2), 'utf-8');
      console.log(`语言文件已保存: ${langOutputPath}`);
    }
  }

  /**
   * 使用 HMAC-SHA256 生成 hash key
   */
  private generateHashKey(text: string, secret: string, length: number): string {
    const hmac = crypto.createHmac('sha256', secret || 'default-secret');
    hmac.update(text);
    return hmac.digest('hex').substring(0, length);
  }

  /**
   * 获取目标语言列表
   */
  getTargetLangList(): string[] {
    const config = ConfigManager.getInstance().getConfig();
    // 如果未配置或为空数组，返回空数组（不翻译）
    if (!config.targetLangList || config.targetLangList.length === 0) {
      return [];
    }
    return config.targetLangList;
  }
}
