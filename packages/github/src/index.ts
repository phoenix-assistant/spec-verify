import * as core from '@actions/core';
import * as github from '@actions/github';
import { existsSync } from 'fs';
import { SpecVerify, CoverageEngine, ScanOptions } from '@phoenixaihub/spec-verify-core';

interface ActionInputs {
  specFile: string;
  sourceDir: string;
  testDir: string;
  threshold: number;
  testThreshold: number;
  failOnDrift: boolean;
  failOnOrphans: boolean;
  commentPr: boolean;
}

async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    
    core.info('🔍 Running spec-verify analysis...');
    
    // Validate inputs
    if (!existsSync(inputs.specFile)) {
      core.setFailed(`Specification file not found: ${inputs.specFile}`);
      return;
    }
    
    if (!existsSync(inputs.sourceDir)) {
      core.setFailed(`Source directory not found: ${inputs.sourceDir}`);
      return;
    }

    // Run the analysis
    const specVerify = await SpecVerify.create();
    
    const scanOptions: ScanOptions = {
      sourceDir: inputs.sourceDir,
      testDir: existsSync(inputs.testDir) ? inputs.testDir : undefined,
      specFile: inputs.specFile,
      languages: ['javascript', 'typescript'],
      mappingStrategy: 'fuzzy',
    };

    const report = await specVerify.scan(scanOptions);
    
    // Set outputs
    const specCoverage = Math.round(report.specCoverage * 100);
    const testCoverage = Math.round(report.testCoverage * 100);
    
    core.setOutput('spec_coverage', specCoverage.toString());
    core.setOutput('test_coverage', testCoverage.toString());
    core.setOutput('requirements_total', report.totalRequirements.toString());
    core.setOutput('requirements_covered', report.coveredRequirements.toString());
    core.setOutput('drift_count', report.drift.length.toString());
    core.setOutput('orphans_count', report.orphans.length.toString());

    // Check thresholds and conditions
    let hasFailures = false;
    const messages: string[] = [];

    if (specCoverage < inputs.threshold) {
      hasFailures = true;
      messages.push(`❌ Spec coverage ${specCoverage}% below threshold ${inputs.threshold}%`);
    } else {
      messages.push(`✅ Spec coverage ${specCoverage}% meets threshold ${inputs.threshold}%`);
    }

    if (testCoverage < inputs.testThreshold) {
      hasFailures = true;
      messages.push(`❌ Test coverage ${testCoverage}% below threshold ${inputs.testThreshold}%`);
    } else {
      messages.push(`✅ Test coverage ${testCoverage}% meets threshold ${inputs.testThreshold}%`);
    }

    if (inputs.failOnDrift && report.drift.length > 0) {
      hasFailures = true;
      messages.push(`❌ ${report.drift.length} requirement(s) have drift`);
    } else if (report.drift.length > 0) {
      messages.push(`⚠️ ${report.drift.length} requirement(s) have drift (warning)`);
    }

    if (inputs.failOnOrphans && report.orphans.length > 0) {
      hasFailures = true;
      messages.push(`❌ ${report.orphans.length} orphan code symbol(s) detected`);
    } else if (report.orphans.length > 0) {
      messages.push(`ℹ️ ${report.orphans.length} orphan code symbol(s) detected`);
    }

    // Log summary
    core.info('📊 Analysis Results:');
    for (const message of messages) {
      core.info(message);
    }

    // Add PR comment if requested
    if (inputs.commentPr && github.context.payload.pull_request) {
      await addPRComment(report, specCoverage, testCoverage, messages);
    }

    // Fail the action if thresholds not met
    if (hasFailures) {
      core.setFailed('Specification verification failed - see analysis results above');
    } else {
      core.info('✅ Specification verification passed');
    }

  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}

function getInputs(): ActionInputs {
  return {
    specFile: core.getInput('spec_file') || 'spec.yaml',
    sourceDir: core.getInput('source_dir') || './src',
    testDir: core.getInput('test_dir') || './test',
    threshold: parseInt(core.getInput('threshold') || '80', 10),
    testThreshold: parseInt(core.getInput('test_threshold') || '60', 10),
    failOnDrift: core.getBooleanInput('fail_on_drift'),
    failOnOrphans: core.getBooleanInput('fail_on_orphans'),
    commentPr: core.getBooleanInput('comment_pr'),
  };
}

async function addPRComment(report: any, specCoverage: number, testCoverage: number, messages: string[]): Promise<void> {
  try {
    const token = core.getInput('GITHUB_TOKEN') || process.env.GITHUB_TOKEN;
    if (!token) {
      core.warning('GITHUB_TOKEN not provided, skipping PR comment');
      return;
    }

    const octokit = github.getOctokit(token);
    const context = github.context;

    const comment = generatePRComment(report, specCoverage, testCoverage, messages);

    // Check if we already have a comment from this action
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.pull_request!.number,
    });

    const existingComment = comments.find(comment => 
      comment.body?.includes('<!-- spec-verify-comment -->')
    );

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existingComment.id,
        body: comment,
      });
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.pull_request!.number,
        body: comment,
      });
    }

    core.info('✅ Added/updated PR comment with coverage report');
  } catch (error) {
    core.warning(`Failed to add PR comment: ${error}`);
  }
}

function generatePRComment(report: any, specCoverage: number, testCoverage: number, messages: string[]): string {
  const statusEmoji = specCoverage >= 80 && testCoverage >= 60 ? '✅' : '❌';
  
  return `<!-- spec-verify-comment -->
## ${statusEmoji} Specification Coverage Report

### Summary
| Metric | Value |
|--------|--------|
| **Spec Coverage** | ${specCoverage}% |
| **Test Coverage** | ${testCoverage}% |
| **Requirements** | ${report.coveredRequirements}/${report.totalRequirements} covered |
| **Drift Issues** | ${report.drift.length} |
| **Orphan Code** | ${report.orphans.length} symbols |

### Analysis Results
${messages.map(msg => `- ${msg}`).join('\n')}

${report.drift.length > 0 ? `
### ⚠️ Requirement Drift Detected
${report.drift.slice(0, 5).map((d: any) => `- **${d.requirementId}** (${d.driftType}): ${d.description}`).join('\n')}
${report.drift.length > 5 ? `\n_...and ${report.drift.length - 5} more issues_` : ''}
` : ''}

${report.untested.length > 0 ? `
### 🧪 Untested Requirements
${report.untested.slice(0, 10).join(', ')}
${report.untested.length > 10 ? `\n_...and ${report.untested.length - 10} more_` : ''}
` : ''}

---
*Generated by [spec-verify](https://github.com/phoenix-assistant/spec-verify)*`;
}

// Only run if this is the main module
if (require.main === module) {
  run();
}

export { run };