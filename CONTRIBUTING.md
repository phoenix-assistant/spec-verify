# Contributing to spec-verify

We welcome contributions to spec-verify! This document provides guidelines for contributing.

## Development Setup

### Prerequisites
- Node.js 18+ 
- pnpm 8+

### Installation
```bash
git clone https://github.com/phoenix-assistant/spec-verify.git
cd spec-verify
pnpm install
```

### Building
```bash
pnpm build
```

### Testing
```bash
pnpm test
```

### Linting
```bash
pnpm lint
```

## Project Structure

```
spec-verify/
├── packages/
│   ├── core/           # Core spec parsing and analysis engine
│   ├── cli/            # Command-line interface
│   └── github/         # GitHub Action
├── docs/               # Documentation
└── examples/           # Example specifications and usage
```

## Architecture

spec-verify follows a modular architecture:

1. **Spec Parser**: Parses YAML/Markdown specs into requirement graphs
2. **AST Mapper**: Uses tree-sitter to extract code symbols from source files
3. **Requirement Matcher**: Maps requirements to code using various strategies
4. **Coverage Engine**: Generates comprehensive coverage reports

## Adding Features

### New Language Support
To add support for a new programming language:

1. Add tree-sitter parser for the language to `packages/core`
2. Update `ASTMapper` to handle language-specific syntax
3. Add tests for the new language
4. Update documentation

### New Spec Formats
To add support for a new specification format:

1. Extend `SpecParser` with new format handler
2. Add format detection logic
3. Add tests for the new format
4. Update CLI to support the format

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `pnpm test`
6. Ensure linting passes: `pnpm lint`
7. Commit your changes: `git commit -am 'Add feature'`
8. Push to your fork: `git push origin feature-name`
9. Create a Pull Request

## Code Style

- We use TypeScript throughout the project
- Code is formatted with Prettier
- Code is linted with ESLint
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

## Testing

- Unit tests are written with Vitest
- Aim for high test coverage on new code
- Integration tests should cover end-to-end workflows
- Add tests that verify both success and failure cases

## Documentation

- Update README.md if adding new features
- Add JSDoc comments to new public APIs
- Update this CONTRIBUTING.md if changing development workflow
- Consider adding examples for new features

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions about architecture or design
- Check existing issues and discussions before creating new ones

Thank you for contributing to spec-verify!