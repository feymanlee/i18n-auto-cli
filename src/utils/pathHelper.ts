import path from 'path';
import { ConfigManager } from '../config/ConfigManager';

/**
 * 路径助手类
 * 用于处理文件路径和生成作用域 (Scope)
 */
export class PathHelper {
  /**
   * 将文件路径转换为 Scope
   * 示例: src/views/home/index.vue -> views.home.index
   * @param filePath 文件路径
   */
  static toScope(filePath: string): string {
    const config = ConfigManager.getInstance().getConfig();
    const depth = config.depth || 3;

    // 1. 获取相对路径
    let relativePath: string;
    if (config.baseDir) {
      const absoluteBaseDir = path.resolve(process.cwd(), config.baseDir);
      relativePath = path.relative(absoluteBaseDir, filePath);
    } else {
      relativePath = path.relative(process.cwd(), filePath);
    }

    // 2. 规范化分隔符
    const normalizedPath = relativePath.split(path.sep).join('/');

    // 3. 去掉扩展名
    const pathWithoutExt = normalizedPath.replace(/\.[^/.]+$/, '');

    // 4. 分割并处理
    const parts = pathWithoutExt.split('/');

    // 如果没有配置 baseDir，保留原有的智能去除 'src' 逻辑
    if (!config.baseDir && parts[0] === 'src') {
      parts.shift();
    }

    // 5. 截取深度
    const scopeParts = parts.slice(0, depth);

    // 6. 转换为点分格式，并统一转为 camelCase
    const camelCaseParts = scopeParts.map((p) => this.toCamelCase(p));
    return camelCaseParts.join('.');
  }

  /**
   * 将字符串转换为驼峰格式
   * @param str 字符串
   */
  static toCamelCase(str: string): string {
    // 处理首字母小写，以及 kebab-case 转 camelCase
    const camel = str.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    let result = camel.charAt(0).toLowerCase() + camel.slice(1);
    // 如果结果以数字开头，添加前缀 'v'
    if (/^\d/.test(result)) {
      result = 'v' + result;
    }
    return result;
  }
}
