# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`i18n-auto-cli` is a TypeScript CLI tool that automates i18n migration for Vue 2/3 and React projects. It parses source files using AST, extracts Chinese text, translates via Tencent Cloud TMT API, and replaces hardcoded text with i18n function calls (e.g., `$t('key')`) using magic-string for non-destructive code replacements.

## Common Commands

```bash
# Build the project (TypeScript compilation)
npm run build

# Run the CLI
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
4. **Phase 4**: Translate - Call Tencent Cloud TMT API (or mock if not configured)
5. **Phase 5**: Register - Key generation and locale file updates
6. **Phase 6**: Save - Write updated locale JSON files
7. **Phase 7**: Replace - Code replacement via magic-string, auto-import injection
8. **Phase 8**: Report - Generate audit logs

### Key Modules

- **Director** (`src/core/Director.js`) - Main orchestrator, coordinates all phases
- **VueParser** (`src/parsers/VueParser.js`) - Parses .vue files (template + script), uses vue-eslint-parser
- **ScriptParser** (`src/parsers/ScriptParser.js`) - Parses JS/TS/JSX/TSX files, uses Babel AST
- **KeyManager** (`src/core/KeyManager.js`) - Manages i18n key generation and reuse (existing locale lookup)
- **CodeReplacer** (`src/transformer/CodeReplacer.js`) - Applies replacements using magic-string
- **ConfigManager** (`src/config/ConfigManager.js`) - Loads i18n.config.js via cosmiconfig
- **KeyGeneratorService** (`src/services/KeyGeneratorService.js`) - Hash key generation using HMAC-SHA256
- **LocaleFileService** (`src/services/LocaleFileService.js`) - Reads/writes JSON locale files
- **AuditReporter** (`src/services/AuditReporter.js`) - Generates execution reports

### Configuration

Create `i18n.config.js` in project root:

```javascript
module.exports = {
  entry: ['src/views/'],          // Scan targets (glob patterns or directories)
  output: 'src/locales/zh-CN.json', // Output locale file
  baseDir: 'src',                 // For computing module namespace
  depth: 2,                       // Key nesting depth
  hashLength: 16,                 // Hash key length (default: 16)
  hashSecret: 'your-secret',      // Optional secret for hash generation
  rules: {
    autoImport: true,
    jsImportStatement: "import { $t } from '@/i18n';"
  }
}
```

The CLI also supports command-line overrides: `-c` (config), `-e` (entry), `-l` (log-dir), `-d` (dry-run).
