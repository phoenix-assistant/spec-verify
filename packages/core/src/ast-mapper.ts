import Parser from 'web-tree-sitter';
import { readFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { CodeSymbol } from './types.js';

export class ASTMapper {
  private parser: Parser | null = null;
  private languageMap = new Map<string, any>();

  async initialize() {
    await Parser.init();
    this.parser = new Parser();
  }

  async loadLanguage(language: string) {
    if (this.languageMap.has(language)) {
      return;
    }

    try {
      // Note: In production, these would be loaded from actual tree-sitter WASM files
      // For now, we'll simulate the language loading
      const langObj = await this.loadLanguageWasm(language);
      this.languageMap.set(language, langObj);
    } catch (error) {
      console.warn(`Failed to load language ${language}: ${error}`);
    }
  }

  private async loadLanguageWasm(language: string): Promise<any> {
    // This would load actual tree-sitter WASM files in production
    // For demo purposes, we'll return a mock language object
    return {
      name: language,
      loaded: true
    };
  }

  async extractSymbols(sourceDir: string, languages: string[] = ['javascript', 'typescript']): Promise<CodeSymbol[]> {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }

    const symbols: CodeSymbol[] = [];
    const extensions = this.getExtensionsForLanguages(languages);
    const pattern = `${sourceDir}/**/*.{${extensions.join(',')}}`;
    
    try {
      const files = await glob(pattern, { ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'] });
      
      for (const file of files) {
        if (existsSync(file)) {
          const fileSymbols = await this.extractSymbolsFromFile(file);
          symbols.push(...fileSymbols);
        }
      }
    } catch (error) {
      console.warn(`Error scanning files: ${error}`);
    }

    return symbols;
  }

  private getExtensionsForLanguages(languages: string[]): string[] {
    const extensionMap: Record<string, string[]> = {
      javascript: ['js', 'jsx'],
      typescript: ['ts', 'tsx'],
      python: ['py'],
      java: ['java'],
      csharp: ['cs'],
      cpp: ['cpp', 'cc', 'cxx'],
      c: ['c', 'h'],
      go: ['go'],
      rust: ['rs'],
      php: ['php'],
      ruby: ['rb'],
    };

    const extensions: string[] = [];
    for (const lang of languages) {
      const exts = extensionMap[lang];
      if (exts) {
        extensions.push(...exts);
      }
    }

    return extensions.length > 0 ? extensions : ['js', 'ts', 'jsx', 'tsx'];
  }

  private async extractSymbolsFromFile(filePath: string): Promise<CodeSymbol[]> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);
      
      // For now, we'll use a simple regex-based extraction for JS/TS
      // In production, this would use tree-sitter AST parsing
      return this.extractSymbolsRegex(content, filePath);
    } catch (error) {
      console.warn(`Failed to parse ${filePath}: ${error}`);
      return [];
    }
  }

  private extractSymbolsRegex(content: string, filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Function declarations
      const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (functionMatch) {
        symbols.push({
          name: functionMatch[1],
          type: 'function',
          filePath,
          startLine: i + 1,
          endLine: this.findBlockEnd(lines, i),
          signature: line.trim(),
        });
      }

      // Class declarations
      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          filePath,
          startLine: i + 1,
          endLine: this.findBlockEnd(lines, i),
          signature: line.trim(),
        });
      }

      // Method declarations (inside classes)
      const methodMatch = line.match(/^\s+(?:async\s+)?(\w+)\s*\(/);
      if (methodMatch && !line.includes('function')) {
        symbols.push({
          name: methodMatch[1],
          type: 'method',
          filePath,
          startLine: i + 1,
          endLine: this.findBlockEnd(lines, i),
          signature: line.trim(),
        });
      }

      // Arrow functions
      const arrowMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=.*=>/);
      if (arrowMatch) {
        symbols.push({
          name: arrowMatch[1],
          type: 'function',
          filePath,
          startLine: i + 1,
          endLine: i + 1,
          signature: line.trim(),
        });
      }

      // Exported constants/variables
      const exportMatch = line.match(/export\s+(?:const|let|var)\s+(\w+)/);
      if (exportMatch) {
        symbols.push({
          name: exportMatch[1],
          type: 'export',
          filePath,
          startLine: i + 1,
          endLine: i + 1,
          signature: line.trim(),
        });
      }
    }

    return symbols;
  }

  private findBlockEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }

    return startIndex + 1;
  }

  async extractComments(filePath: string): Promise<string[]> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const comments: string[] = [];
      
      // Extract single-line comments
      const singleLineComments = content.match(/\/\/.*$/gm);
      if (singleLineComments) {
        comments.push(...singleLineComments.map(c => c.substring(2).trim()));
      }

      // Extract multi-line comments
      const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g);
      if (multiLineComments) {
        comments.push(...multiLineComments.map(c => 
          c.substring(2, c.length - 2)
            .split('\n')
            .map(line => line.replace(/^\s*\*?\s?/, ''))
            .join(' ')
            .trim()
        ));
      }

      return comments;
    } catch (error) {
      return [];
    }
  }
}