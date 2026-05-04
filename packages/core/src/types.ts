export interface Requirement {
  id: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  dependencies?: string[];
}

export interface Specification {
  version: string;
  name: string;
  description?: string;
  requirements: Requirement[];
}

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'method' | 'variable' | 'export';
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
  comments?: string[];
}

export interface RequirementMapping {
  requirementId: string;
  symbols: CodeSymbol[];
  confidence: number;
  mappingType: 'direct' | 'inferred' | 'annotation';
}

export interface TestMapping {
  testFilePath: string;
  testName: string;
  coveredSymbols: string[];
  requirementIds: string[];
}

export interface SpecCoverageReport {
  totalRequirements: number;
  coveredRequirements: number;
  testedRequirements: number;
  specCoverage: number;
  testCoverage: number;
  drift: RequirementDrift[];
  orphans: CodeSymbol[];
  untested: string[];
  mappings: RequirementMapping[];
  testMappings: TestMapping[];
}

export interface RequirementDrift {
  requirementId: string;
  symbols: CodeSymbol[];
  driftType: 'missing' | 'changed' | 'extra';
  description: string;
}

export interface ParseOptions {
  format?: 'yaml' | 'markdown' | 'auto';
  requirementIdPattern?: RegExp;
  includeComments?: boolean;
}

export interface ScanOptions {
  sourceDir: string;
  testDir?: string;
  specFile: string;
  languages?: string[];
  excludePatterns?: string[];
  mappingStrategy?: 'strict' | 'fuzzy' | 'ai';
}