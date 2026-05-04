import { describe, it, expect } from 'vitest';
import { SpecParser } from '../spec-parser.js';
import { writeFileSync, unlinkSync } from 'fs';

describe('SpecParser', () => {
  const testYamlFile = 'test-spec.yaml';
  const testMarkdownFile = 'test-spec.md';

  afterEach(() => {
    try {
      unlinkSync(testYamlFile);
    } catch {}
    try {
      unlinkSync(testMarkdownFile);
    } catch {}
  });

  it('should parse YAML specifications correctly', () => {
    const yamlContent = `
specification:
  version: "1.0"
  name: "Test Spec"
  description: "A test specification"
  requirements:
    - id: "REQ-001"
      description: "Test requirement 1"
      priority: "high"
    - id: "REQ-002"
      description: "Test requirement 2"
      priority: "medium"
`;

    writeFileSync(testYamlFile, yamlContent);
    const spec = SpecParser.parse(testYamlFile);

    expect(spec.name).toBe('Test Spec');
    expect(spec.version).toBe('1.0');
    expect(spec.description).toBe('A test specification');
    expect(spec.requirements).toHaveLength(2);
    expect(spec.requirements[0].id).toBe('REQ-001');
    expect(spec.requirements[0].priority).toBe('high');
  });

  it('should parse Markdown specifications correctly', () => {
    const markdownContent = `
# My Test Specification

## Requirements

1. The system must authenticate users
2. The system must validate input data
3. The system must log all actions

REQ-CUSTOM: Custom requirement with explicit ID
`;

    writeFileSync(testMarkdownFile, markdownContent);
    const spec = SpecParser.parse(testMarkdownFile);

    expect(spec.name).toBe('My Test Specification');
    expect(spec.requirements).toHaveLength(4);
    expect(spec.requirements[0].id).toBe('REQ-001');
    expect(spec.requirements[0].description).toBe('The system must authenticate users');
    expect(spec.requirements[3].id).toBe('REQ-CUSTOM');
  });

  it('should handle missing spec files gracefully', () => {
    expect(() => SpecParser.parse('nonexistent.yaml')).toThrow();
  });
});