import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const SCOPE_COLORS: Record<string, (text: string) => string> = {
  '系统': chalk.cyanBright,
  '扫描': chalk.blueBright,
  '扫描启动': chalk.blueBright,
  '扫描汇总': chalk.blueBright,
  '解析': chalk.magentaBright,
  '翻译': chalk.yellowBright,
  '翻译准备': chalk.yellowBright,
  '翻译完成': chalk.yellowBright,
  '替换': chalk.greenBright,
  '替换计划': chalk.greenBright,
  '替换结果': chalk.greenBright,
  '替换详情': chalk.greenBright,
  '替换文件': chalk.greenBright,
  '保存': chalk.cyanBright,
  '完成': chalk.greenBright,
  '流程完成': chalk.greenBright,
  '错误': chalk.redBright,
  '进度': chalk.whiteBright,
  '目标目录': chalk.cyan,
  '命名空间': chalk.cyan,
  '语言文件': chalk.cyan,
  '新增键': chalk.yellow,
  '写入语言文件': chalk.cyan,
  '写入键': chalk.cyan
};

/**
 * 日志工具类
 * 统一管理控制台输出和文件日志记录，支持进度条和颜色区分
 */
export class Logger {
  private static instance: Logger;
  private logFilePath: string | null = null;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private spinnerText = '';
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerFrameIndex = 0;
  private isSpinning = false;

  private constructor() {}

  /**
   * 获取 Logger 单例实例
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 初始化日志系统
   * @param logDir 日志输出目录。如果为 false，则不输出日志文件。
   */
  init(logDir: string | false = 'logs'): void {
    if (logDir === false) {
      this.logFilePath = null;
      return;
    }

    const dir = typeof logDir === 'string' ? logDir : 'logs';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;

    this.logFilePath = path.join(dir, `process_${timestamp}.log`);
    fs.ensureDirSync(dir);
    fs.writeFileSync(this.logFilePath, '');
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * 启动进度条 (Spinner)
   * @param text 提示文本
   */
  startSpinner(text: string): void {
    if (this.isSpinning) this.stopSpinner(false);
    this.isSpinning = true;
    this.spinnerText = text;
    this.spinnerFrameIndex = 0;
    process.stdout.write('\x1B[?25l');
    this.spinnerInterval = setInterval(() => {
      this.renderSpinner();
    }, 80);
  }

  /**
   * 更新进度条文本
   * @param text 新的提示文本
   */
  updateSpinner(text: string): void {
    this.spinnerText = text;
  }

  /**
   * 更新数字进度条
   * @param current 当前数量
   * @param total 总数量
   * @param text 描述文本
   */
  updateProgress(current: number, total: number, text = '处理进度'): void {
    const percentage = ((current / total) * 100).toFixed(1);
    this.spinnerText = `⏳ ${chalk.yellow(text)} 进度 ${chalk.green(`${current}/${total}`)} ${chalk.gray(`(${percentage}%)`)}`;
  }

  /**
   * 停止进度条
   * @param success 是否成功
   * @param text 结束时的文本
   */
  stopSpinner(success = true, text?: string): void {
    if (!this.isSpinning) return;
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    this.isSpinning = false;
    this.clearLine();
    process.stdout.write('\x1B[?25h');
    if (text) {
      if (success) {
        this.success('进度', text);
      } else {
        this.info('进度', text);
      }
    }
  }

  private renderSpinner(): void {
    this.clearLine();
    const frame = this.spinnerFrames[this.spinnerFrameIndex];
    this.spinnerFrameIndex = (this.spinnerFrameIndex + 1) % this.spinnerFrames.length;
    process.stdout.write(`${chalk.cyan(frame)} ${this.spinnerText}`);
  }

  private clearLine(): void {
    if (process.stdout.isTTY) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, scope: string, message: string, useColor = true): string {
    let levelTag = `[${level}]`;
    let scopeTag = `[${scope}]`;

    if (useColor) {
      switch (level) {
        case LogLevel.INFO:
          levelTag = chalk.cyanBright('[信息]');
          break;
        case LogLevel.SUCCESS:
          levelTag = chalk.greenBright('[成功]');
          break;
        case LogLevel.WARN:
          levelTag = chalk.yellowBright('[警告]');
          break;
        case LogLevel.ERROR:
          levelTag = chalk.redBright('[错误]');
          break;
      }
      const scopeColor = SCOPE_COLORS[scope] || chalk.gray;
      scopeTag = scopeColor(scopeTag);
    } else {
      switch (level) {
        case LogLevel.INFO:
          levelTag = `[信息]`;
          break;
        case LogLevel.SUCCESS:
          levelTag = `[成功]`;
          break;
        case LogLevel.WARN:
          levelTag = `[警告]`;
          break;
        case LogLevel.ERROR:
          levelTag = `[错误]`;
          break;
      }
      scopeTag = `[${scope}]`;
    }

    return `${levelTag} ${scopeTag} ${message}`;
  }

  /**
   * 写入日志
   */
  private write(level: LogLevel, scope: string, message: string): void {
    if (this.isSpinning) {
      this.clearLine();
    }
    console.log(this.formatMessage(level, scope, message, true));
    if (this.logFilePath) {
      const fileLine = this.formatMessage(level, scope, message, false) + '\n';
      fs.appendFileSync(this.logFilePath, fileLine);
    }
    if (this.isSpinning) {
      this.renderSpinner();
    }
  }

  info(scope: string, message: string): void {
    this.write(LogLevel.INFO, scope, message);
  }

  success(scope: string, message: string): void {
    this.write(LogLevel.SUCCESS, scope, message);
  }

  warn(scope: string, message: string): void {
    this.write(LogLevel.WARN, scope, message);
  }

  error(scope: string, message: string): void {
    this.write(LogLevel.ERROR, scope, message);
  }

  raw(message: string): void {
    if (this.isSpinning) {
      this.clearLine();
    }
    console.log(message);
    if (this.logFilePath) {
      fs.appendFileSync(this.logFilePath, message + '\n');
    }
    if (this.isSpinning) {
      this.renderSpinner();
    }
  }
}
