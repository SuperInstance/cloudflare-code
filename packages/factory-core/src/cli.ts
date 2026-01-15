#!/usr/bin/env node

/**
 * ClaudeFlare Factory CLI
 * Command line interface for the Application Factory
 */

import { Command } from 'commander';
import { generateProject } from './project-generator';
import { analyzeRequirements } from './requirement-analyzer';
import { recommendArchitecture } from './architecture-engine';
import { calculateCosts } from './cost-calculator';
import { templateRegistry } from './template-registry';
import { ResourcePlanner } from './resource-planner';

const program = new Command();

program
  .name('claudeflare-factory')
  .description('ClaudeFlare Application Factory CLI')
  .version('0.1.0');

// Generate project command
program
  .command('generate')
  .alias('g')
  .description('Generate a new Cloudflare application')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --description <description>', 'Project description')
  .option('-t, --type <type>', 'Project type (saas, api, frontend, backend, fullstack)')
  .option('-f, --framework <framework>', 'Framework to use')
  .option('-l, --language <language>', 'Programming language')
  .option('--template <template>', 'Template to use')
  .option('--output-dir <dir>', 'Output directory', './projects')
  .option('--database <database>', 'Database type')
  .option('--auth <auth>', 'Authentication type')
  .option('--no-git', 'Skip git initialization')
  .option('--no-tests', 'Skip test generation')
  .option('--no-linting', 'Skip linting configuration')
  .option('--no-typecheck', 'Skip TypeScript configuration')
  .option('--no-ci', 'Skip CI configuration')
  .option('--no-docs', 'Skip documentation')
  .action(async (options) => {
    try {
      if (!options.name || !options.description) {
        console.error('Error: Both name and description are required');
        process.exit(1);
      }

      console.log(`Generating ${options.name}...`);

      const projectSpec = {
        name: options.name,
        description: options.description,
        type: options.type as any,
        features: [],
        technologies: [],
        requirements: [],
        constraints: [],
        outputDir: options.outputDir
      };

      const generateOptions = {
        ...projectSpec,
        template: options.template,
        framework: options.framework,
        language: options.language,
        database: options.database,
        auth: options.auth,
        testing: options.tests,
        linting: options.linting,
        typeCheck: options.typecheck,
        ci: options.ci,
        docs: options.docs,
        git: !options.noGit
      };

      const result = await generateProject(generateOptions);

      if (result.success) {
        console.log(`✅ Project generated successfully!`);
        console.log(`📁 Project location: ${result.projectPath}`);
        console.log(`📋 Template: ${result.template}`);
        console.log(`🏗️  Architecture: ${result.architecture?.patterns.join(', ')}`);
        console.log(`💰 Estimated cost: $${result.costAnalysis?.monthly.total.toFixed(2)}/month`);

        console.log('\n🚀 Next steps:');
        result.commands.forEach((command, index) => {
          console.log(`${index + 1}. ${command}`);
        });

        if (result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:');
          result.warnings.forEach(warning => {
            console.log(`  - ${warning}`);
          });
        }
      } else {
        console.error('❌ Project generation failed:');
        result.errors.forEach(error => {
          console.error(`  - ${error}`);
        });
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Analyze requirements command
program
  .command('analyze')
  .alias('a')
  .description('Analyze requirements and generate insights')
  .argument('<description>', 'Project description')
  .option('-c, --context <context>', 'Additional context')
  .option('--constraints <constraints>', 'JSON constraints string')
  .action(async (description, options) => {
    try {
      console.log('🔍 Analyzing requirements...');

      const constraints = options.constraints ? JSON.parse(options.constraints) : [];

      const analysis = await analyzeRequirements(description, options.context, constraints);

      console.log('\n📊 Analysis Results:');
      console.log(`\n🎯 Complexity: ${analysis.estimatedComplexity}`);
      console.log(`⏱️  Timeline: ${analysis.estimatedTimeline}`);

      console.log('\n🛠️  Technical Requirements:');
      analysis.technicalRequirements.forEach(req => {
        console.log(`  [${req.priority}] ${req.description}`);
      });

      console.log('\n🏢 Business Requirements:');
      analysis.businessRequirements.forEach(req => {
        console.log(`  [${req.priority}] ${req.description}`);
      });

      console.log('\n🔒 Security Requirements:');
      analysis.securityRequirements.forEach(req => {
        console.log(`  [${req.priority}] ${req.description}`);
      });

      console.log('\n⚡ Performance Requirements:');
      analysis.performanceRequirements.forEach(req => {
        console.log(`  [${req.priority}] ${req.description} (${req.target} ${req.unit})`);
      });

      console.log('\n🔧 Recommended Technologies:');
      analysis.technologies.forEach(tech => {
        console.log(`  - ${tech.name} (${tech.category}) - ${tech.reason}`);
      });

      if (analysis.risks.length > 0) {
        console.log('\n⚠️  Risks:');
        analysis.risks.forEach(risk => {
          console.log(`  [${risk.category}] ${risk.description}`);
        });
      }

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Architecture recommendation command
program
  .command('architecture')
  .alias('arch')
  .description('Generate architecture recommendations')
  .argument('<requirements>', 'Requirements JSON file')
  .action(async (requirementsFile) => {
    try {
      const requirements = JSON.parse(requirementsFile);

      console.log('🏗️  Generating architecture recommendations...');

      const recommendation = await recommendArchitecture(requirements);

      console.log('\n📋 Architecture Overview:');
      console.log(`\n🎯 Strategy: ${recommendation.scalabilityPlan.strategy}`);
      console.log(`🚀 Auto-scaling: ${recommendation.scalabilityPlan.autoScaling ? 'Enabled' : 'Disabled'}`);
      console.log(`📊 Load balancing: ${recommendation.scalabilityPlan.loadBalancing ? 'Enabled' : 'Disabled'}`);

      console.log('\n🔧 Services:');
      recommendation.services.forEach(service => {
        console.log(`  - ${service.name} (${service.type})`);
        console.log(`    Purpose: ${service.purpose}`);
        console.log(`    Tech: ${service.technologies.join(', ')}`);
      });

      console.log('\n🏗️  Architecture Patterns:');
      recommendation.patterns.forEach(pattern => {
        console.log(`  - ${pattern}`);
      });

      console.log('\n💰 Cost Estimate:');
      console.log(`  Monthly: $${recommendation.estimatedCost.monthly.toFixed(2)}`);
      console.log(`  Free Tier: ${recommendation.estimatedCost.freeTierEligible ? 'Yes' : 'No'}`);

      if (recommendation.risks.length > 0) {
        console.log('\n⚠️  Risks:');
        recommendation.risks.forEach(risk => {
          console.log(`  [${risk.severity}] ${risk.description}`);
          console.log(`    Mitigation: ${risk.mitigation}`);
        });
      }

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Cost calculation command
program
  .command('costs')
  .alias('c')
  .description('Calculate deployment costs')
  .argument('<architecture>', 'Architecture JSON file')
  .option('-r, --region <region>', 'Deployment region', 'global')
  .option('--daily-requests <requests>', 'Daily requests', '1000')
  .option('--cpu-time <cpu>', 'Average CPU time (ms)', '10')
  .option('--storage <storage>', 'Storage size (GB)', '1')
  .option('--bandwidth <bandwidth>', 'Bandwidth (GB)', '5')
  .action(async (architectureFile, options) => {
    try {
      const architecture = JSON.parse(architectureFile);

      console.log('💰 Calculating deployment costs...');

      const traffic = {
        dailyRequests: parseInt(options.dailyRequests),
        averageCpuTime: parseInt(options.cpuTime),
        storage: parseInt(options.storage),
        bandwidth: parseInt(options.bandwidth)
      };

      const costAnalysis = await calculateCosts(architecture, options.region, traffic);

      console.log('\n💵 Cost Analysis:');
      console.log(`\n📊 Monthly: $${costAnalysis.monthly.total.toFixed(2)}`);
      console.log(`📅 Yearly: $${costAnalysis.yearly.total.toFixed(2)}`);
      console.log(`💎 Currency: ${costAnalysis.monthly.currency}`);
      console.log(`🆓 Free Tier: ${costAnalysis.monthly.freeTier ? 'Eligible' : 'Not eligible'}`);

      console.log('\n📋 Cost Breakdown:');
      Object.entries(costAnalysis.breakdown).forEach(([category, services]) => {
        console.log(`\n${category.charAt(0).toUpperCase() + category.slice(1)}:`);
        services.forEach(service => {
          console.log(`  - ${service.name}: $${service.totalCost.toFixed(2)}`);
        });
      });

      console.log('\n📈 Scenarios:');
      costAnalysis.scenarios.forEach(scenario => {
        console.log(`\n  ${scenario.name}:`);
        console.log(`    Monthly: $${scenario.monthlyCost.toFixed(2)}`);
        console.log(`    Growth: ${(scenario.growthRate * 100).toFixed(0)}%`);
      });

      if (costAnalysis.optimization.recommendations.length > 0) {
        console.log('\n💡 Optimization Recommendations:');
        costAnalysis.optimization.recommendations.forEach(rec => {
          console.log(`  [${rec.priority}] ${rec.description}`);
          console.log(`    Savings: $${rec.estimatedSavings.toFixed(2)}`);
        });
      }

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Templates command
program
  .command('templates')
  .alias('t')
  .description('List available templates')
  .option('-c, --category <category>', 'Filter by category')
  .option('-f, --framework <framework>', 'Filter by framework')
  .option('-s, --search <query>', 'Search templates')
  .action(async (options) => {
    try {
      let templates = templateRegistry.getAvailableTemplates();

      // Apply filters
      if (options.category) {
        templates = templates.filter(t => t.category === options.category);
      }

      if (options.framework) {
        templates = templates.filter(t => t.framework === options.framework);
      }

      if (options.search) {
        templates = templateRegistry.searchTemplates(options.search);
      }

      if (templates.length === 0) {
        console.log('No templates found matching your criteria.');
        return;
      }

      console.log(`📋 Available Templates (${templates.length} found):\n`);

      templates.forEach(template => {
        console.log(`📦 ${template.name}`);
        console.log(`   ID: ${template.id}`);
        console.log(`   Category: ${template.category}`);
        console.log(`   Framework: ${template.framework}`);
        console.log(`   Language: ${template.language}`);
        console.log(`   Complexity: ${template.complexity}`);
        console.log(`   Features: ${template.features.join(', ')}`);
        console.log(`   Description: ${template.description}\n`);
      });

      // Show categories
      const categories = templateRegistry.getCategories();
      console.log(`📊 Categories: ${categories.join(', ')}\n`);

      // Show statistics
      const stats = templateRegistry.getStatistics();
      console.log(`📈 Statistics:`);
      console.log(`   Total templates: ${stats.total}`);
      console.log(`   By category: ${JSON.stringify(stats.byCategory)}`);
      console.log(`   By framework: ${JSON.stringify(stats.byFramework)}\n`);

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Template details command
program
  .command('template')
  .alias('tpl')
  .description('Show template details')
  .argument('<template-id>', 'Template ID')
  .action(async (templateId) => {
    try {
      const template = templateRegistry.getTemplate(templateId);

      if (!template) {
        console.error(`❌ Template not found: ${templateId}`);
        console.log(`\n💡 Use 'claudeflare-factory templates' to see available templates.`);
        process.exit(1);
      }

      console.log(`📋 Template Details:\n`);

      console.log(`📦 ${template.name}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Description: ${template.description}`);
      console.log(`   Category: ${template.category}`);
      console.log(`   Framework: ${template.framework}`);
      console.log(`   Language: ${template.language}`);
      console.log(`   Database: ${template.database || 'None'}`);
      console.log(`   Auth: ${template.auth || 'None'}`);
      console.log(`   Complexity: ${template.complexity}`);
      console.log(`   Features: ${template.features.join(', ')}\n`);

      console.log(`📦 Dependencies (${template.dependencies.length}):`);
      template.dependencies.forEach(dep => {
        console.log(`   - ${dep}`);
      });

      console.log(`\n📜 Scripts:`);
      Object.entries(template.scripts).forEach(([name, script]) => {
        console.log(`   ${name}: ${script}`);
      });

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    console.log('🚀 Welcome to ClaudeFlare Application Factory Interactive Mode!');
    console.log('💡 Follow the prompts to generate your Cloudflare application.\n');

    // Simple interactive flow
    const name = await prompt('Project name: ');
    const description = await prompt('Project description: ');
    const type = await prompt('Project type (saas/api/frontend/backend/fullstack): ');
    const framework = await prompt('Framework (react/vue/angular/next/express): ');
    const outputDir = await prompt('Output directory (default: ./projects): ') || './projects';

    console.log('\n🔍 Analyzing requirements...');
    const analysis = await analyzeRequirements(description);

    console.log('🏗️  Generating architecture...');
    const architecture = await recommendArchitecture(analysis);

    console.log('📦 Selecting template...');
    const template = templateRegistry.getTemplatesByCategory(type)[0] || templateRegistry.getTemplates()[0];

    console.log('💰 Calculating costs...');
    const costAnalysis = await calculateCosts(architecture, 'global', {
      dailyRequests: 1000,
      averageCpuTime: 10,
      storage: 1,
      bandwidth: 5
    });

    console.log('\n📋 Summary:');
    console.log(`   Project: ${name}`);
    console.log(`   Type: ${type}`);
    console.log(`   Template: ${template.name}`);
    console.log(`   Complexity: ${analysis.estimatedComplexity}`);
    console.log(`   Timeline: ${analysis.estimatedTimeline}`);
    console.log(`   Estimated Cost: $${costAnalysis.monthly.total.toFixed(2)}/month`);

    const confirm = await prompt('\nProceed with generation? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Generation cancelled.');
      return;
    }

    console.log('\n🚀 Generating project...');
    const result = await generateProject({
      name,
      description,
      type: type as any,
      features: [],
      technologies: [],
      requirements: [],
      constraints: [],
      outputDir,
      template: template.id,
      framework,
      git: true
    });

    if (result.success) {
      console.log('✅ Project generated successfully!');
      console.log(`📁 Location: ${result.projectPath}`);

      console.log('\n🚀 Next steps:');
      result.commands.forEach((command, index) => {
        console.log(`${index + 1}. ${command}`);
      });
    } else {
      console.log('❌ Generation failed:');
      result.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
  });

// Helper function for prompts
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();