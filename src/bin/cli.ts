#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from '../config/ConfigManager';
import { Director } from '../core/Director';

const program = new Command();

program
  .name('auto-i18n')
  .description('Vue/React 项目自动化国际化迁移工具')
  .version('1.0.0')
  .option('-c, --config <path>', '配置文件路径')
  .option('-e, --entry <paths...>', '扫描入口 glob 模式')
  .option('-l, --log-dir <path>', '日志输出目录路径')
  .option('-d, --dry-run', '空跑模式 (不修改文件，仅生成报告)')
  .addHelpText('after', `

示例:
  $ auto-i18n -c i18n.config.js
  $ auto-i18n --entry src/views/Home.vue
  $ auto-i18n --help
`)
  .action(async (options) => {
    console.log('🚀 Auto-i18n-CLI 启动中...');

    // 1. 加载配置
    await ConfigManager.getInstance().loadConfig(options);

    // 2. 启动 Director
    const director = new Director();
    await director.run();
  });

program.parse(process.argv);
