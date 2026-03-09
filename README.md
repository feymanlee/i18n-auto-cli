# i18n-auto-cli 项目文档

## 项目简介

`i18n-auto-cli` 是一个基于 TypeScript 开发的自动化国际化（i18n）迁移工具。它旨在帮助开发者将遗留的 Vue 2/3 和 React 项目快速迁移到国际化支持状态。

该工具通过 AST（抽象语法树）解析代码，自动识别并提取中文文本，调用腾讯云翻译 API 进行翻译，并以非破坏性的方式将代码中的硬编码中文替换为 i18n 键值引用（如 `$t('key')`）。

## 文档目录

为了方便阅读和维护，文档按模块进行了拆分：

- **[快速开始 / 使用说明](./docs/USAGE.md)**
  - 安装步骤
  - 配置文件详解 (`i18n.config.js`)
  - CLI 命令说明
  - 运行示例

- **[架构设计与运行逻辑](./docs/ARCHITECTURE.md)**
  - 核心架构图
  - 8 阶段处理流程详解
  - 核心模块说明 (Director, Parsers, Transformer)
  - 关键技术点 (AST, MagicString)

- **[开发指南](./docs/DEVELOPMENT.md)**
  - 项目目录结构
  - 开发规范与原则
  - 调试与测试

## 核心特性

- **多框架支持**: 完美支持 Vue 2 (Options API), Vue 3 (Composition API/Script Setup), React (JSX/TSX), 以及纯 JS/TS 文件。
- **零侵入性**: 严格遵循”零侵入”原则，使用 `magic-string` 进行基于 AST 的精确替换，保留原始代码格式、注释和空白。
- **智能提取**:
  - 自动识别模板文本、属性值、脚本字符串。
  - 智能切分：仅去除首尾空白，保留标点符号和数字在翻译文本中，以维护语境完整性（如 `放行时间(天):` 整体提取）。
  - 模板内混合文本整体提取（如 `<p>测试2下</p>`）。
  - 支持模板字符串变量提取：`欢迎 ${name}` → `$t('key', { arg0: name })`
- **命名参数支持**: 使用 `{arg0}`, `{arg1}` 占位符，支持不同语言调整参数顺序
- **自动依赖注入**:
  - 自动检测并注入 `$t` 函数引用 (React/JS/Vue3)。
  - 支持自定义注入语句。
- **可预测的 Key 生成**:
  - 使用 HMAC-SHA256 hash 算法，基于中文文本生成唯一 key
  - 支持配置 hash 长度 (`hashLength`) 和密钥 (`hashSecret`)
  - 相同文本始终生成相同的 key，确保可复现性
  - key 格式为扁平结构（如 `46f1a387f267b882`），不包含模块路径前缀
- **智能复用**: 自动在现有翻译文件中查找已存在的翻译，复用已有 key
- **审计报告**: 每次运行生成详细的日志文件，记录所有变更、新增词条和潜在问题。



# 使用说明

## 安装

由于这是一个 CLI 工具，建议在项目中作为开发依赖安装，或使用 `npx` 直接运行。

```bash
# 安装依赖
npm install
# 或者
yarn install
```

## 全局安装与使用 (支持老项目)

对于不想在项目中安装依赖的老项目，你可以将 `@feyman/i18n-auto-cli` 安装到全局环境。

```bash
# 全局安装
npm install -g @feyman/i18n-auto-cli
# 或者
yarn global add @feyman/i18n-auto-cli
```

安装完成后，你可以在任何项目目录下直接运行 `auto-i18n` 命令，无需在目标项目中安装任何依赖。

```bash
# 在老项目中运行
cd my-legacy-project
auto-i18n -c i18n.config.js
```

## CLI 命令详解

`auto-i18n` 支持多种命令行参数，用于灵活控制运行行为。

| 参数 | 简写 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `--config` | `-c` | 指定配置文件路径 | `-c ./config/i18n.js` |
| `--entry` | `-e` | 指定扫描入口 (覆盖配置) | `-e src/pages/Home.vue` |
| `--log-dir` | `-l` | 指定日志输出目录 | `-l ./logs` |
| `--dry-run` | `-d` | **空跑模式**：仅扫描和模拟替换，不修改任何文件 | `-d` |
| `--help` | `-h` | 查看帮助信息 | `-h` |

### 常用命令示例

**1. 使用指定配置文件运行**
```bash
auto-i18n -c i18n.config.js
```

**2. 仅扫描特定文件 (调试用)**
```bash
auto-i18n -e src/views/About.vue
```

**3. 空跑模式 (Dry Run)**
在不修改代码的情况下，查看会有哪些变更。非常适合在正式运行前进行检查。
```bash
auto-i18n -d
```
运行后，请查看生成的日志文件以确认提取和替换计划是否符合预期。

## 配置文件 (i18n.config.js)

在项目根目录下创建 `i18n.config.js` 文件。这是工具运行的核心配置文件。

```javascript
module.exports = {
  // [必填] 扫描入口
  // 支持三种写法：
  // 1. 标准 Glob 模式: ['src/**/*.{vue,js,ts,jsx,tsx}']
  // 2. 目录简写 (推荐): ['src/views/'] -> 自动补全为 src/views/**/*.{vue,js,ts,jsx,tsx}
  // 3. 自定义 Glob: ['src/**/*.vue'] -> 仅扫描 vue 文件
  entry: ['src/views/'],
  
  // [必填] 中文语言包输出路径
  output: 'src/locales/zh-CN.json',

  // [可选] 输出根对象 Key
  // 如果设置，翻译内容将写入该对象下，而不是直接写入文件根目录。
  // 适用于需要将翻译数据嵌套在特定对象中的场景。
  outputRoot: 'extraConfig',
  
  // [必填] 基础目录，用于计算模块命名空间
  // 例如文件 src/views/Home.vue，baseDir 为 src，则模块名为 views.home
  baseDir: 'src',

  // 日志输出目录 (可选，默认为 'logs')
  // 如果设置为 false，则不输出日志文件
  logDir: 'custom-logs',

  // [可选] Hash Key 长度 (默认 16)
  // 生成的 key 将截取 hash 的前 N 位
  hashLength: 16,

  // [可选] Hash 密钥 (可选)
  // 用于生成 hash 的盐值，相同的文本 + 相同的密钥 = 相同的 key
  hashSecret: 'your-secret-key',

  // 命名空间深度 (默认 3)
  depth: 3,

  // [可选] 排除的文件/文件夹
  exclude: ['node_modules', 'dist', 'test', '**/*.d.ts'],

  // [可选] 忽略的属性名列表
  // 支持普通属性 (如 'label') 和指令参数 (如 'other-functions' 对应 :other-functions="...")
  ignoreAttributes: ['style', 'class', 'form', 'other-functions'],

  // [可选] 忽略的方法名列表
  // 调用这些方法时，其参数中的中文将不会被提取
  ignoreMethods: ['console.log', 'download'],
  
  // 转换规则配置
  rules: {
    // 是否开启自动注入依赖
    autoImport: true,

    // JS/TS/React/Vue3 Setup 中注入的引用语句
    // 如果检测到使用了 $t() 但未定义，会自动在头部插入此语句
    // 默认使用 $t，如需使用 t 请修改此处并自行处理代码替换逻辑
    jsImportStatement: "import { $t } from '@/i18n';",
  },

  // [可选] 翻译器配置
  // 支持三种翻译器：GoogleTranslator (默认), BaiduTranslator, EmptyTranslator
  // translator: new GoogleTranslator(),

  // Google 翻译器配置 (可选)
  // translator: new GoogleTranslator({
  //   proxyOption: {
  //     host: '127.0.0.1',  // 代理服务器地址
  //     port: 7890,         // 代理服务器端口
  //     headers: { 'User-Agent': 'Node' }
  //   },
  //   interval: 1000  // 翻译请求间隔 (毫秒)
  // }),

  // 百度翻译器配置
  // translator: new BaiduTranslator({
  //   appId: 'your-app-id',
  //   appKey: 'your-app-key'
  // }),

  // 火山引擎翻译器配置 (豆包/DeepSeek)
  // translator: new VolcengineTranslator({
  //   apiKey: 'your-api-key',
  //   model: 'doubao-1-5-pro-32k-250115',
  //   desc: '一个 web 平台'  // 可选
  // }),

  // 空翻译器 (不翻译，只生成 key)
  // translator: new EmptyTranslator(),

  // [可选] 目标语言列表 (默认 ['en'])
  // 会生成多个语言文件: zh-CN.json, en.json, ja.json 等
  // 设置为 [] 则不翻译，只生成 key
  // targetLangList: ['en', 'ja', 'ko'],
};
```

## 高级配置说明

### 翻译器配置

工具支持可插拔的翻译器架构，目前提供四种翻译器：

#### 1. Google 翻译器 (默认)

基于 `@vitalets/google-translate-api`，需要代理才能访问 Google 翻译服务。

```javascript
const { GoogleTranslator } = require('i18n-auto-cli/dist/services/translators/google');

module.exports = {
  translator: new GoogleTranslator({
    // 代理配置 (可选)
    proxyOption: {
      host: '127.0.0.1',
      port: 7890,
      headers: { 'User-Agent': 'Node' }
    },
    // 翻译请求间隔 (默认 1000ms)
    interval: 1000
  }),
  targetLangList: ['en', 'ja', 'ko']
};
```

#### 2. 百度翻译器

基于百度翻译 API，需要申请 App ID 和 App Key。

```javascript
const { BaiduTranslator } = require('i18n-auto-cli/dist/services/translators/baidu');

module.exports = {
  translator: new BaiduTranslator({
    appId: 'your-app-id',
    appKey: 'your-app-key'
  })
};
```

> 百度翻译 API 申请地址：https://api.fanyi.baidu.com/product/113

#### 3. 火山引擎翻译器 (豆包/DeepSeek)

基于火山引擎大模型 API，支持豆包、DeepSeek 等多种模型，翻译质量更高。支持批量翻译（默认 50 个文本并行），翻译速度快。

```javascript
const { VolcengineTranslator } = require('i18n-auto-cli/dist/services/translators/volcengine');

module.exports = {
  translator: new VolcengineTranslator({
    apiKey: 'your-api-key',
    model: 'doubao-1-5-pro-32k-250115',
    desc: '一个 web 平台',  // 可选，对项目的描述，有助于提高翻译质量
    // interval: 1000,      // 可选，请求间隔（毫秒），默认不间隔
    // proxy: {             // 可选，代理配置
    //   host: '127.0.0.1',
    //   port: 7890
    // }
  })
};
```

> 火山引擎控制台：https://console.volcengine.com/ark/
>
> 模型列表请参阅：https://www.volcengine.com/docs/82379/1099455

**支持的模型示例：**
- `doubao-1-5-pro-32k-250115` - 豆包 Pro 32K
- `deepseek-r1` - DeepSeek R1

**配置说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| apiKey | string | 是 | 火山引擎 API Key |
| model | string | 是 | 调用的模型名称 |
| desc | string | 否 | 项目描述，有助于提高翻译质量 |
| interval | number | 否 | 请求间隔（毫秒），默认 0（无间隔） |
| proxy | object | 否 | 代理配置 |

#### 4. 空翻译器

不进行翻译，只生成 key。适用于只想提取中文文本但不翻译的场景。

```javascript
const { EmptyTranslator } = require('i18n-auto-cli/dist/services/translators/empty');

module.exports = {
  translator: new EmptyTranslator()
};
```

### 多语言文件生成

通过 `targetLangList` 配置目标语言列表，会自动生成对应的语言文件：

```javascript
module.exports = {
  output: 'src/locales/zh-CN.json',
  targetLangList: ['en', 'ja', 'ko']
};
```

运行后会生成：
- `zh-CN.json` - 中文原文
- `en.json` - 英文翻译
- `ja.json` - 日文翻译
- `ko.json` - 韩文翻译

**特殊配置：**

- 不翻译：设置 `targetLangList: []`（空数组），只生成 key 和中文语言文件，不调用翻译 API
- 单语言：设置 `targetLangList: ['en']`，只生成英文翻译文件

### 扫描入口 (Entry) 配置

`entry` 字段支持极高的灵活性，您可以根据需要混合使用以下三种模式：

1.  **目录简写 (推荐)**
    *   **写法**: 指定一个目录路径（以 `/` 结尾或指向存在的目录）。
    *   **行为**: 工具会自动追加默认的文件匹配后缀 `**/*.{vue,js,ts,jsx,tsx}`。
    *   **示例**: `['src/views/']` 等同于 `['src/views/**/*.{vue,js,ts,jsx,tsx}']`。

2.  **自定义 Glob 模式**
    *   **写法**: 路径字符串中包含 `*` 通配符。
    *   **行为**: 工具会完全按照您编写的规则进行匹配，**不会**自动追加后缀。
    *   **示例**: `['src/**/*.vue']` (仅扫描 Vue 文件)，`['src/utils/*.ts']` (仅扫描 utils 根目录下的 TS 文件)。

3.  **混合使用**
    *   **示例**:
        ```javascript
        entry: [
          'src/views/',             // 简写：扫描 views 下所有支持的文件
          'src/legacy/**/*.js',     // 自定义：只扫描 legacy 下的 js
          'src/components/Base.vue' // 精确：只扫描特定文件
        ]
        ```

## 运行命令

### 常用参数

- `-c, --config <path>`: 指定配置文件路径 (默认为 `i18n.config.js`，如果文件在根目录可省略)。
- `-l, --log-dir <path>`: 指定日志输出目录 (覆盖配置文件中的 logDir)。
- `-d, --dry-run`:  试运行，不修改文件。

## 模板字符串处理

工具支持提取模板字符串中的变量，并生成命名参数格式的 i18n 调用：

**输入代码：**
```vue
<template>
  <div :title="`确定上架促销【${row.title}】？`">
    {{ `欢迎${user.name}登录` }}
  </div>
</template>
```

**输出代码：**
```vue
<template>
  <div :title="$t('key1', { arg0: row.title })">
    {{ $t('key2', { arg0: user.name }) }}
  </div>
</template>
```

**生成的语言文件：**
```json
{
  "key1": "确定上架促销【{arg0}】？",
  "key2": "欢迎{arg0}登录"
}
```

**多变量支持：**
```javascript
// 输入
const msg = `你好 ${firstName} ${lastName}`;

// 输出
const msg = $t('key', { arg0: firstName, arg1: lastName });

// 语言文件
{
  "key": "你好{arg0}{arg1}"
}
```

**优势：** 不同语言的翻译可以调整参数顺序，例如英文可以翻译为 `"Hello {arg1} {arg0}"`。

## 运行结果

运行完成后，工具会输出：

1.  **终端摘要**: 显示扫描文件数、修改文件数、新增词条数等统计信息。
2.  **日志文件**: 在 `logs/` 目录下生成 `process_YYYY-MM-DD...log` 文件，包含详细的执行记录、替换详情和新增的 JSON 结构。
3.  **语言包更新**: 指定的 `zh-CN.json` 文件会被更新，新增的翻译词条会自动写入。
4.  **代码变更**: 源代码文件中的中文会被替换为 `$t('...')`，并根据需要自动注入 import 语句。

## 常见问题

### 1. 为什么我的文件没有被修改？
- 检查 `entry` 配置是否正确匹配到了文件。
- 检查文件中是否确实包含中文字符。
- 工具会自动跳过已经包含在 `t('...')` 或 `$t('...')` 中的中文。
- 检查日志文件中的 `[扫描]` 部分，确认文件是否被正确识别。

### 2. 自动注入的 import 语句不正确？
- 请在 `i18n.config.js` 的 `rules.jsImportStatement` 中配置符合你项目规范的引入语句。

### 3. 翻译结果不准确？
- 机器翻译仅供参考。工具生成的 Key 和翻译值都保存在 JSON 文件中，你可以随时手动校对和修改 JSON 文件。工具下次运行时会优先复用已有的 Key。

