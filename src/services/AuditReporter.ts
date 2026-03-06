import { set } from 'lodash';
import { Logger } from '../utils/Logger';

interface ReusedLog {
  filePath: string;
  sourceText: string;
  matchedKey: string;
  source: string;
}

interface SkippedFile {
  filePath: string;
  reason: string;
}

interface Meta {
  timestamp: string;
  duration: number;
  filesScanned: number;
  filesChanged: number;
  totalExtracted: number;
  totalTranslated: number;
  totalReused: number;
}

/**
 * 审计报告生成器
 * 负责收集运行过程中的数据，并生成最终的审计报告
 */
export class AuditReporter {
  private static instance: AuditReporter;
  private startTime = Date.now();
  private logData: {
    meta: Meta;
    newlyAddedStructure: Record<string, any>;
    reusedLogs: ReusedLog[];
    failures: any[];
    skippedFiles: SkippedFile[];
  };

  private constructor() {
    this.logData = {
      meta: {
        timestamp: new Date().toISOString(),
        duration: 0,
        filesScanned: 0,
        filesChanged: 0,
        totalExtracted: 0,
        totalTranslated: 0,
        totalReused: 0,
      },
      newlyAddedStructure: {},
      reusedLogs: [],
      failures: [],
      skippedFiles: [],
    };
  }

  static getInstance(): AuditReporter {
    if (!AuditReporter.instance) {
      AuditReporter.instance = new AuditReporter();
    }
    return AuditReporter.instance;
  }

  setFilesScanned(count: number): void {
    this.logData.meta.filesScanned = count;
  }

  incrementFilesChanged(): void {
    this.logData.meta.filesChanged++;
  }

  incrementTotalExtracted(count = 1): void {
    this.logData.meta.totalExtracted += count;
  }

  incrementTotalTranslated(count = 1): void {
    this.logData.meta.totalTranslated += count;
  }

  getStats(): Meta {
    return this.logData.meta;
  }

  addNewKey(scope: string, key: string, value: string): void {
    // 如果 scope 为空，直接使用 key 作为路径
    const fullPath = scope ? `${scope}.${key}` : key;
    set(this.logData.newlyAddedStructure, fullPath, value);
  }

  addReusedLog(log: ReusedLog): void {
    this.logData.reusedLogs.push(log);
    this.logData.meta.totalReused++;
  }

  addFailure(log: any): void {
    this.logData.failures.push(log);
  }

  addSkippedFile(filePath: string, reason: string): void {
    this.logData.skippedFiles.push({ filePath, reason });
  }

  getSkippedFiles(): SkippedFile[] {
    return this.logData.skippedFiles;
  }

  getNewlyAddedStructure(): Record<string, any> {
    return this.logData.newlyAddedStructure;
  }

  async generateReport(_outputDir = 'logs'): Promise<string> {
    this.logData.meta.duration = Date.now() - this.startTime;
    const logPath = Logger.getInstance().getLogFilePath();
    return logPath || '未生成日志文件';
  }
}
