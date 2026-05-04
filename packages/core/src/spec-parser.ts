import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { Specification, Requirement, ParseOptions } from './types.js';

export class SpecParser {
  static parse(specFilePath: string, options: ParseOptions = {}): Specification {
    const content = readFileSync(specFilePath, 'utf-8');
    const format = options.format || this.detectFormat(specFilePath, content);

    switch (format) {
      case 'yaml':
        return this.parseYaml(content);
      case 'markdown':
        return this.parseMarkdown(content, options);
      default:
        throw new Error(`Unsupported spec format: ${format}`);
    }
  }

  private static detectFormat(filePath: string, content: string): 'yaml' | 'markdown' {
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return 'yaml';
    }
    if (filePath.endsWith('.md')) {
      return 'markdown';
    }
    
    // Try to parse as YAML first
    try {
      yaml.load(content);
      return 'yaml';
    } catch {
      return 'markdown';
    }
  }

  private static parseYaml(content: string): Specification {
    try {
      const doc = yaml.load(content) as any;
      
      if (!doc.specification) {
        throw new Error('YAML must contain a "specification" root key');
      }

      const spec = doc.specification;
      const requirements: Requirement[] = (spec.requirements || []).map((req: any) => ({
        id: req.id || req.requirement_id,
        description: req.description || req.desc,
        priority: req.priority,
        tags: req.tags,
        dependencies: req.dependencies || req.depends_on,
      }));

      return {
        version: spec.version || '1.0',
        name: spec.name || 'Unnamed Specification',
        description: spec.description,
        requirements,
      };
    } catch (error) {
      throw new Error(`Failed to parse YAML spec: ${error}`);
    }
  }

  private static parseMarkdown(content: string, options: ParseOptions): Specification {
    const lines = content.split('\n');
    const requirements: Requirement[] = [];
    const idPattern = options.requirementIdPattern || /(?:^|\s)(?:REQ|R)[-_](\w+)(?:\s|$)/i;
    
    let currentSection = '';
    let specName = 'Unnamed Specification';
    let specVersion = '1.0';
    let specDescription = '';

    for (const line of lines) {
      // Extract spec metadata from headers
      if (line.startsWith('# ')) {
        specName = line.substring(2).trim();
        continue;
      }

      if (line.startsWith('## ')) {
        currentSection = line.substring(3).trim();
        continue;
      }

      // Look for numbered requirements
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        const [, num, description] = numberedMatch;
        requirements.push({
          id: `REQ-${num.padStart(3, '0')}`,
          description: description.trim(),
        });
        continue;
      }

      // Look for explicit requirement IDs like "REQ-CUSTOM: description" or inline
      const explicitMatch = line.match(/^(REQ[-_]\w+)[:\s]+(.+)/i);
      if (explicitMatch) {
        requirements.push({
          id: explicitMatch[1].toUpperCase(),
          description: explicitMatch[2].trim(),
        });
        continue;
      }

      // Look for inline requirement IDs
      const idMatch = line.match(idPattern);
      if (idMatch) {
        const id = idMatch[1];
        const description = line.replace(idPattern, '').trim();
        if (description) {
          requirements.push({
            id: `REQ-${id}`,
            description,
          });
        }
      }
    }

    return {
      version: specVersion,
      name: specName,
      description: specDescription,
      requirements,
    };
  }
}