// @ts-nocheck
/**
 * Challenge Platform
 * Provides various challenge types to distinguish humans from bots
 */

import type {
  RequestData,
  ChallengeConfig,
  ChallengeResult,
  ChallengeType
} from '../types';
import { StringUtils, TimeUtils } from '../utils';

/**
 * Challenge cache entry
 */
interface ChallengeCache {
  token: string;
  challenge: string;
  solution: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  ip: string;
  passed: boolean;
}

/**
 * JavaScript challenge template
 */
interface JSChallenge {
  html: string;
  verify: (solution: string) => boolean;
}

/**
 * CAPTCHA provider interface
 */
interface CAPTCHAProvider {
  verify(token: string, remoteIP?: string): Promise<boolean>;
  render(siteKey: string): string;
}

/**
 * Challenge Platform class
 */
export class ChallengePlatform {
  private challengeCache: Map<string, ChallengeCache>;
  private providers: Map<ChallengeType, CAPTCHAProvider>;
  private defaultConfigs: Map<ChallengeType, ChallengeConfig>;
  private verificationResults: Map<string, { result: ChallengeResult; timestamp: number }>;

  constructor() {
    this.challengeCache = new Map();
    this.providers = new Map();
    this.defaultConfigs = new Map();
    this.verificationResults = new Map();

    this.initializeDefaultConfigs();
    this.startCleanupTimer();
  }

  /**
   * Generate a challenge for a request
   */
  async generateChallenge(
    request: RequestData,
    challengeType: ChallengeType = 'javascript'
  ): Promise<{
    challenge: string;
    token: string;
    type: ChallengeType;
    expiresAt: number;
  }> {
    const token = StringUtils.uuid();
    const config = this.defaultConfigs.get(challengeType) || {
      type: challengeType,
      difficulty: 3,
      timeout: 5000
    };

    const challenge = this.createChallenge(challengeType, config);

    // Cache challenge
    const cacheEntry: ChallengeCache = {
      token,
      challenge: challenge.challenge,
      solution: challenge.solution,
      createdAt: TimeUtils.now(),
      expiresAt: TimeUtils.now() + config.timeout,
      attempts: 0,
      maxAttempts: 3,
      ip: request.ip,
      passed: false
    };

    this.challengeCache.set(token, cacheEntry);

    return {
      challenge: challenge.rendered || challenge.challenge,
      token,
      type: challengeType,
      expiresAt: cacheEntry.expiresAt
    };
  }

  /**
   * Verify a challenge response
   */
  async verifyChallenge(
    token: string,
    solution: string,
    remoteIP?: string
  ): Promise<ChallengeResult> {
    const startTime = TimeUtils.now();
    const cachedChallenge = this.challengeCache.get(token);

    if (!cachedChallenge) {
      return {
        passed: false,
        challengeType: 'javascript',
        solveTime: 0,
        error: 'Challenge not found or expired'
      };
    }

    // Check if expired
    if (TimeUtils.now() > cachedChallenge.expiresAt) {
      this.challengeCache.delete(token);
      return {
        passed: false,
        challengeType: 'javascript',
        solveTime: 0,
        error: 'Challenge expired'
      };
    }

    // Check max attempts
    cachedChallenge.attempts++;
    if (cachedChallenge.attempts > cachedChallenge.maxAttempts) {
      this.challengeCache.delete(token);
      return {
        passed: false,
        challengeType: 'javascript',
        solveTime: 0,
        error: 'Maximum attempts exceeded'
      };
    }

    // Verify solution
    let passed = false;
    let score = 0;

    if (cachedChallenge.solution.startsWith('provider:')) {
      // Use external provider
      const providerType = cachedChallenge.solution.split(':')[1] as ChallengeType;
      const provider = this.providers.get(providerType);

      if (provider) {
        try {
          passed = await provider.verify(solution, remoteIP);
          score = passed ? 1.0 : 0.0;
        } catch (error) {
          passed = false;
          score = 0.0;
        }
      }
    } else {
      // Verify internal challenge
      passed = solution === cachedChallenge.solution;
      score = passed ? 1.0 : 0.0;
    }

    const solveTime = TimeUtils.now() - startTime;

    if (passed) {
      cachedChallenge.passed = true;
      this.challengeCache.delete(token);
    }

    const result: ChallengeResult = {
      passed,
      challengeType: 'javascript',
      solveTime,
      score,
      token: passed ? token : undefined
    };

    // Cache result
    this.verificationResults.set(token, {
      result,
      timestamp: TimeUtils.now()
    });

    return result;
  }

  /**
   * Create challenge based on type
   */
  private createChallenge(
    type: ChallengeType,
    config: ChallengeConfig
  ): {
    challenge: string;
    solution: string;
    rendered?: string;
  } {
    switch (type) {
      case 'javascript':
        return this.createJavaScriptChallenge(config);

      case 'hcaptcha':
      case 'recaptcha':
      case 'turnstile':
        return this.createCAPTCHAChallenge(type, config);

      default:
        return this.createJavaScriptChallenge(config);
    }
  }

  /**
   * Create JavaScript challenge
   */
  private createJavaScriptChallenge(config: ChallengeConfig): {
    challenge: string;
    solution: string;
    rendered: string;
  } {
    const difficulty = config.difficulty || 3;
    const num1 = Math.floor(Math.random() * 100);
    const num2 = Math.floor(Math.random() * 100);
    const operation = ['+', '-', '*'][Math.floor(Math.random() * 3)];
    const answer = eval(`${num1} ${operation} ${num2}`);

    // Create JavaScript that computes the answer
    const jsCode = `
      (function() {
        const a = ${num1};
        const b = ${num2};
        const result = a ${operation} b;
        return result;
      })();
    `;

    // Hash the answer for security
    const solution = this.hashAnswer(answer.toString());

    // Render HTML
    const html = `
      <script>
        (function() {
          const answer = ${num1} ${operation} ${num2};
          const hash = '${this.hashFunction()}';
          const result = hash(answer.toString());
          fetch('/challenge/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: '${this.getCurrentToken()}', solution: result })
          }).then(r => r.json()).then(data => {
            if (data.passed) {
              window.location.reload();
            }
          });
        })();
      </script>
    `;

    return {
      challenge: jsCode,
      solution,
      rendered: html
    };
  }

  /**
   * Create CAPTCHA challenge
   */
  private createCAPTCHAChallenge(
    type: ChallengeType,
    config: ChallengeConfig
  ): {
    challenge: string;
    solution: string;
    rendered: string;
  } {
    const siteKey = config.siteKey || 'default-site-key';

    const html = type === 'hcaptcha'
      ? `<script src="https://hcaptcha.com/1/api.js" async defer></script>
         <div class="h-captcha" data-sitekey="${siteKey}"></div>`
      : type === 'recaptcha'
      ? `<script src="https://www.google.com/recaptcha/api.js" async defer></script>
         <div class="g-recaptcha" data-sitekey="${siteKey}"></div>`
      : `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
         <div class="cf-turnstile" data-sitekey="${siteKey}"></div>`;

    return {
      challenge: html,
      solution: `provider:${type}`,
      rendered: html
    };
  }

  /**
   * Hash answer for security
   */
  private hashAnswer(answer: string): string {
    // Simple hash function (in production, use proper crypto)
    let hash = 0;
    for (let i = 0; i < answer.length; i++) {
      const char = answer.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Get hash function for client-side
   */
  private hashFunction(): string {
    return `function hash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        h = ((h << 5) - h) + char;
        h = h & h;
      }
      return h.toString(16);
    }`;
  }

  /**
   * Get current token (placeholder)
   */
  private getCurrentToken(): string {
    return 'placeholder-token';
  }

  /**
   * Register CAPTCHA provider
   */
  registerProvider(type: ChallengeType, provider: CAPTCHAProvider): void {
    this.providers.set(type, provider);
  }

  /**
   * Set default config for challenge type
   */
  setDefaultConfig(type: ChallengeType, config: ChallengeConfig): void {
    this.defaultConfigs.set(type, config);
  }

  /**
   * Get challenge statistics
   */
  getStatistics(): {
    activeChallenges: number;
    passedToday: number;
    failedToday: number;
    averageSolveTime: number;
  } {
    const now = TimeUtils.now();
    const dayAgo = now - 86400000;

    let passed = 0;
    let failed = 0;
    let totalSolveTime = 0;
    let solveCount = 0;

    for (const [token, entry] of this.verificationResults.entries()) {
      if (entry.timestamp > dayAgo) {
        if (entry.result.passed) {
          passed++;
        } else {
          failed++;
        }
        totalSolveTime += entry.result.solveTime;
        solveCount++;
      }
    }

    return {
      activeChallenges: this.challengeCache.size,
      passedToday: passed,
      failedToday: failed,
      averageSolveTime: solveCount > 0 ? totalSolveTime / solveCount : 0
    };
  }

  /**
   * Get challenge cache size
   */
  getCacheSize(): number {
    return this.challengeCache.size;
  }

  /**
   * Clear expired challenges
   */
  private clearExpiredChallenges(): void {
    const now = TimeUtils.now();

    for (const [token, entry] of this.challengeCache.entries()) {
      if (entry.expiresAt < now) {
        this.challengeCache.delete(token);
      }
    }

    // Also clear old verification results
    for (const [token, entry] of this.verificationResults.entries()) {
      if (entry.timestamp < now - 86400000) { // 24 hours
        this.verificationResults.delete(token);
      }
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.clearExpiredChallenges();
    }, 60000); // Run every minute
  }

  /**
   * Initialize default configurations
   */
  private initializeDefaultConfigs(): void {
    this.defaultConfigs.set('javascript', {
      type: 'javascript',
      difficulty: 3,
      timeout: 5000
    });

    this.defaultConfigs.set('hcaptcha', {
      type: 'hcaptcha',
      difficulty: 2,
      timeout: 30000
    });

    this.defaultConfigs.set('turnstile', {
      type: 'turnstile',
      difficulty: 1,
      timeout: 10000
    });
  }

  /**
   * Reset platform state
   */
  reset(): void {
    this.challengeCache.clear();
    this.verificationResults.clear();
  }
}

/**
 * hCaptcha provider implementation
 */
export class HcaptchaProvider implements CAPTCHAProvider {
  private secretKey: string;
  private verifyURL: string;

  constructor(secretKey: string, verifyURL?: string) {
    this.secretKey = secretKey;
    this.verifyURL = verifyURL || 'https://hcaptcha.com/siteverify';
  }

  async verify(token: string, remoteIP?: string): Promise<boolean> {
    try {
      const response = await fetch(this.verifyURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secretKey,
          response: token,
          remoteip: remoteIP || ''
        })
      });

      const data = await response.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  render(siteKey: string): string {
    return `
      <script src="https://hcaptcha.com/1/api.js" async defer></script>
      <div class="h-captcha" data-sitekey="${siteKey}"></div>
    `;
  }
}

/**
 * reCAPTCHA provider implementation
 */
export class RecaptchaProvider implements CAPTCHAProvider {
  private secretKey: string;
  private verifyURL: string;

  constructor(secretKey: string, verifyURL?: string) {
    this.secretKey = secretKey;
    this.verifyURL = verifyURL || 'https://www.google.com/recaptcha/api/siteverify';
  }

  async verify(token: string, remoteIP?: string): Promise<boolean> {
    try {
      const response = await fetch(this.verifyURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secretKey,
          response: token,
          remoteip: remoteIP || ''
        })
      });

      const data = await response.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  render(siteKey: string): string {
    return `
      <script src="https://www.google.com/recaptcha/api.js" async defer></script>
      <div class="g-recaptcha" data-sitekey="${siteKey}"></div>
    `;
  }
}

/**
 * Turnstile (Cloudflare) provider implementation
 */
export class TurnstileProvider implements CAPTCHAProvider {
  private secretKey: string;
  private verifyURL: string;

  constructor(secretKey: string, verifyURL?: string) {
    this.secretKey = secretKey;
    this.verifyURL = verifyURL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  }

  async verify(token: string, remoteIP?: string): Promise<boolean> {
    try {
      const response = await fetch(this.verifyURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: this.secretKey,
          response: token,
          remoteip: remoteIP
        })
      });

      const data = await response.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  render(siteKey: string): string {
    return `
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <div class="cf-turnstile" data-sitekey="${siteKey}"></div>
    `;
  }
}

/**
 * Custom challenge implementation
 */
export class CustomChallenge {
  /**
   * Create mathematical challenge
   */
  static createMathChallenge(difficulty: number = 3): {
    challenge: string;
    solution: string;
    render: () => string;
  } {
    const operations = ['+', '-', '*', '/'];
    const nums = [];
    const ops = [];

    for (let i = 0; i < difficulty; i++) {
      nums.push(Math.floor(Math.random() * 100) + 1);
      if (i < difficulty - 1) {
        ops.push(operations[Math.floor(Math.random() * operations.length)]);
      }
    }

    let expression = '';
    for (let i = 0; i < nums.length; i++) {
      expression += nums[i];
      if (i < ops.length) {
        expression += ` ${ops[i]} `;
      }
    }

    const solution = eval(expression).toString();

    return {
      challenge: expression,
      solution,
      render: () => `
        <div class="math-challenge">
          <p>Solve: ${expression} = ?</p>
          <input type="text" id="math-answer" />
          <button onclick="submitMathAnswer('${solution}')">Submit</button>
        </div>
      `
    };
  }

  /**
   * Create puzzle challenge
   */
  static createPuzzleChallenge(difficulty: number = 3): {
    challenge: string;
    solution: string;
    render: () => string;
  } {
    const gridSize = difficulty + 2;
    const grid = [];

    for (let i = 0; i < gridSize; i++) {
      grid.push([]);
      for (let j = 0; j < gridSize; j++) {
        grid[i].push(Math.floor(Math.random() * 100));
      }
    }

    const target = Math.floor(Math.random() * 100);
    const solution = this.findPuzzleSolution(grid, target).toString();

    return {
      challenge: JSON.stringify(grid),
      solution,
      render: () => `
        <div class="puzzle-challenge">
          <p>Find the path that sums to ${target}</p>
          <pre>${JSON.stringify(grid, null, 2)}</pre>
          <input type="text" id="puzzle-answer" />
          <button onclick="submitPuzzleAnswer('${solution}')">Submit</button>
        </div>
      `
    };
  }

  private static findPuzzleSolution(grid: number[][], target: number): number {
    // Simplified puzzle solution
    return grid.reduce((sum, row) => sum + row.reduce((rowSum, val) => rowSum + val, 0), 0) % 100;
  }

  /**
   * Create timing-based challenge
   */
  static createTimingChallenge(): {
    challenge: string;
    solution: string;
    render: () => string;
  } {
    const startTime = Date.now();
    const solution = (startTime % 10000).toString();

    return {
      challenge: 'timing',
      solution,
      render: () => `
        <div class="timing-challenge">
          <script>
            const startTime = ${startTime};
            const currentTime = Date.now();
            const diff = currentTime - startTime;
            fetch('/challenge/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: '${solution}',
                solution: diff.toString()
              })
            });
          </script>
        </div>
      `
    };
  }
}

/**
 * Challenge HTML templates
 */
export class ChallengeTemplates {
  /**
   * Get base challenge HTML template
   */
  static getBaseTemplate(challengeHTML: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Security Challenge</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .challenge-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
          }
          h1 {
            color: #333;
            margin-top: 0;
          }
          .challenge-body {
            margin: 2rem 0;
          }
          .error {
            color: #d32f2f;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="challenge-container">
          <h1>Security Check</h1>
          <p>Please complete the following challenge to continue:</p>
          <div class="challenge-body">
            ${challengeHTML}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get JavaScript challenge template
   */
  static getJSChallengeTemplate(): string {
    return this.getBaseTemplate(`
      <p>This page is verifying that you are a human. Please wait while we check your browser...</p>
      <div id="status">Checking...</div>
      <script>
        // Challenge will be automatically solved
        setTimeout(() => {
          document.getElementById('status').textContent = 'Verified! Redirecting...';
          setTimeout(() => window.location.reload(), 1000);
        }, 2000);
      </script>
    `);
  }

  /**
   * Get CAPTCHA challenge template
   */
  static getCaptchaTemplate(siteKey: string, provider: 'hcaptcha' | 'recaptcha' | 'turnstile'): string {
    const scriptURL = provider === 'hcaptcha'
      ? 'https://hcaptcha.com/1/api.js'
      : provider === 'recaptcha'
      ? 'https://www.google.com/recaptcha/api.js'
      : 'https://challenges.cloudflare.com/turnstile/v0/api.js';

    const elementClass = provider === 'hcaptcha'
      ? 'h-captcha'
      : provider === 'recaptcha'
      ? 'g-recaptcha'
      : 'cf-turnstile';

    return this.getBaseTemplate(`
      <script src="${scriptURL}" async defer></script>
      <div class="${elementClass}" data-sitekey="${siteKey}"></div>
    `);
  }

  /**
   * Get custom challenge template
   */
  static getCustomChallengeTemplate(title: string, description: string, challengeHTML: string): string {
    return this.getBaseTemplate(`
      <h2>${title}</h2>
      <p>${description}</p>
      ${challengeHTML}
    `);
  }
}
