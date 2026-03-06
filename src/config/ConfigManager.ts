import { cosmiconfig } from 'cosmiconfig';
import { merge } from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import { DEFAULT_CONFIG, Config } from './constants';

export { Config } from './constants';

/**
 * 配置管理器类 (单例模式)
 * 统一管理项目的所有配置项
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config = { ...DEFAULT_CONFIG };

  private constructor() {}

  /**
   * 获取 ConfigManager 单例实例
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 加载配置文件并与默认配置合并
   * @param cliOptions 命令行参数，优先级最高
   */
  async loadConfig(cliOptions: Record<string, any> = {}): Promise<Config> {
    const explorer = cosmiconfig('i18n');

    try {
      let result;
      if (cliOptions.config) {
        result = await explorer.load(cliOptions.config);
      } else {
        const defaultPath = path.resolve(process.cwd(), 'i18n.config.js');
        if (await fs.pathExists(defaultPath)) {
          result = await explorer.load(defaultPath);
        } else {
          result = await explorer.search();
        }
      }

      if (result && result.config) {
        console.log(`✅ 已加载配置文件: ${result.filepath}`);
        this.config = merge({}, DEFAULT_CONFIG, result.config);

        // 特殊处理空数组：lodash merge 不会替换空数组，需要手动处理
        if (result.config.targetLangList !== undefined) {
          this.config.targetLangList = result.config.targetLangList;
        }
      } else {
        console.log('⚠️ 未找到配置文件，使用默认配置');
      }
    } catch (error) {
      console.warn('加载配置文件失败，使用默认配置。', error);
    }

    // CLI 选项覆盖其他所有配置
    if (cliOptions.logDir) {
      this.config.logDir = cliOptions.logDir;
    }
    if (cliOptions.entry && cliOptions.entry.length > 0) {
      this.config.entry = cliOptions.entry;
    }
    if (cliOptions.dryRun) {
      this.config.dryRun = true;
    }

    // 规范化 entry 配置
    this.config.entry = this.normalizeEntry(this.config.entry);

    return this.config;
  }

  /**
   * 规范化 entry 配置
   */
  private normalizeEntry(entries: string[]): string[] {
    const DEFAULT_EXTENSIONS = '**/*.{vue,js,ts,jsx,tsx}';
    return entries.map(entry => {
      if (entry.includes('*')) return entry;

      let isDirectory = false;
      if (entry.endsWith('/') || entry.endsWith('\\')) {
        isDirectory = true;
      } else {
        try {
          const absPath = path.resolve(process.cwd(), entry);
          if (fs.statSync(absPath).isDirectory()) {
            isDirectory = true;
          }
        } catch (e) {
          // 忽略错误
        }
      }

      if (isDirectory) {
        let cleanPath = entry.replace(/\\/g, '/');
        if (!cleanPath.endsWith('/')) {
          cleanPath += '/';
        }
        return `${cleanPath}${DEFAULT_EXTENSIONS}`;
      }
      return entry;
    });
  }

  /**
   * 获取当前配置
   */
  getConfig(): Config {
    return this.config;
  }
}
