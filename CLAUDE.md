# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`i18n-auto-cli` is a TypeScript CLI tool that automates i18n migration for Vue 2/3 and React projects. It parses source files using AST, extracts Chinese text, translates via various translation APIs, and replaces hardcoded text with i18n function calls (e.g., `$t('key')`) using magic-string for non-destructive code replacements.

## Common Commands

```bash
# Build the project (TypeScript compilation)
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run the CLI (after build)
auto-i18n -c i18n.config.js

# Dry run (no file modifications)
auto-i18n -d

# Scan specific file
auto-i18n -e src/views/Home.vue
```

## Architecture

The tool follows an 8-phase pipeline orchestrated by the **Director** class:

1. **Phase 1**: Initialize - Load config and locale files
2. **Phase 2**: Scan - Glob file discovery
3. **Phase 3**: Parse - AST-based Chinese text extraction using VueParser/ScriptParser
4. **Phase 4**: Translate - Call translation API (Google, Baidu, Volcengine, or empty)
5. **Phase 5**: Register - Key generation and locale file updates
6. **Phase 6**: Save - Write updated locale JSON files
7. **Phase 7**: Replace - Code replacement via magic-string, auto-import injection
8. **Phase 8**: Report - Generate audit logs

### Key Modules

- **Director** (`src/core/Director.ts`) - Main orchestrator, coordinates all 8 phases
- **VueParser** (`src/parsers/VueParser.ts`) - Parses .vue files (template + script), uses vue-eslint-parser
- **ScriptParser** (`src/parsers/ScriptParser.ts`) - Parses JS/TS/JSX/TSX files, uses Babel AST
- **KeyManager** (`src/core/KeyManager.ts`) - Manages i18n key generation and reuse (existing locale lookup)
- **CodeReplacer** (`src/transformer/CodeReplacer.ts`) - Applies replacements using magic-string
- **SnippetGenerator** (`src/transformer/SnippetGenerator.ts`) - Generates replacement snippets based on context
- **ConfigManager** (`src/config/ConfigManager.ts`) - Loads i18n.config.js via cosmiconfig, singleton pattern
- **KeyGeneratorService** (`src/services/KeyGeneratorService.ts`) - Hash key generation using HMAC-SHA256
- **LocaleFileService** (`src/services/LocaleFileService.ts`) - Reads/writes JSON locale files, singleton pattern
- **AuditReporter** (`src/services/AuditReporter.ts`) - Generates execution reports, singleton pattern
- **ContextAnalyzer** (`src/core/ContextAnalyzer.ts`) - Analyzes file context (Vue2/Vue3/React, script setup range)

### Parser Architecture

The parser system uses an abstract base class pattern:

- **BaseParser** (`src/parsers/BaseParser.ts`) - Defines `ParseItem` interface with fields like `text`, `coreText`, `start`, `end`, `type`, `variables` for template literals
- Parsers return `ParseItem[]` with extracted Chinese text and metadata for replacement
- Template literals with variables are converted to placeholder format (e.g., `欢迎 {0} {1}`) with `variables` array storing the original expressions

### Transformer Architecture

- **CodeReplacer** uses `magic-string` for non-destructive replacements (preserves formatting, comments)
- Replacements are applied in reverse order (by position) to prevent index offset issues
- **SnippetGenerator** generates appropriate replacement code based on context (Vue2 uses `this.$t`, Vue3/React uses `$t` or `t`)
- Auto-import injection detects when `$t` is used but not imported, then injects the configured import statement

### Translator System

Pluggable translator architecture in `src/services/translators/`:

- **GoogleTranslator** - Uses `@vitalets/google-translate-api`, supports proxy config
- **BaiduTranslator** - Uses Baidu Translate API
- **VolcengineTranslator** - Uses Volcengine LLM API (Doubao/DeepSeek), supports batch translation
- **EmptyTranslator** - No translation, only generates keys

### Configuration

Create `i18n.config.js` in project root:

```javascript
module.exports = {
  entry: ['src/views/'],              // Scan targets (glob patterns or directories)
  output: 'src/locales/zh-CN.json',   // Output locale file
  outputRoot: 'extraConfig',          // Optional: nest keys under this root object
  baseDir: 'src',                     // For computing module namespace
  depth: 3,                           // Key nesting depth
  hashLength: 16,                     // Hash key length (default: 16)
  hashSecret: 'your-secret',          // Optional secret for hash generation
  logDir: 'logs',                     // Log output directory (set to false to disable)
  exclude: ['node_modules', 'dist'],  // Excluded patterns
  ignoreAttributes: ['style', 'class'], // Attributes to ignore
  ignoreMethods: ['console.log'],     // Method calls to ignore
  targetLangList: ['en'],             // Target languages for translation
  rules: {
    autoImport: true,                 // Auto-inject $t import
    jsImportStatement: "import { $t } from '@/i18n';"
  },
  // translator: new GoogleTranslator({ proxyOption: { host: '127.0.0.1', port: 7890 } })
}
```

CLI overrides: `-c` (config), `-e` (entry), `-l` (log-dir), `-d` (dry-run).

### Key Design Decisions

1. **Flat key structure**: Keys are flat hashes (e.g., `46f1a387f267b882`) without module path prefixes
2. **Key reuse**: Before generating new keys, the system checks existing locale files for matching values
3. **Smart slicing**: Text is split into `prefix` (whitespace), `coreText` (translatable), `suffix` (whitespace) to preserve formatting
4. **Template literal handling**: Variables are extracted and replaced with `{0}`, `{1}` placeholders in translations
5. **Singleton pattern**: ConfigManager, LocaleFileService, AuditReporter, KeyManager are all singletons accessed via `getInstance()`
