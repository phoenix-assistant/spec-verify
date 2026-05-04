import { SpecParser } from './spec-parser.js';
import { ASTMapper } from './ast-mapper.js';
import { RequirementMatcher } from './requirement-matcher.js';
import { CoverageEngine } from './coverage-engine.js';
import { ScanOptions, SpecCoverageReport, Specification } from './types.js';

export class SpecVerify {
  private astMapper: ASTMapper;

  constructor() {
    this.astMapper = new ASTMapper();
  }

  async initialize(): Promise<void> {
    await this.astMapper.initialize();
  }

  async scan(options: ScanOptions): Promise<SpecCoverageReport> {
    // 1. Parse the specification
    const specification = SpecParser.parse(options.specFile);
    
    // 2. Extract code symbols from source
    const languages = options.languages || ['javascript', 'typescript'];
    await this.loadRequiredLanguages(languages);
    
    const symbols = await this.astMapper.extractSymbols(options.sourceDir, languages);
    
    // 3. Map requirements to code
    const mappings = RequirementMatcher.mapRequirementsToCode(
      specification.requirements, 
      symbols, 
      options.mappingStrategy || 'fuzzy'
    );
    
    // 4. Generate coverage report
    const report = await CoverageEngine.generateReport(
      specification.requirements,
      symbols,
      mappings,
      options
    );

    return report;
  }

  private async loadRequiredLanguages(languages: string[]): Promise<void> {
    for (const language of languages) {
      await this.astMapper.loadLanguage(language);
    }
  }

  static async create(): Promise<SpecVerify> {
    const instance = new SpecVerify();
    await instance.initialize();
    return instance;
  }
}

// Re-export all types and classes
export * from './types.js';
export { SpecParser } from './spec-parser.js';
export { ASTMapper } from './ast-mapper.js';
export { RequirementMatcher } from './requirement-matcher.js';
export { CoverageEngine } from './coverage-engine.js';