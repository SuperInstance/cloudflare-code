#!/usr/bin/env node

/**
 * Test script for Code Review API endpoints
 */

const codeExamples = {
  javascript: `
function calculateSum(a, b) {
  var result = a + b;
  console.log("Sum is:", result);
  return result;
}

// TODO: Fix this function
function unusedFunction() {
  return "This function is not used";
}
  `,
  typescript: `
interface User {
  id: number;
  name: string;
  email: string;
}

const getUserById = async (id: number): Promise<User> => {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
};

export default getUserById;
  `,
  python: `
def calculate_sum(a, b):
    # This function should use snake_case
    result = a + b
    print("Sum is:", result)
    return result

def calculate_average(numbers):
    if len(numbers) == 0:
        return 0
    total = sum(numbers)
    return total / len(numbers)
  `
};

// Test data
const tests = [
  {
    name: 'JavaScript Code Review',
    content: codeExamples.javascript,
    filePath: 'example.js'
  },
  {
    name: 'TypeScript Code Review',
    content: codeExamples.typescript,
    filePath: 'example.ts'
  },
  {
    name: 'Python Code Review',
    content: codeExamples.python,
    filePath: 'example.py'
  },
  {
    name: 'Empty Content Test',
    content: ''
  },
  {
    name: 'No Content Test',
    content: '   '
  }
];

async function testEndpoint(endpoint, testData, testName) {
  try {
    const url = `http://localhost:8787/api/v1${endpoint}`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    };

    console.log(`\n🧪 Testing: ${testName}`);
    console.log(`📍 Endpoint: ${endpoint}`);
    console.log(`📤 Request:`, JSON.stringify(testData, null, 2));

    const response = await fetch(url, options);
    const result = await response.json();

    console.log(`📥 Status: ${response.status}`);
    console.log(`📋 Response:`, JSON.stringify(result, null, 2));

    if (response.status === 200 && result.success) {
      console.log('✅ Test PASSED');

      // Print some interesting metrics
      if (result.result) {
        const { review, quality, security, performance } = result.result;
        console.log(`   📊 Issues found: ${review.summary.total}`);
        console.log(`   🔍 Quality score: ${review.metrics.score}`);
        console.log(`   ⚡ Maintainability: ${quality.maintainabilityIndex}`);
        console.log(`   🛡️ Security issues: ${security.summary.total}`);
        console.log(`   ⏱️ Duration: ${result.duration}ms`);
      }
    } else {
      console.log('❌ Test FAILED');
    }
  } catch (error) {
    console.log('❌ Test FAILED with error:', error.message);
  }
}

async function testGetEndpoints() {
  const getEndpoints = [
    '/code-review/languages',
    '/code-review/stats',
    '/code-review/health'
  ];

  for (const endpoint of getEndpoints) {
    try {
      console.log(`\n🔍 Testing GET: ${endpoint}`);
      const response = await fetch(`http://localhost:8787/api/v1${endpoint}`);
      const result = await response.json();

      console.log(`📥 Status: ${response.status}`);
      if (response.status === 200) {
        console.log('✅ GET Test PASSED');
        console.log(`📋 Response:`, JSON.stringify(result, null, 2));
      } else {
        console.log('❌ GET Test FAILED');
      }
    } catch (error) {
      console.log('❌ GET Test FAILED:', error.message);
    }
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Code Review API Tests');
  console.log('=====================================');

  // Test POST endpoints
  for (const test of tests) {
    await testEndpoint('/code-review', test, test.name);
  }

  // Test with file path parameter
  await testEndpoint('/code-review/example.js', {
    content: codeExamples.javascript,
    config: { includeSecurity: false }
  }, 'JavaScript with Custom Config');

  // Test GET endpoints
  await testGetEndpoints();

  console.log('\n🏁 All tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}