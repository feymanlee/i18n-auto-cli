import fs from 'fs-extra';
import path from 'path';
import { ConfigManager } from '../config/ConfigManager';

/**
 * 语言文件服务
 * 负责读取和写入国际化语言文件
 */
export class LocaleFileService {
  private static instance: LocaleFileService;
  private localeData: Record<string, any> = {};
  private outputRoot: string | undefined;

  private constructor() {}

  static getInstance(): LocaleFileService {
    if (!LocaleFileService.instance) {
      LocaleFileService.instance = new LocaleFileService();
    }
    return LocaleFileService.instance;
  }

  /**
   * 初始化语言文件服务
   */
  async init(): Promise<void> {
    const config = ConfigManager.getInstance().getConfig();
    this.outputRoot = config.outputRoot;

    // 每次初始化时都重新读取现有语言文件
    this.localeData = {};
    const outputPath = path.resolve(process.cwd(), config.output);
    if (await fs.pathExists(outputPath)) {
      const content = await fs.readFile(outputPath, 'utf-8');
      this.localeData = JSON.parse(content);
      // 如果配置了 outputRoot，提取对应层级的数据
      if (this.outputRoot) {
        this.localeData = this.localeData[this.outputRoot] || {};
      }
    }
  }

  /**
   * 深度合并对象
   */
  private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * 获取语言数据
   */
  getLocaleData(): Record<string, any> {
    return this.localeData;
  }

  /**
   * 保存语言数据
   */
  async save(newData: Record<string, any>): Promise<void> {
    const config = ConfigManager.getInstance().getConfig();
    const outputPath = path.resolve(process.cwd(), config.output);

    // 在保存前重新读取最新文件内容，确保没有并发问题
    let existingData: Record<string, any> = {};
    if (await fs.pathExists(outputPath)) {
      const content = await fs.readFile(outputPath, 'utf-8');
      existingData = JSON.parse(content);
      // 如果配置了 outputRoot，提取对应层级的数据
      if (this.outputRoot && existingData[this.outputRoot]) {
        existingData = existingData[this.outputRoot];
      }
    }

    // 合并现有数据和新数据
    const mergedData = this.deepMerge(existingData, newData);

    // 如果配置了 outputRoot，包装数据
    let finalData: Record<string, any>;
    if (this.outputRoot) {
      finalData = { [this.outputRoot]: mergedData };
    } else {
      finalData = mergedData;
    }

    // 确保目录存在
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, JSON.stringify(finalData, null, 2), 'utf-8');
  }
}
