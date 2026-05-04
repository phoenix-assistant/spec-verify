import { Requirement, CodeSymbol, RequirementMapping } from './types.js';

export class RequirementMatcher {
  static mapRequirementsToCode(
    requirements: Requirement[], 
    symbols: CodeSymbol[],
    strategy: 'strict' | 'fuzzy' | 'ai' = 'fuzzy'
  ): RequirementMapping[] {
    const mappings: RequirementMapping[] = [];

    for (const requirement of requirements) {
      const mapping = this.mapSingleRequirement(requirement, symbols, strategy);
      if (mapping.symbols.length > 0) {
        mappings.push(mapping);
      }
    }

    return mappings;
  }

  private static mapSingleRequirement(
    requirement: Requirement,
    symbols: CodeSymbol[],
    strategy: string
  ): RequirementMapping {
    const mapping: RequirementMapping = {
      requirementId: requirement.id,
      symbols: [],
      confidence: 0,
      mappingType: 'inferred',
    };

    // 1. Direct annotation matching (highest confidence)
    const annotationMatches = this.findAnnotationMatches(requirement, symbols);
    if (annotationMatches.length > 0) {
      mapping.symbols = annotationMatches;
      mapping.confidence = 0.95;
      mapping.mappingType = 'annotation';
      return mapping;
    }

    // 2. Name-based matching
    const nameMatches = this.findNameMatches(requirement, symbols);
    
    // 3. Description-based matching
    const descriptionMatches = this.findDescriptionMatches(requirement, symbols);

    // Combine and score matches
    const allMatches = [...nameMatches, ...descriptionMatches];
    const uniqueMatches = this.deduplicateSymbols(allMatches);
    
    if (uniqueMatches.length > 0) {
      mapping.symbols = uniqueMatches;
      mapping.confidence = this.calculateConfidence(requirement, uniqueMatches, strategy);
    }

    return mapping;
  }

  private static findAnnotationMatches(requirement: Requirement, symbols: CodeSymbol[]): CodeSymbol[] {
    const reqId = requirement.id.toLowerCase();
    const matches: CodeSymbol[] = [];

    for (const symbol of symbols) {
      // Check for requirement ID in comments
      if (symbol.comments) {
        for (const comment of symbol.comments) {
          if (comment.toLowerCase().includes(reqId) || 
              comment.toLowerCase().includes(requirement.id) ||
              comment.includes(`@req ${requirement.id}`) ||
              comment.includes(`@requirement ${requirement.id}`)) {
            matches.push(symbol);
            break;
          }
        }
      }

      // Check for requirement ID in function/class names
      if (symbol.name.toLowerCase().includes(reqId.replace(/[^a-z0-9]/g, '')) ||
          symbol.signature?.toLowerCase().includes(reqId)) {
        matches.push(symbol);
      }
    }

    return matches;
  }

  private static findNameMatches(requirement: Requirement, symbols: CodeSymbol[]): CodeSymbol[] {
    const matches: CodeSymbol[] = [];
    const keywords = this.extractKeywords(requirement.description);
    
    for (const symbol of symbols) {
      const score = this.calculateNameMatchScore(symbol, keywords);
      if (score > 0.3) { // Threshold for name matching
        matches.push(symbol);
      }
    }

    return matches;
  }

  private static findDescriptionMatches(requirement: Requirement, symbols: CodeSymbol[]): CodeSymbol[] {
    const matches: CodeSymbol[] = [];
    const reqWords = this.tokenize(requirement.description.toLowerCase());
    
    for (const symbol of symbols) {
      const expandedName = symbol.name.replace(/([A-Z])/g, ' $1').toLowerCase();
      const symbolWords = this.tokenize((expandedName + ' ' + (symbol.signature || '')).toLowerCase());
      const commonWords = reqWords.filter(word => symbolWords.includes(word));
      
      if (commonWords.length >= 2 || (commonWords.length === 1 && commonWords[0].length > 5)) {
        matches.push(symbol);
      }
    }

    return matches;
  }

  private static extractKeywords(description: string): string[] {
    // Extract meaningful keywords from requirement description
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'must', 'shall', 'can', 'may', 'might']);
    
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }

  private static calculateNameMatchScore(symbol: CodeSymbol, keywords: string[]): number {
    const symbolName = symbol.name.toLowerCase();
    const symbolWords = symbol.name.replace(/([A-Z])/g, ' $1').toLowerCase().trim().split(/[\s_-]+/).filter(w => w.length > 0);
    
    let matches = 0;
    for (const keyword of keywords) {
      if (symbolName.includes(keyword) || symbolWords.some(word => word.includes(keyword))) {
        matches++;
      }
    }
    
    return Math.min(matches / keywords.length, 1.0);
  }

  private static tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private static deduplicateSymbols(symbols: CodeSymbol[]): CodeSymbol[] {
    const seen = new Set<string>();
    return symbols.filter(symbol => {
      const key = `${symbol.filePath}:${symbol.name}:${symbol.startLine}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private static calculateConfidence(requirement: Requirement, symbols: CodeSymbol[], strategy: string): number {
    if (symbols.length === 0) return 0;
    
    let baseScore = 0.5;
    
    // Adjust based on number of matches
    if (symbols.length === 1) {
      baseScore += 0.2;
    } else if (symbols.length <= 3) {
      baseScore += 0.1;
    }
    
    // Adjust based on matching strategy
    switch (strategy) {
      case 'strict':
        baseScore *= 0.8; // More conservative
        break;
      case 'fuzzy':
        baseScore *= 1.0; // Normal
        break;
      case 'ai':
        baseScore *= 1.2; // More aggressive
        break;
    }
    
    return Math.min(baseScore, 0.9); // Cap at 0.9 for inferred matches
  }

  static findOrphanCode(symbols: CodeSymbol[], mappings: RequirementMapping[]): CodeSymbol[] {
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

  static findUnmappedRequirements(requirements: Requirement[], mappings: RequirementMapping[]): Requirement[] {
    const mappedRequirements = new Set(mappings.map(m => m.requirementId));
    return requirements.filter(req => !mappedRequirements.has(req.id));
  }
}