import { glob } from 'glob';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { 
  SpecCoverageReport, 
  RequirementMapping, 
  TestMapping, 
  CodeSymbol, 
  Requirement,
  RequirementDrift,
  ScanOptions 
} from './types.js';

export class CoverageEngine {
  static async generateReport(
    requirements: Requirement[],
    symbols: CodeSymbol[],
    mappings: RequirementMapping[],
    options: ScanOptions
  ): Promise<SpecCoverageReport> {
    
    const testMappings = options.testDir ? await this.analyzeTestCoverage(options.testDir, symbols) : [];
    const drift = this.detectRequirementDrift(requirements, mappings);
    const orphans = this.findOrphanCode(symbols, mappings);
    const untested = this.findUntestedRequirements(requirements, mappings, testMappings);

    const coveredRequirements = mappings.filter(m => m.symbols.length > 0).length;
    const testedRequirements = this.countTestedRequirements(mappings, testMappings);

    const specCoverage = requirements.length > 0 ? coveredRequirements / requirements.length : 0;
    const testCoverage = coveredRequirements > 0 ? testedRequirements / coveredRequirements : 0;

    return {
      totalRequirements: requirements.length,
      coveredRequirements,
      testedRequirements,
      specCoverage: Math.round(specCoverage * 100) / 100,
      testCoverage: Math.round(testCoverage * 100) / 100,
      drift,
      orphans,
      untested,
      mappings,
      testMappings,
    };
  }

  private static async analyzeTestCoverage(testDir: string, symbols: CodeSymbol[]): Promise<TestMapping[]> {
    const testMappings: TestMapping[] = [];
    
    try {
      const testFiles = await glob(`${testDir}/**/*.{test,spec}.{js,ts,jsx,tsx}`, {
        ignore: ['**/node_modules/**']
      });

      for (const testFile of testFiles) {
        if (existsSync(testFile)) {
          const mappings = await this.analyzeTestFile(testFile, symbols);
          testMappings.push(...mappings);
        }
      }
    } catch (error) {
      console.warn(`Error analyzing test coverage: ${error}`);
    }

    return testMappings;
  }

  private static async analyzeTestFile(testFile: string, symbols: CodeSymbol[]): Promise<TestMapping[]> {
    try {
      const content = readFileSync(testFile, 'utf-8');
      const mappings: TestMapping[] = [];
      
      // Extract test names and their covered symbols
      const testMatches = content.matchAll(/(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/g);
      
      for (const match of testMatches) {
        const testName = match[1];
        const coveredSymbols = this.findImportedSymbols(content, symbols);
        
        mappings.push({
          testFilePath: testFile,
          testName,
          coveredSymbols: coveredSymbols.map(s => s.name),
          requirementIds: [], // Would be populated by analyzing test content for requirement references
        });
      }

      return mappings;
    } catch (error) {
      console.warn(`Failed to analyze test file ${testFile}: ${error}`);
      return [];
    }
  }

  private static findImportedSymbols(testContent: string, symbols: CodeSymbol[]): CodeSymbol[] {
    const importedSymbols: CodeSymbol[] = [];
    
    // Find import statements
    const importMatches = testContent.matchAll(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"`]([^'"`]+)['"`]/g);
    
    for (const match of importMatches) {
      const [, namedImports, namespaceImport, defaultImport, modulePath] = match;
      
      if (namedImports) {
        // Handle named imports like { foo, bar }
        const names = namedImports.split(',').map(name => name.trim());
        for (const name of names) {
          const symbol = symbols.find(s => s.name === name && this.isRelatedModule(s.filePath, modulePath));
          if (symbol) {
            importedSymbols.push(symbol);
          }
        }
      } else if (namespaceImport || defaultImport) {
        // Handle namespace or default imports
        const importName = namespaceImport || defaultImport;
        const relatedSymbols = symbols.filter(s => this.isRelatedModule(s.filePath, modulePath));
        importedSymbols.push(...relatedSymbols);
      }
    }

    // Also look for direct function calls in the test
    for (const symbol of symbols) {
      if (testContent.includes(symbol.name)) {
        importedSymbols.push(symbol);
      }
    }

    return [...new Set(importedSymbols)]; // Deduplicate
  }

  private static isRelatedModule(symbolPath: string, importPath: string): boolean {
    // Simple heuristic to check if a symbol is from the imported module
    const symbolName = path.parse(symbolPath).name;
    const importName = path.parse(importPath).name;
    
    return symbolPath.includes(importPath) || 
           symbolName === importName ||
           importPath.includes(symbolName);
  }

  private static detectRequirementDrift(
    requirements: Requirement[], 
    mappings: RequirementMapping[]
  ): RequirementDrift[] {
    const drift: RequirementDrift[] = [];
    
    // Find requirements with low-confidence mappings (potential drift)
    for (const mapping of mappings) {
      if (mapping.confidence < 0.7 && mapping.symbols.length > 0) {
        drift.push({
          requirementId: mapping.requirementId,
          symbols: mapping.symbols,
          driftType: 'changed',
          description: `Low confidence mapping suggests implementation may have drifted from requirement`,
        });
      }
    }

    // Find requirements with no mappings (missing implementation)
    const mappedRequirementIds = new Set(mappings.map(m => m.requirementId));
    for (const requirement of requirements) {
      if (!mappedRequirementIds.has(requirement.id)) {
        drift.push({
          requirementId: requirement.id,
          symbols: [],
          driftType: 'missing',
          description: `No implementation found for requirement`,
        });
      }
    }

    return drift;
  }

  private static findOrphanCode(symbols: CodeSymbol[], mappings: RequirementMapping[]): CodeSymbol[] {
    const mappedSymbols = new Set<string>();
    
    for (const mapping of mappings) {
      for (const symbol of mapping.symbols) {
        mappedSymbols.add(`${symbol.filePath}:${symbol.name}:${symbol.startLine}`);
      }
    }
    
    return symbols.filter(symbol => {
      const key = `${symbol.filePath}:${symbol.name}:${symbol.startLine}`;
      return !mappedSymbols.has(key);
    });
  }

  private static findUntestedRequirements(
    requirements: Requirement[],
    mappings: RequirementMapping[],
    testMappings: TestMapping[]
  ): string[] {
    const testedSymbols = new Set<string>();
    
    for (const testMapping of testMappings) {
      for (const symbolName of testMapping.coveredSymbols) {
        testedSymbols.add(symbolName);
      }
    }

    const untestedRequirements: string[] = [];
    
    for (const mapping of mappings) {
      const hasTestedSymbol = mapping.symbols.some(symbol => testedSymbols.has(symbol.name));
      if (!hasTestedSymbol) {
        untestedRequirements.push(mapping.requirementId);
      }
    }

    return untestedRequirements;
  }

  private static countTestedRequirements(
    mappings: RequirementMapping[],
    testMappings: TestMapping[]
  ): number {
    const testedSymbols = new Set<string>();
    
    for (const testMapping of testMappings) {
      for (const symbolName of testMapping.coveredSymbols) {
        testedSymbols.add(symbolName);
      }
    }

    let testedCount = 0;
    
    for (const mapping of mappings) {
      const hasTestedSymbol = mapping.symbols.some(symbol => testedSymbols.has(symbol.name));
      if (hasTestedSymbol) {
        testedCount++;
      }
    }

    return testedCount;
  }

  static formatReport(report: SpecCoverageReport): string {
    const lines: string[] = [];
    
    lines.push('# Specification Coverage Report\n');
    lines.push('## Summary');
    lines.push(`- Total Requirements: ${report.totalRequirements}`);
    lines.push(`- Covered Requirements: ${report.coveredRequirements}`);
    lines.push(`- Tested Requirements: ${report.testedRequirements}`);
    lines.push(`- Spec Coverage: ${Math.round(report.specCoverage * 100)}%`);
    lines.push(`- Test Coverage: ${Math.round(report.testCoverage * 100)}%\n`);

    if (report.drift.length > 0) {
      lines.push('## Requirement Drift');
      for (const drift of report.drift) {
        lines.push(`- **${drift.requirementId}** (${drift.driftType}): ${drift.description}`);
      }
      lines.push('');
    }

    if (report.untested.length > 0) {
      lines.push('## Untested Requirements');
      for (const reqId of report.untested) {
        lines.push(`- ${reqId}`);
      }
      lines.push('');
    }

    if (report.orphans.length > 0) {
      lines.push('## Orphan Code');
      for (const orphan of report.orphans.slice(0, 10)) { // Show first 10
        lines.push(`- ${orphan.name} (${orphan.filePath}:${orphan.startLine})`);
      }
      if (report.orphans.length > 10) {
        lines.push(`- ... and ${report.orphans.length - 10} more`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}