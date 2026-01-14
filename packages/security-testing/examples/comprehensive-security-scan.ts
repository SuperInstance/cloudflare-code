/**
 * Comprehensive Security Scan Example
 * Demonstrates running all security scanners together
 */

import { SecurityTesting, Severity } from '../src/index';

async function main() {
  // Create security testing instance
  const securityTesting = new SecurityTesting({
    logLevel: 'info',
  });

  // Load vulnerability database
  try {
    await securityTesting.loadVulnerabilityDatabase('./config/vulnerabilities.json');
    console.log('Vulnerability database loaded');
  } catch (error) {
    console.log('Using built-in vulnerability database');
  }

  // Load security policies
  try {
    await securityTesting.loadPolicies();
    console.log('Security policies loaded');
  } catch (error) {
    console.log('No custom policies found, using defaults');
  }

  // Run comprehensive scan
  console.log('\n=== Starting Comprehensive Security Scan ===\n');

  const startTime = Date.now();

  const results = await securityTesting.runComprehensiveScan(
    process.cwd(),
    {
      enableSAST: true,
      enableSCA: true,
      enableCompliance: false,
      enableDAST: false,
      severityThreshold: Severity.INFO,
      frameworks: [], // Add compliance frameworks if needed
    }
  );

  const duration = Date.now() - startTime;

  // Display summary
  console.log('\n=== Security Scan Summary ===');
  console.log(`Scan completed in ${duration}ms`);
  console.log(`\nTotal Findings: ${results.summary.totalFindings}`);
  console.log(`- Critical: ${results.summary.critical}`);
  console.log(`- High: ${results.summary.high}`);
  console.log(`- Medium: ${results.summary.medium}`);
  console.log(`- Low: ${results.summary.low}`);
  console.log(`- Info: ${results.summary.info}`);

  // SAST Results
  if (results.sast) {
    console.log('\n=== SAST Scan Results ===');
    console.log(`Files scanned: ${results.sast.stats.filesScanned}`);
    console.log(`Lines scanned: ${results.sast.stats.linesScanned}`);
    console.log(`Vulnerabilities found: ${results.sast.stats.total}`);
  }

  // SCA Results
  if (results.sca) {
    console.log('\n=== Dependency Scan Results ===');
    console.log(`Dependencies scanned: ${results.sca.stats.filesScanned}`);
    console.log(`Vulnerabilities found: ${results.sca.stats.vulnerabilitiesFound}`);

    if (results.sca.findings.length > 0) {
      console.log('\nVulnerable dependencies:');
      const vulnDeps = results.sca.findings.filter(
        (f: any) => f.type === 'VULNERABLE_DEPENDENCY'
      );
      for (const finding of vulnDeps.slice(0, 5)) {
        console.log(`  - ${finding.codeSnippet}`);
      }
    }
  }

  // Policy Evaluation
  if (results.policies) {
    console.log('\n=== Policy Evaluation ===');
    const passedPolicies = results.policies.filter((p: any) => p.passed).length;
    const failedPolicies = results.policies.filter((p: any) => !p.passed).length;
    console.log(`Policies evaluated: ${results.policies.length}`);
    console.log(`Passed: ${passedPolicies}`);
    console.log(`Failed: ${failedPolicies}`);

    for (const evaluation of results.policies) {
      if (!evaluation.passed) {
        console.log(`\nFailed Policy: ${evaluation.policyId}`);
        console.log(`Violations: ${evaluation.violations.length}`);
        for (const violation of evaluation.violations.slice(0, 3)) {
          console.log(`  - ${violation.rule.name}: ${violation.finding.title}`);
        }
      }
    }
  }

  // Risk Assessment
  console.log('\n=== Risk Assessment ===');
  if (results.summary.critical > 0) {
    console.log('⛔ CRITICAL: Immediate action required');
  } else if (results.summary.high > 5) {
    console.log('🔴 HIGH: Multiple high-severity issues found');
  } else if (results.summary.high > 0) {
    console.log('🟠 MEDIUM-HIGH: Address high-severity issues soon');
  } else if (results.summary.medium > 10) {
    console.log('🟡 MEDIUM: Multiple medium-severity issues found');
  } else if (results.summary.total > 0) {
    console.log('🟢 LOW: Minor issues found');
  } else {
    console.log('✅ EXCELLENT: No security issues found');
  }

  // Recommendations
  console.log('\n=== Recommendations ===');
  if (results.summary.critical > 0) {
    console.log('1. Address all critical vulnerabilities immediately');
  }
  if (results.summary.high > 0) {
    console.log('2. Review and fix high-severity issues');
  }
  if (results.summary.medium > 0) {
    console.log('3. Plan remediation for medium-severity issues');
  }
  console.log('4. Update dependencies to latest secure versions');
  console.log('5. Review and update security policies');
  console.log('6. Schedule regular security scans');

  // Save results
  const fs = await import('fs/promises');
  await fs.writeFile(
    'comprehensive-security-scan-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n✅ Results saved to comprehensive-security-scan-results.json');
}

main().catch(console.error);
