import { LocaleFileService } from '../services/LocaleFileService';
import { AuditReporter } from '../services/AuditReporter';
import { KeyGeneratorService } from '../services/KeyGeneratorService';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/ConfigManager';
import { VueParser } from '../parsers/VueParser';
import { ScriptParser } from '../parsers/ScriptParser';
import { KeyManager } from '../core/KeyManager';
import { ContextAnalyzer } from './ContextAnalyzer';
import fs from 'fs-extra';
import path from 'path';
import fg from 'fast-glob';
import { CodeReplacer } from '../transformer/CodeReplacer';

/**
 * 核心控制器 (Director)
 * 协调整个国际化自动化流程：扫描 -> 解析 -> 翻译 -> 替换 -> 保存
 */
export class Director {
  private config = ConfigManager.getInstance().getConfig();
  private vueParser = new VueParser();
  private scriptParser = new ScriptParser();

  async run(): Promise<void> {
    Logger.getInstance().init(this.config.logDir as string);
    Logger.getInstance().info('系统', '正在初始化...');

    if (this.config.dryRun) {
      Logger.getInstance().warn('系统', '当前为 Dry Run (空跑) 模式，不会修改任何文件');
    }

    try {
      // Phase 1: 初始化
      await LocaleFileService.getInstance().init();

      const absEntry = path.resolve(
        process.cwd(),
        Array.isArray(this.config.entry) ? this.config.entry[0] : this.config.entry
      );
      const absOutput = path.resolve(process.cwd(), this.config.output);

      Logger.getInstance().info('目标目录', absEntry);
      Logger.getInstance().info('命名空间', this.config.namespace || 'default');
      Logger.getInstance().info('语言文件', absOutput);
      Logger.getInstance().success('系统', '初始化完成');

      // Phase 2: 扫描文件
      const files = await fg(this.config.entry, {
        ignore: this.config.exclude,
        absolute: true,
      });

      Logger.getInstance().info('扫描启动', `将处理 ${files.length} 个文件`);
      AuditReporter.getInstance().setFilesScanned(files.length);

      // Phase 3: 全局解析与分析
      const fileItemsMap = new Map<string, { content: string; items: any[] }>();
      const textsToTranslate = new Set<string>();
      let processedCount = 0;

      for (const file of files) {
        processedCount++;
        const relativePath = file.replace(process.cwd() + '/', '');

        try {
          const content = await fs.readFile(file, 'utf-8');
          let items: any[] = [];

          if (file.endsWith('.vue')) {
            items = await this.vueParser.parse(file, content);
          } else if (/\.(js|ts|jsx|tsx)$/.test(file)) {
            items = await this.scriptParser.parse(file, content);
          }

          Logger.getInstance().info('扫描', `文件 ${relativePath}，提取到 ${items.length} 条文本`);
          Logger.getInstance().updateProgress(processedCount, files.length, '扫描文件');

          if (items.length > 0) {
            AuditReporter.getInstance().incrementTotalExtracted(items.length);

            for (const item of items) {
              const existingKey = KeyManager.getInstance().checkExisting(item.coreText);
              if (existingKey) {
                item.finalKey = existingKey;
              } else {
                textsToTranslate.add(item.coreText);
              }
            }

            fileItemsMap.set(file, { content, items });
          }
        } catch (err: any) {
          const reason = err.message || 'Unknown error';
          Logger.getInstance().error('错误', `处理文件失败: ${relativePath} - ${reason}`);
          AuditReporter.getInstance().addSkippedFile(relativePath, reason);
        }
      }

      Logger.getInstance().stopSpinner(true);
      Logger.getInstance().info('扫描汇总', `模块数 ${fileItemsMap.size}，待翻译文本 ${textsToTranslate.size}`);

      // Phase 4: 批量翻译
      if (textsToTranslate.size > 0) {
        Logger.getInstance().info('翻译准备', `共有 ${textsToTranslate.size} 条文案待处理`);
        Logger.getInstance().startSpinner('正在批量翻译...');

        const translationMap = await KeyGeneratorService.getInstance().generateKeys(Array.from(textsToTranslate));
        AuditReporter.getInstance().incrementTotalTranslated(textsToTranslate.size);

        Logger.getInstance().updateProgress(textsToTranslate.size, textsToTranslate.size, '翻译文案');
        Logger.getInstance().stopSpinner(true);
        Logger.getInstance().info('翻译完成', '机器翻译阶段结束');

        // Phase 5: 注册新 Key
        for (const [file, { items }] of fileItemsMap) {
          for (const item of items) {
            if (!item.finalKey) {
              const translated = translationMap.get(item.coreText);
              if (translated) {
                item.finalKey = KeyManager.getInstance().registerNewKey(item.coreText, translated);
                Logger.getInstance().info('新增键', `中文「${item.coreText}」 -> ${item.finalKey}`);
              } else {
                Logger.getInstance().warn('翻译', `词条 "${item.coreText}" 翻译失败，跳过替换`);
              }
            }
          }
        }

        // Phase 6: 保存语言包
        const newStructure = AuditReporter.getInstance().getNewlyAddedStructure();

        let totalNewKeys = 0;
        const countKeys = (obj: Record<string, any>) => {
          for (const k in obj) {
            if (typeof obj[k] === 'string') totalNewKeys++;
            else countKeys(obj[k]);
          }
        };
        countKeys(newStructure);

        if (!fs.existsSync(absOutput)) {
          Logger.getInstance().info('语言文件', `文件不存在，将创建：${absOutput}`);
        }

        Logger.getInstance().info('写入语言文件', `计划写入 ${totalNewKeys} 条`);

        if (this.config.dryRun) {
          Logger.getInstance().info('DryRun', `跳过保存语言包: ${absOutput}`);
        } else {
          await LocaleFileService.getInstance().save(newStructure);
          Logger.getInstance().success('语言文件', `写入完成：${absOutput}`);
        }

        if (totalNewKeys > 0) {
          Logger.getInstance().raw(JSON.stringify(newStructure, null, 2));
        }
        Logger.getInstance().success('流程完成', `新增 ${totalNewKeys} 条文案`);
      } else {
        Logger.getInstance().info('翻译', '没有需要新增的翻译词条。');
      }

      // Phase 7: 替换
      Logger.getInstance().info('替换计划', `将处理 ${fileItemsMap.size} 个文件`);
      const replacedFiles: string[] = [];

      for (const [file, { content, items }] of fileItemsMap) {
        const relativePath = file.replace(process.cwd() + '/', '');

        try {
          for (const item of items) {
            if (item.finalKey) {
              Logger.getInstance().info('替换详情', `中文「${item.coreText}」 -> ${item.finalKey} (成功)`);
            }
          }

          const replaced = await this.applyReplacementAndSave(file, content, items);
          if (replaced) {
            replacedFiles.push(relativePath);
          }
        } catch (err: any) {
          Logger.getInstance().error('错误', `替换文件失败: ${relativePath} - ${err.message}`);
        }
      }

      Logger.getInstance().success('替换结果', `已替换 ${replacedFiles.length} 个文件`);
      replacedFiles.forEach(f => Logger.getInstance().info('替换文件', `- ${f}`));

      // Phase 8: 生成报告
      const reportPath = await AuditReporter.getInstance().generateReport(this.config.logDir as string);
      Logger.getInstance().success('完成', `全部完成！审计报告已生成: ${reportPath}`);

      this.printSummary();
    } catch (error: any) {
      Logger.getInstance().stopSpinner(false, '执行出错');
      Logger.getInstance().error('系统', `执行过程中发生严重错误: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * 打印执行摘要
   */
  printSummary(): void {
    const stats = AuditReporter.getInstance().getStats();
    const skippedFiles = AuditReporter.getInstance().getSkippedFiles();

    const summary = [
      '',
      '==================================================',
      '                   执行摘要',
      '==================================================',
      `  总扫描文件:   ${stats.filesScanned}`,
      `  修改文件数:   ${stats.filesChanged}`,
      `  提取词条数:   ${stats.totalExtracted}`,
      `  翻译词条数:   ${stats.totalTranslated}`,
      `  复用词条数:   ${stats.totalReused}`,
    ];

    summary.push('==================================================');

    if (skippedFiles.length > 0) {
      summary.push('  ⚠️ 跳过文件 (因解析错误):');
      skippedFiles.forEach(f => {
        summary.push(`  - ${f.filePath}`);
        summary.push(`    └─ ${f.reason}`);
      });
      summary.push('==================================================');
    }

    summary.push('');
    Logger.getInstance().raw(summary.join('\n'));
  }

  /**
   * 应用代码替换并保存文件
   */
  private async applyReplacementAndSave(filePath: string, content: string, items: any[]): Promise<boolean> {
    const validItems = items.filter(i => i.finalKey);
    const replacer = new CodeReplacer(content, filePath);
    replacer.applyReplacements(validItems);

    // 依赖注入
    if (this.config.rules?.autoImport) {
      if (ContextAnalyzer.isVue3ScriptSetup(content)) {
        const scriptRange = ContextAnalyzer.getScriptSetupRange(content);
        if (scriptRange) {
          const hasItemInScript = validItems.some(
            item => item.start >= scriptRange.start && item.end <= scriptRange.end
          );
          if (hasItemInScript && ContextAnalyzer.needsTFunctionInjection(content)) {
            const importStmt = this.config.rules.jsImportStatement || "import { t } from '@/i18n'";
            replacer.injectImport(importStmt, 'vue');
          }
        }
      } else if (/\.(js|ts|jsx|tsx)$/.test(filePath)) {
        if (ContextAnalyzer.needsTFunctionInjection(content)) {
          const importStmt = this.config.rules.jsImportStatement || "import { t } from '@/i18n'";
          replacer.injectImport(importStmt, 'js');
        }
      }
    }

    if (!replacer.hasChanges()) return false;

    if (this.config.dryRun) {
      Logger.getInstance().info('DryRun', `跳过写入文件: ${filePath}`);
    } else {
      await fs.writeFile(filePath, replacer.getResult());
    }

    AuditReporter.getInstance().incrementFilesChanged();
    return true;
  }
}
