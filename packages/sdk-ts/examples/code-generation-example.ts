/**
 * Code Generation and Analysis Examples
 */

import { ClaudeFlare } from '../src/index.js';

const client = new ClaudeFlare({
  apiKey: process.env.CLAUDEFLARE_API_KEY || 'your-api-key',
  baseURL: 'http://localhost:8787',
  debug: true,
});

// Example 1: Generate a simple function
async function generateFunction() {
  console.log('\n=== Generate Function ===\n');

  const result = await client.code.generate.generate({
    prompt: 'Create a function to calculate fibonacci numbers',
    language: 'typescript',
    style: {
      indent: 'spaces',
      indentSize: 2,
      semicolons: true,
      quotes: 'single',
    },
  });

  console.log('Generated code:');
  console.log(result.code);
  console.log('\nExplanation:', result.explanation);
}

// Example 2: Generate with streaming
async function generateWithStreaming() {
  console.log('\n=== Generate with Streaming ===\n');

  await client.code.generate.generateStream(
    {
      prompt: 'Create a REST API endpoint for user authentication',
      language: 'typescript',
      framework: 'express',
    },
    (chunk) => {
      process.stdout.write(chunk);
    }
  );

  console.log('\n\nGeneration complete!');
}

// Example 3: Generate from context
async function generateFromContext() {
  console.log('\n=== Generate from Context ===\n');

  const result = await client.code.generate.generate({
    prompt: 'Add error handling and validation',
    language: 'typescript',
    context: [
      `
function addUser(name: string, email: string) {
  const user = { name, email };
  database.save(user);
  return user;
}
      `,
    ],
  });

  console.log('Improved code:');
  console.log(result.code);
}

// Example 4: Security analysis
async function securityAnalysis() {
  console.log('\n=== Security Analysis ===\n');

  const code = `
const express = require('express');
const app = express();

app.get('/user/:id', async (req, res) => {
  const query = "SELECT * FROM users WHERE id = " + req.params.id;
  const user = await database.query(query);
  res.json(user);
});
  `;

  const analysis = await client.code.analyze.security(code, 'javascript');

  console.log(`Security Score: ${analysis.score}/100`);
  console.log(`\nSummary: ${analysis.summary}\n`);

  console.log('Findings:');
  for (const finding of analysis.findings) {
    console.log(`- [${finding.severity.toUpperCase()}] ${finding.message}`);
    if (finding.location) {
      console.log(`  Location: Line ${finding.location.line}`);
    }
    if (finding.suggestion) {
      console.log(`  Suggestion: ${finding.suggestion}`);
    }
  }
}

// Example 5: Performance analysis
async function performanceAnalysis() {
  console.log('\n=== Performance Analysis ===\n');

  const code = `
function processItems(items) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      results.push(items[i] * items[j]);
    }
  }
  return results;
}
  `;

  const analysis = await client.code.analyze.performance(code, 'javascript');

  console.log(`Performance Score: ${analysis.score}/100`);
  console.log(`\nSummary: ${analysis.summary}\n`);

  console.log('Findings:');
  for (const finding of analysis.findings) {
    console.log(`- [${finding.severity.toUpperCase()}] ${finding.message}`);
    if (finding.suggestion) {
      console.log(`  Suggestion: ${finding.suggestion}`);
    }
  }
}

// Example 6: Quality analysis
async function qualityAnalysis() {
  console.log('\n=== Quality Analysis ===\n');

  const code = `
// Function to get user
function getUser(id, name) {
  let u = null;
  if (id) {
    u = db.find(id);
  } else {
    if (name) {
      u = db.findByName(name);
    }
  }
  return u;
}
  `;

  const analysis = await client.code.analyze.quality(code, 'javascript');

  console.log(`Quality Score: ${analysis.score}/100`);
  console.log(`\nSummary: ${analysis.summary}\n`);

  console.log('Findings:');
  for (const finding of analysis.findings) {
    console.log(`- [${finding.type.toUpperCase()}] ${finding.message}`);
    if (finding.suggestion) {
      console.log(`  Suggestion: ${finding.suggestion}`);
    }
  }
}

// Example 7: Generate documentation
async function generateDocumentation() {
  console.log('\n=== Generate Documentation ===\n');

  const code = `
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

class UserService {
  async findById(id: string): Promise<User | null> {
    const user = await db.users.findOne({ where: { id } });
    return user;
  }

  async create(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const user = await db.users.create({
      data: {
        ...data,
        createdAt: new Date(),
      },
    });
    return user;
  }
}
  `;

  const analysis = await client.code.analyze.document(code, 'typescript');

  console.log('Generated Documentation:');
  console.log(analysis.summary);
}

// Example 8: Complexity analysis
async function complexityAnalysis() {
  console.log('\n=== Complexity Analysis ===\n');

  const code = `
function processData(items, filters, options) {
  const result = [];
  for (const item of items) {
    if (filters.active && !item.active) continue;
    if (filters.valid && !item.valid) continue;
    if (filters.type && item.type !== filters.type) continue;

    const processed = {
      ...item,
      value: options.multiplier
        ? item.value * options.multiplier
        : item.value,
      tax: options.includeTax
        ? item.value * 0.1
        : 0,
      total: options.includeTax
        ? item.value * (1 + (options.taxRate || 0.1))
        : item.value,
    };

    if (options.validate) {
      if (processed.value < 0) continue;
      if (processed.total > options.maxTotal) continue;
    }

    result.push(processed);
  }

  return options.sort
    ? result.sort((a, b) => a.value - b.value)
    : result;
}
  `;

  const analysis = await client.code.analyze.complexity(code, 'javascript');

  console.log(`Complexity Score: ${analysis.score}/100`);
  console.log(`\nSummary: ${analysis.summary}\n`);

  console.log('Findings:');
  for (const finding of analysis.findings) {
    console.log(`- [${finding.severity.toUpperCase()}] ${finding.message}`);
    if (finding.suggestion) {
      console.log(`  Suggestion: ${finding.suggestion}`);
    }
  }
}

// Run all examples
async function main() {
  try {
    await generateFunction();
    await generateWithStreaming();
    await generateFromContext();
    await securityAnalysis();
    await performanceAnalysis();
    await qualityAnalysis();
    await generateDocumentation();
    await complexityAnalysis();
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  generateFunction,
  generateWithStreaming,
  generateFromContext,
  securityAnalysis,
  performanceAnalysis,
  qualityAnalysis,
  generateDocumentation,
  complexityAnalysis,
};
