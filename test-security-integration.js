/**
 * Test script for Security Testing Integration
 * Tests all the security testing endpoints
 */

const API_BASE = 'http://localhost:8787/api/v1';

// Test data
const testCode = `
const express = require('express');
const app = express();

app.get('/user/:id', (req, res) => {
  const userId = req.params.id;
  // SQL Injection vulnerability
  const query = \`SELECT * FROM users WHERE id = \${userId}\`;
  db.query(query, (err, result) => {
    res.json(result);
  });
});

app.post('/login', (req, res) => {
  const password = req.body.password;
  // Hardcoded password
  if (password === 'admin123') {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// eval() vulnerability
function executeCode(code) {
  return eval(code);
}

// innerHTML vulnerability
function renderUser(user) {
  const div = document.createElement('div');
  div.innerHTML = \`
    <h1>\${user.name}</h1>
    <p>\${user.bio}</p>
  \`;
  return div;
}

// Missing security headers
app.get('/api/data', (req, res) => {
  res.json({ data: 'secret' });
});

module.exports = app;
`;

const testPackageJson = {
  "name": "test-app",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
};

// Test helper function
async function testEndpoint(url, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    console.log(`\n🔍 Testing ${method} ${url}`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(result, null, 2));

    return { status: response.status, data: result };
  } catch (error) {
    console.error(`❌ Error testing ${url}:`, error.message);
    return { status: 'error', error: error.message };
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Security Testing Integration Tests\n');

  // Test 1: Health check
  await testEndpoint(`${API_BASE}/security-test/health`);

  // Test 2: Get available scan types
  await testEndpoint(`${API_BASE}/security-test/types`);

  // Test 3: Get compliance frameworks
  await testEndpoint(`${API_BASE}/security-test/compliance-frameworks`);

  // Test 4: Get statistics
  await testEndpoint(`${API_BASE}/security-test/stats`);

  // Test 5: Quick scan with code
  console.log('\n⚡ Testing quick scan with code...');
  const quickScanResult = await testEndpoint(`${API_BASE}/security-test/quick`, 'POST', {
    target: 'inline-code',
    content: testCode
  });

  // Test 6: Full security scan with code
  console.log('\n🔐 Testing full security scan with code...');
  const fullScanResult = await testEndpoint(`${API_BASE}/security-test`, 'POST', {
    target: 'inline-code',
    targetType: 'code',
    options: {
      enableSAST: true,
      enableSCA: false,
      enableDAST: false,
      enableCompliance: false,
      severityThreshold: 'medium'
    }
  });

  // Test 7: Scan with package.json (simulated)
  console.log('\n📦 Testing dependency scan...');
  const depScanResult = await testEndpoint(`${API_BASE}/security-test`, 'POST', {
    target: 'package.json',
    targetType: 'dependency',
    options: {
      enableSAST: false,
      enableSCA: true,
      enableDAST: false,
      enableCompliance: false,
      includeDevDependencies: true,
      includeTransitiveDependencies: true
    }
  });

  // Test 8: Vulnerability lookup
  await testEndpoint(`${API_BASE}/security-test/vulnerability/npm/express/4.18.0`);

  // Test 9: Test error handling - missing target
  await testEndpoint(`${API_BASE}/security-test`, 'POST', {
    options: {
      enableSAST: true
    }
  });

  // Test 10: Test error handling - invalid scan ID
  await testEndpoint(`${API_BASE}/security-test/status/invalid-scan-id`);

  console.log('\n✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testEndpoint };