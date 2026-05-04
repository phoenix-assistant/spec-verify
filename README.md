# spec-verify — Specification Compliance Engine

## Problem
AI coding agents generate code rapidly but without traceability to requirements. Teams can't answer: "Does this codebase still satisfy our specifications?" No tool bridges the gap between structured specs and implementation verification at CI scale.

## Solution
Language-agnostic CI engine that:
1. Parses structured specifications (YAML, numbered markdown, any format)
2. Maps each requirement to implementation via AST-level tracing
3. Computes "spec coverage" metric (% of requirements with verified implementation + test)
4. Detects spec drift (code diverges from requirements), orphan code (untraceable), untested specs

## Market
- **Pain signal**: ACAI blog "acceptance coverage instead of test coverage" — numbered requirement IDs traced through code. Ouroboros (3.1K stars, 231/day): "Stop Prompting, Start Specifying". mattpocock/skills (56K stars): .claude specs exploding. VS Code Co-Authored-by controversy (1352 HN points): AI code needs traceability.
- **Gap**: ACAI built a format, ouroboros built a runtime, but nobody built the language-agnostic VERIFICATION engine that works in CI.
- **TAM**: Every team using AI coding agents (estimated 70% of dev teams by mid-2026) needs spec compliance.

## Architecture
```
specs/ (YAML/MD)  →  spec-parser  →  requirement graph
src/ (any lang)   →  tree-sitter  →  AST + call graph
tests/            →  coverage map →  test linkage

requirement graph × AST graph × coverage = spec-coverage score
```

### Components
- `@phoenixaihub/spec-verify-core` — Spec parser, AST mapper (tree-sitter WASM), graph matcher, coverage engine
- `@phoenixaihub/spec-verify-cli` — init, scan, report, badge, ci --threshold
- `@phoenixaihub/spec-verify-github` — GitHub Action + PR comments with spec coverage delta

## Competitive Landscape
- **Ouroboros**: Runtime agent OS, not verification. Complementary.
- **ACAI specsmaxxing**: Format spec, not enforcement engine. Complementary.
- **Traditional SAST**: Finds bugs, not spec compliance.
- **Test coverage tools**: Measure code coverage, not requirement coverage.

## Verdict: BUILD
- **Technical moat**: AST-level requirement tracing is algorithmically hard, not just API glue
- **Timing**: Spec-driven dev is the emerging consensus (Karpathy, ACAI, ouroboros, mattpocock)
- **Fit**: Perfectly aligns with phoenix-assistant devtools cluster (joins driftmap, diffsense, blastradius)
- **Feasibility**: Tree-sitter WASM + graph matching — proven stack from our other tools
- **First-mover**: No CI-integrated spec verification engine exists
