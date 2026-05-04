import { describe, it, expect } from 'vitest';
import { RequirementMatcher } from '../requirement-matcher.js';
import { Requirement, CodeSymbol } from '../types.js';

describe('RequirementMatcher', () => {
  const sampleRequirements: Requirement[] = [
    {
      id: 'REQ-001',
      description: 'System must authenticate users with valid credentials',
    },
    {
      id: 'REQ-002', 
      description: 'System must validate user input data',
    },
  ];

  const sampleSymbols: CodeSymbol[] = [
    {
      name: 'authenticateUser',
      type: 'function',
      filePath: 'src/auth.ts',
      startLine: 10,
      endLine: 25,
      signature: 'function authenticateUser(username: string, password: string)',
    },
    {
      name: 'validateInput',
      type: 'function', 
      filePath: 'src/validation.ts',
      startLine: 5,
      endLine: 15,
      signature: 'function validateInput(data: any)',
    },
    {
      name: 'Logger',
      type: 'class',
      filePath: 'src/logger.ts', 
      startLine: 1,
      endLine: 50,
      signature: 'class Logger',
    },
  ];

  it('should map requirements to code symbols based on naming', () => {
    const mappings = RequirementMatcher.mapRequirementsToCode(
      sampleRequirements,
      sampleSymbols,
      'fuzzy'
    );

    expect(mappings).toHaveLength(2);
    
    const authMapping = mappings.find(m => m.requirementId === 'REQ-001');
    expect(authMapping).toBeDefined();
    expect(authMapping!.symbols[0].name).toBe('authenticateUser');

    const validationMapping = mappings.find(m => m.requirementId === 'REQ-002');
    expect(validationMapping).toBeDefined();
    expect(validationMapping!.symbols[0].name).toBe('validateInput');
  });

  it('should find orphan code symbols', () => {
    const mappings = RequirementMatcher.mapRequirementsToCode(
      sampleRequirements,
      sampleSymbols,
      'fuzzy'
    );

    const orphans = RequirementMatcher.findOrphanCode(sampleSymbols, mappings);
    
    // Logger class should be orphaned as it doesn't map to any requirement
    expect(orphans).toHaveLength(1);
    expect(orphans[0].name).toBe('Logger');
  });

  it('should find unmapped requirements', () => {
    const limitedSymbols = [sampleSymbols[0]]; // Only authenticateUser
    
    const mappings = RequirementMatcher.mapRequirementsToCode(
      sampleRequirements,
      limitedSymbols,
      'fuzzy'
    );

    const unmapped = RequirementMatcher.findUnmappedRequirements(
      sampleRequirements,
      mappings
    );

    expect(unmapped).toHaveLength(1);
    expect(unmapped[0].id).toBe('REQ-002'); // validation requirement should be unmapped
  });
});