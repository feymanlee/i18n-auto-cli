/**
 * 常量定义模块
 * 包含系统的默认配置和常量值
 */

import { Translator } from '../services/translators/translator/Translator';

export interface Config {
  entry: string[];
  output: string;
  outputRoot?: string;
  baseDir?: string;
  namespace?: string;
  logDir: string | false;
  depth: number;
  hashLength?: number;
  hashSecret?: string;
  exclude: string[];
  ignoreAttributes: string[];
  ignoreMethods: string[];
  translator?: Translator;
  translatorOption?: Record<string, any>;
  targetLangList?: string[];
  rules: {
    autoImport: boolean;
    jsImportStatement: string;
  };
  dryRun?: boolean;
}

/**
 * 默认配置对象
 * 当用户未提供配置文件或配置项缺失时使用
 */
import { GoogleTranslator } from '../services/translators/google';

export const DEFAULT_CONFIG: Config = {
  entry: ['src/**/*.{vue,js,ts,jsx,tsx}'],
  output: 'src/locales/zh-CN.json',
  logDir: 'logs',
  hashLength: 16,
  depth: 3,
  exclude: ['node_modules', 'dist', 'test', '**/*.d.ts'],
  ignoreAttributes: [],
  ignoreMethods: [],
  translator: new GoogleTranslator(),
  targetLangList: ['en'],
  rules: {
    autoImport: true,
    jsImportStatement: "import { $t } from '@/i18n'",
  },
};

/**
 * 默认配置文件名称
 */
export const CONFIG_FILE_NAME = 'i18n.config';
