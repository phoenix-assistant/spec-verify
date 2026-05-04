import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';
import { SpecVerify, CoverageEngine, ScanOptions } from '@phoenixaihub/spec-verify-core';

const program = new Command();

program
  .name('spec-verify')
  .description('Specification Compliance Engine - Verify code against structured requirements')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new specification file')
  .option('-f, --format <format>', 'Specification format (yaml|markdown)', 'yaml')
  .option('-o, --output <file>', 'Output file path', 'spec.yaml')
  .action(async (options) => {
    const spinner = ora('Creating specification file...').start();
    
    try {
      const specContent = generateSpecTemplate(options.format);
      writeFileSync(options.output, specContent);
      
      spinner.succeed(chalk.green(`✓ Created ${options.output}`));
      console.log(chalk.gray(`\nNext steps:`));
      console.log(chalk.gray(`1. Edit ${options.output} to define your requirements`));
      console.log(chalk.gray(`2. Run: spec-verify scan --spec ${options.output}`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to create specification: ${error}`));
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('Scan codebase for specification compliance')
  .option('-s, --spec <file>', 'Specification file path', 'spec.yaml')
  .option('-d, --source-dir <dir>', 'Source code directory', './src')
  .option('-t, --test-dir <dir>', 'Test directory', './test')
  .option('-l, --languages <langs>', 'Programming languages (comma-separated)', 'javascript,typescript')
  .option('-x, --exclude <patterns>', 'Exclude patterns (comma-separated)', 'node_modules,dist,build')
  .option('-m, --mapping <strategy>', 'Mapping strategy (strict|fuzzy|ai)', 'fuzzy')
  .option('-o, --output <file>', 'Output report file')
  .option('--json', 'Output report in JSON format')
  .action(async (options) => {
    await runScan(options);
  });

program
  .command('report')
  .description('Generate coverage report from previous scan')
  .option('-i, --input <file>', 'Input scan results file', '.spec-verify-cache.json')
  .option('-f, --format <format>', 'Report format (text|json|html)', 'text')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (options) => {
    await generateReport(options);
  });

program
  .command('ci')
  .description('Run verification for CI/CD with exit code based on thresholds')
  .option('-s, --spec <file>', 'Specification file path', 'spec.yaml')
  .option('-d, --source-dir <dir>', 'Source code directory', './src')
  .option('-t, --test-dir <dir>', 'Test directory', './test')
  .option('--threshold <percent>', 'Minimum spec coverage threshold', '80')
  .option('--test-threshold <percent>', 'Minimum test coverage threshold', '60')
  .option('--fail-on-drift', 'Fail if requirement drift is detected')
  .option('--fail-on-orphans', 'Fail if orphan code is detected')
  .action(async (options) => {
    await runCICheck(options);
  });

async function runScan(options: any) {
  if (!existsSync(options.spec)) {
    console.error(chalk.red(`✗ Specification file not found: ${options.spec}`));
    console.log(chalk.gray(`Run 'spec-verify init' to create one.`));
    process.exit(1);
  }

  if (!existsSync(options.sourceDir)) {
    console.error(chalk.red(`✗ Source directory not found: ${options.sourceDir}`));
    process.exit(1);
  }

  const spinner = ora('Analyzing codebase...').start();

  try {
    const specVerify = await SpecVerify.create();
    
    const scanOptions: ScanOptions = {
      sourceDir: options.sourceDir,
      testDir: existsSync(options.testDir) ? options.testDir : undefined,
      specFile: options.spec,
      languages: options.languages.split(',').map((l: string) => l.trim()),
      excludePatterns: options.exclude.split(',').map((p: string) => p.trim()),
      mappingStrategy: options.mapping,
    };

    const report = await specVerify.scan(scanOptions);
    
    // Cache results for later use
    writeFileSync('.spec-verify-cache.json', JSON.stringify(report, null, 2));
    
    spinner.stop();
    
    // Display results
    if (options.json) {
      const output = JSON.stringify(report, null, 2);
      if (options.output) {
        writeFileSync(options.output, output);
        console.log(chalk.green(`✓ Report saved to ${options.output}`));
      } else {
        console.log(output);
      }
    } else {
      const textReport = CoverageEngine.formatReport(report);
      if (options.output) {
        writeFileSync(options.output, textReport);
        console.log(chalk.green(`✓ Report saved to ${options.output}`));
      } else {
        console.log(textReport);
      }
    }

    // Summary
    console.log(chalk.cyan('\n📊 Summary:'));
    console.log(`Spec Coverage: ${chalk.bold(Math.round(report.specCoverage * 100))}%`);
    console.log(`Test Coverage: ${chalk.bold(Math.round(report.testCoverage * 100))}%`);
    console.log(`Requirements: ${report.coveredRequirements}/${report.totalRequirements} covered`);
    
    if (report.drift.length > 0) {
      console.log(chalk.yellow(`⚠️  ${report.drift.length} requirement(s) have drift`));
    }
    
    if (report.orphans.length > 0) {
      console.log(chalk.gray(`🔍 ${report.orphans.length} orphan code symbol(s) detected`));
    }

  } catch (error) {
    spinner.fail(chalk.red(`Scan failed: ${error}`));
    process.exit(1);
  }
}

async function runCICheck(options: any) {
  const spinner = ora('Running CI verification...').start();
  
  try {
    const specVerify = await SpecVerify.create();
    
    const scanOptions: ScanOptions = {
      sourceDir: options.sourceDir,
      testDir: existsSync(options.testDir) ? options.testDir : undefined,
      specFile: options.spec,
      languages: ['javascript', 'typescript'],
      mappingStrategy: 'fuzzy',
    };

    const report = await specVerify.scan(scanOptions);
    spinner.stop();
    
    // Check thresholds
    const specCoverage = report.specCoverage * 100;
    const testCoverage = report.testCoverage * 100;
    const threshold = parseFloat(options.threshold);
    const testThreshold = parseFloat(options.testThreshold);
    
    let hasFailures = false;
    
    console.log(chalk.cyan('🔍 CI Verification Results:\n'));
    
    // Spec coverage check
    if (specCoverage >= threshold) {
      console.log(chalk.green(`✓ Spec coverage: ${specCoverage.toFixed(1)}% (>= ${threshold}%)`));
    } else {
      console.log(chalk.red(`✗ Spec coverage: ${specCoverage.toFixed(1)}% (< ${threshold}%)`));
      hasFailures = true;
    }
    
    // Test coverage check
    if (testCoverage >= testThreshold) {
      console.log(chalk.green(`✓ Test coverage: ${testCoverage.toFixed(1)}% (>= ${testThreshold}%)`));
    } else {
      console.log(chalk.red(`✗ Test coverage: ${testCoverage.toFixed(1)}% (< ${testThreshold}%)`));
      hasFailures = true;
    }
    
    // Drift check
    if (options.failOnDrift && report.drift.length > 0) {
      console.log(chalk.red(`✗ Requirement drift detected: ${report.drift.length} issue(s)`));
      hasFailures = true;
    } else if (report.drift.length > 0) {
      console.log(chalk.yellow(`⚠️  Requirement drift detected: ${report.drift.length} issue(s) (warning)`));
    } else {
      console.log(chalk.green(`✓ No requirement drift detected`));
    }
    
    // Orphans check
    if (options.failOnOrphans && report.orphans.length > 0) {
      console.log(chalk.red(`✗ Orphan code detected: ${report.orphans.length} symbol(s)`));
      hasFailures = true;
    } else if (report.orphans.length > 0) {
      console.log(chalk.gray(`🔍 Orphan code detected: ${report.orphans.length} symbol(s) (info)`));
    } else {
      console.log(chalk.green(`✓ No orphan code detected`));
    }
    
    if (hasFailures) {
      console.log(chalk.red('\n❌ CI verification failed'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ CI verification passed'));
    }

  } catch (error) {
    spinner.fail(chalk.red(`CI verification failed: ${error}`));
    process.exit(1);
  }
}

async function generateReport(options: any) {
  // Implementation for generating reports from cached data
  console.log(chalk.gray('Report generation from cache - feature coming soon'));
}

function generateSpecTemplate(format: string): string {
  if (format === 'yaml') {
    return `specification:
  version: "1.0"
  name: "My Project Specification"
  description: "Specification for my project"
  
  requirements:
    - id: "REQ-001"
      description: "System must provide user authentication"
      priority: "high"
      tags: ["security", "auth"]
      
    - id: "REQ-002" 
      description: "System must validate user input"
      priority: "medium"
      tags: ["validation", "security"]
      
    - id: "REQ-003"
      description: "System must log all user actions"
      priority: "low"
      tags: ["logging", "audit"]
`;
  } else if (format === 'markdown') {
    return `# My Project Specification

## Requirements

1. System must provide user authentication (REQ-001)
2. System must validate user input (REQ-002) 
3. System must log all user actions (REQ-003)

## Additional Notes

Add any additional specification details here.
`;
  }
  
  throw new Error(`Unsupported format: ${format}`);
}

export { program };