/**
 * Sample code with various issues for testing
 */

// ============================================================================
// Security Issues
// ============================================================================

const API_KEY = 'sk_test_1234567890abcdefghijklmnop'; // Hardcoded secret
const DB_PASSWORD = 'mySecretPassword123'; // Hardcoded password

function getUserData(userId: string) {
  // SQL Injection vulnerability
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  return database.execute(query);
}

function renderPage(userInput: string) {
  // XSS vulnerability
  document.getElementById('content').innerHTML = userInput;
}

function generateToken() {
  // Insecure random generation
  return Math.random().toString(36);
}

// ============================================================================
// Performance Issues
// ============================================================================

function findDuplicates(items: any[]): any[] {
  const duplicates: any[] = [];

  // Nested loops (O(n³))
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      for (let k = j + 1; k < items.length; k++) {
        if (items[i] === items[j] && items[j] === items[k]) {
          duplicates.push(items[i]);
        }
      }
    }
  }

  return duplicates;
}

function processItems(items: string[]) {
  // I/O operation inside loop
  for (const item of items) {
    const result = fetch(`/api/items/${item}`); // Blocking network request
    console.log(result);
  }
}

// Memory leak - event listener without cleanup
class Component {
  init() {
    document.addEventListener('click', this.handleClick);
  }

  handleClick() {
    console.log('clicked');
  }
}

// Inefficient string concatenation in loop
function buildString(items: string[]): string {
  let result = '';
  for (const item of items) {
    result += item + ','; // Creates many temporary strings
  }
  return result;
}

// ============================================================================
// Quality Issues
// ============================================================================

// Complex function (high cyclomatic complexity)
function processData(data: any): any {
  if (data) {
    if (data.type === 'user') {
      if (data.role === 'admin') {
        if (data.active) {
          if (data.verified) {
            return { status: 'active', admin: true };
          } else {
            return { status: 'pending' };
          }
        } else {
          return { status: 'inactive' };
        }
      } else if (data.role === 'user') {
        return { status: 'user' };
      } else {
        return { status: 'unknown' };
      }
    } else if (data.type === 'guest') {
      return { status: 'guest' };
    } else {
      return null;
    }
  } else {
    return null;
  }
}

// Long function
function veryLongFunction() {
  const step1 = 'result1';
  const step2 = 'result2';
  const step3 = 'result3';
  const step4 = 'result4';
  const step5 = 'result5';
  const step6 = 'result6';
  const step7 = 'result7';
  const step8 = 'result8';
  const step9 = 'result9';
  const step10 = 'result10';
  // ... many more lines
  return step1 + step2 + step3 + step4 + step5;
}

// Deep nesting
function deeplyNested() {
  if (condition1) {
    if (condition2) {
      if (condition3) {
        if (condition4) {
          if (condition5) {
            return 'too deep';
          }
        }
      }
    }
  }
}

// ============================================================================
// Style Issues
// ============================================================================

const VeryLongVariableNameThatExceedsRecommendedLength = 1; // Naming issue

function BADFUNCTIONNAME() { // Naming issue
  return;
}

const x=1+2; // Spacing issue

if (x>0) { // Spacing issue
  console.log(x);
}

// Trailing whitespace
const trailing = 'trailing';

// ============================================================================
// Best Practices Issues
// ============================================================================

// Console log statements (should use proper logging)
console.log('Debug info');
console.error('Error message');

// TODO comments
// TODO: Implement error handling
// FIXME: This is a temporary solution

// Empty catch block
try {
  riskyOperation();
} catch (error) {
  // Empty catch - error is swallowed
}

// Magic numbers
function calculatePrice(quantity: number): number {
  return quantity * 1.378 + 42; // Magic numbers
}

// ============================================================================
// Data Clumps
// ============================================================================

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

function processAddress1(street: string, city: string, state: string, zip: string, country: string) {
  // ...
}

function processAddress2(street: string, city: string, state: string, zip: string, country: string) {
  // ...
}

// ============================================================================
// Large Class
// ============================================================================

class LargeClass {
  method1() {}
  method2() {}
  method3() {}
  method4() {}
  method5() {}
  method6() {}
  method7() {}
  method8() {}
  method9() {}
  method10() {}
  method11() {}
  method12() {}
  method13() {}
  method14() {}
  method15() {}
  property1: string;
  property2: string;
  property3: string;
  property4: string;
  property5: string;
  property6: string;
  property7: string;
  property8: string;
  property9: string;
  property10: string;
}

// ============================================================================
// Code Duplication
// ============================================================================

function calculateSum1(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}

function calculateSum2(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}

function calculateSum3(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}
