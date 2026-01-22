/**
 * End-to-End Testing Example
 * Demonstrates E2E testing with the ClaudeFlare testing framework
 */

import { describe, test, expect, beforeEach, afterEach } from '@claudeflare/testing-framework/unit';
import {
  createE2ETestRunner,
  BrowserManager,
  Page,
  ElementSelector,
  UserActions,
  E2EAssertions
} from '@claudeflare/testing-framework/e2e';

// Mock test application components
class TestApplication {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async navigateTo(path: string): Promise<string> {
    return `${this.baseUrl}${path}`;
  }

  async createTestUser(userData: any): Promise<any> {
    // Simulate API call
    return {
      id: Math.random().toString(36).substr(2, 9),
      ...userData,
      createdAt: new Date().toISOString()
    };
  }

  async login(email: string, password: string): Promise<string> {
    // Simulate login
    if (email === 'test@example.com' && password === 'password123') {
      return 'mock-jwt-token';
    }
    throw new Error('Invalid credentials');
  }

  async createPost(content: string, userId: string): Promise<any> {
    // Simulate post creation
    return {
      id: Math.random().toString(36).substr(2, 9),
      content,
      userId,
      likes: 0,
      createdAt: new Date().toISOString()
    };
  }

  async createComment(postId: string, content: string, userId: string): Promise<any> {
    // Simulate comment creation
    return {
      id: Math.random().toString(36).substr(2, 9),
      postId,
      content,
      userId,
      createdAt: new Date().toISOString()
    };
  }
}

// Page Object Model example
class LoginPage {
  private page: Page;
  private app: TestApplication;

  constructor(page: Page, app: TestApplication) {
    this.page = page;
    this.app = app;
  }

  async navigate(): Promise<void> {
    await this.page.goto('/login');
  }

  async fillLoginForm(email: string, password: string): Promise<void> {
    await this.page.fill('#email', email);
    await this.page.fill('#password', password);
  }

  async clickLoginButton(): Promise<void> {
    await this.page.click('button[type="submit"]');
  }

  async getErrorMessage(): Promise<string> {
    return this.page.getText('.error-message');
  }

  async waitForDashboard(): Promise<void> {
    await this.page.waitForURL('/dashboard');
  }
}

class DashboardPage {
  private page: Page;
  private app: TestApplication;

  constructor(page: Page, app: TestApplication) {
    this.page = page;
    this.app = app;
  }

  async navigate(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  async getUserName(): Promise<string> {
    return this.page.getText('.user-name');
  }

  async createNewPost(): Promise<void> {
    await this.page.click('#create-post-btn');
    await this.page.waitForVisible('#post-modal');
  }

  async fillPostContent(content: string): Promise<void> {
    await this.page.fill('#post-content', content);
  }

  async submitPost(): Promise<void> {
    await this.page.click('#submit-post');
    await this.page.waitForHidden('#post-modal');
  }

  async getPosts(): Promise<any[]> {
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.post')).map(post => ({
        id: post.dataset.id,
        content: post.querySelector('.post-content').textContent,
        likes: post.querySelector('.likes').textContent
      }));
    });
  }

  async likePost(postId: string): Promise<void> {
    await this.page.click(`#post-${postId} .like-btn`);
  }

  async getLikesForPost(postId: string): Promise<number> {
    return this.page.evaluate((id) => {
      const post = document.querySelector(`#post-${id}`);
      return parseInt(post.querySelector('.likes').textContent);
    }, postId);
  }
}

class PostDetailPage {
  private page: Page;
  private app: TestApplication;

  constructor(page: Page, app: TestApplication) {
    this.page = page;
    this.app = app;
  }

  async navigate(postId: string): Promise<void> {
    await this.page.goto(`/post/${postId}`);
  }

  async getPostContent(): Promise<string> {
    return this.page.getText('.post-content');
  }

  async addComment(content: string): Promise<void> {
    await this.page.fill('.comment-input', content);
    await this.page.click('.comment-submit');
  }

  async getComments(): Promise<any[]> {
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.comment')).map(comment => ({
        id: comment.dataset.id,
        content: comment.querySelector('.comment-content').textContent,
        author: comment.querySelector('.comment-author').textContent
      }));
    });
  }
}

// E2E test suite
describe('E2E Testing - Social Media Application', () => {
  let browser: BrowserManager;
  let page: Page;
  let app: TestApplication;
  let testRunner: any;

  beforeEach(async () => {
    // Initialize test application
    app = new TestApplication('http://localhost:3000');

    // Initialize E2E test runner
    testRunner = createE2ETestRunner({
      browserOptions: {
        headless: true,
        slowMo: 100
      }
    });

    // Launch browser
    browser = new BrowserManager();
    await browser.launch({
      headless: true,
      slowMo: 100
    });

    // Create new page
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    // Close browser
    if (browser) {
      await browser.close();
    }
  });

  describe('Authentication Flow', () => {
    test('should allow user to login successfully', async () => {
      // Navigate to login page
      await page.goto('/login');

      // Fill login form
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');

      // Click login button
      await page.click('button[type="submit"]');

      // Verify redirect to dashboard
      await page.waitForURL('/dashboard');
      expect(page.url()).toContain('/dashboard');

      // Verify user is logged in
      const userName = await page.getText('.user-name');
      expect(userName).toBe('Test User');
    });

    test('should show error for invalid credentials', async () => {
      await page.goto('/login');

      await page.fill('#email', 'invalid@example.com');
      await page.fill('#password', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Should not redirect
      expect(page.url()).toContain('/login');

      // Show error message
      const errorMessage = await page.getText('.error-message');
      expect(errorMessage).toBe('Invalid credentials');
    });

    test('should validate required fields', async () => {
      await page.goto('/login');

      // Try to submit without filling fields
      await page.click('button[type="submit"]');

      // Should show validation errors
      const emailError = await page.getText('#email-error');
      const passwordError = await page.getText('#password-error');

      expect(emailError).toBe('Email is required');
      expect(passwordError).toBe('Password is required');
    });
  });

  describe('Post Creation', () => {
    let loginPage: LoginPage;
    let dashboardPage: DashboardPage;

    beforeEach(async () => {
      // Login first
      await page.goto('/login');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      // Initialize page objects
      loginPage = new LoginPage(page, app);
      dashboardPage = new DashboardPage(page, app);
    });

    test('should create a new post', async () => {
      // Open create post modal
      await dashboardPage.createNewPost();

      // Fill post content
      const postContent = 'Hello, this is my first post!';
      await dashboardPage.fillPostContent(postContent);

      // Submit post
      await dashboardPage.submitPost();

      // Verify post appears in feed
      const posts = await dashboardPage.getPosts();
      const newPost = posts.find(p => p.content === postContent);

      expect(newPost).toBeDefined();
      expect(newPost.content).toBe(postContent);
    });

    test('should validate post content', async () => {
      await dashboardPage.createNewPost();

      // Try to submit empty post
      await dashboardPage.submitPost();

      // Should show validation error
      const error = await page.getText('.post-error');
      expect(error).toBe('Post content cannot be empty');
    });

    test('should limit post content length', async () => {
      await dashboardPage.createNewPost();

      // Create very long content
      const longContent = 'a'.repeat(1001);
      await dashboardPage.fillPostContent(longContent);

      // Try to submit
      await dashboardPage.submitPost();

      // Should show length error
      const error = await page.getText('.post-error');
      expect(error).toBe('Post content must be less than 1000 characters');
    });
  });

  describe('Post Interaction', () => {
    let dashboardPage: DashboardPage;
    let postId: string;

    beforeEach(async () => {
      // Login and create a post
      await page.goto('/login');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      dashboardPage = new DashboardPage(page, app);

      // Create test post
      await dashboardPage.createNewPost();
      await dashboardPage.fillPostContent('Test post for interaction');
      await dashboardPage.submitPost();

      // Get post ID
      const posts = await dashboardPage.getPosts();
      postId = posts[0].id;
    });

    test('should like a post', async () => {
      // Initial likes count
      let likes = await dashboardPage.getLikesForPost(postId);
      expect(likes).toBe(0);

      // Like the post
      await dashboardPage.likePost(postId);

      // Verify likes count increased
      likes = await dashboardPage.getLikesForPost(postId);
      expect(likes).toBe(1);
    });

    test('should prevent double liking', async () => {
      // Like the post
      await dashboardPage.likePost(postId);

      // Try to like again
      await page.click(`#post-${postId} .like-btn`);

      // Likes count should remain the same
      const likes = await dashboardPage.getLikesForPost(postId);
      expect(likes).toBe(1);
    });

    test('should show post details', async () => {
      // Navigate to post details
      await page.goto(`/post/${postId}`);

      // Verify post content
      const content = await page.getText('.post-content');
      expect(content).toBe('Test post for interaction');

      // Verify post author
      const author = await page.getText('.post-author');
      expect(author).toBe('Test User');
    });
  });

  describe('Comment System', () => {
    let postDetailPage: PostDetailPage;
    let postId: string;

    beforeEach(async () => {
      // Create a post first
      await page.goto('/login');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');

      const dashboardPage = new DashboardPage(page, app);
      await dashboardPage.createNewPost();
      await dashboardPage.fillPostContent('Post with comments');
      await dashboardPage.submitPost();

      // Get post ID and navigate to post details
      const posts = await dashboardPage.getPosts();
      postId = posts[0].id;
      await page.goto(`/post/${postId}`);

      postDetailPage = new PostDetailPage(page, app);
    });

    test('should add a comment to a post', async () => {
      // Add comment
      const commentContent = 'This is a great post!';
      await postDetailPage.addComment(commentContent);

      // Verify comment appears
      const comments = await postDetailPage.getComments();
      const newComment = comments.find(c => c.content === commentContent);

      expect(newComment).toBeDefined();
      expect(newComment.content).toBe(commentContent);
    });

    test('should validate comment content', async () => {
      // Try to add empty comment
      await postDetailPage.addComment('');

      // Should show validation error
      const error = await page.getText('.comment-error');
      expect(error).toBe('Comment cannot be empty');
    });

    test('should limit comment length', async () => {
      // Create very long comment
      const longComment = 'a'.repeat(501);
      await postDetailPage.addComment(longComment);

      // Should show length error
      const error = await page.getText('.comment-error');
      expect(error).toBe('Comment must be less than 500 characters');
    });

    test('should show comment author', async () => {
      await postDetailPage.addComment('Test comment');

      const comments = await postDetailPage.getComments();
      const comment = comments[0];

      expect(comment.author).toBe('Test User');
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      // Login
      await page.goto('/login');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
    });

    test('should navigate between pages', async () => {
      // Test navigation to profile page
      await page.click('.profile-link');
      await page.waitForURL('/profile');
      expect(page.url()).toContain('/profile');

      // Test navigation to settings page
      await page.click('.settings-link');
      await page.waitForURL('/settings');
      expect(page.url()).toContain('/settings');

      // Test navigation back to dashboard
      await page.click('.dashboard-link');
      await page.waitForURL('/dashboard');
      expect(page.url()).toContain('/dashboard');
    });

    test('should handle 404 pages', async () => {
      await page.goto('/non-existent-page');

      // Should show 404 error
      const errorMessage = await page.getText('.error-404');
      expect(errorMessage).toBe('Page not found');
    });
  });

  describe('Responsive Design', () => {
    test('should adapt to mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Check if mobile menu is visible
      const mobileMenu = await page.isVisible('.mobile-menu');
      expect(mobileMenu).toBe(true);

      // Check if desktop navigation is hidden
      const desktopNav = await page.isVisible('.desktop-nav');
      expect(desktopNav).toBe(false);
    });

    test('should adapt to tablet viewport', async () => {
      // Set tablet viewport
      await page.setViewport({ width: 768, height: 1024 });

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Check if responsive layout is applied
      const container = await page.$('.responsive-container');
      expect(container).toBeDefined();
    });

    test('should maintain desktop layout', async () => {
      // Set desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Check if full desktop navigation is visible
      const fullNav = await page.isVisible('.full-nav');
      expect(fullNav).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should load dashboard within acceptable time', async () => {
      const startTime = performance.now();

      await page.goto('/dashboard');

      await page.waitForVisible('.feed-container');
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds

      console.log(`Dashboard load time: ${loadTime}ms`);
    });

    test('should handle concurrent requests', async () => {
      // Simulate multiple tabs/windows
      const pages: Page[] = [];

      // Create multiple pages
      for (let i = 0; i < 3; i++) {
        const newPage = await browser.newPage();
        pages.push(newPage);
      }

      // Navigate all pages to dashboard
      const promises = pages.map(page => page.goto('/dashboard'));
      await Promise.all(promises);

      // Wait for all pages to load
      const waitForPromises = pages.map(page =>
        page.waitForVisible('.feed-container')
      );
      await Promise.all(waitForPromises);

      // Verify all pages loaded successfully
      const urls = await Promise.all(
        pages.map(page => page.url())
      );

      expect(urls.every(url => url.includes('/dashboard'))).toBe(true);

      // Close additional pages
      for (const page of pages) {
        await page.close();
      }
    });
  });

  describe('Accessibility Tests', () => {
    test('should have proper ARIA labels', async () => {
      await page.goto('/login');

      // Check email input
      const emailInput = await page.$('#email');
      const emailAriaLabel = await emailInput.getAttribute('aria-label');
      expect(emailAriaLabel).toBe('Email address');

      // Check password input
      const passwordInput = await page.$('#password');
      const passwordAriaLabel = await passwordInput.getAttribute('aria-label');
      expect(passwordAriaLabel).toBe('Password');

      // Check submit button
      const submitButton = await page.$('button[type="submit"]');
      const buttonAriaLabel = await submitButton.getAttribute('aria-label');
      expect(buttonAriaLabel).toBe('Login');
    });

    test('should support keyboard navigation', async () => {
      await page.goto('/login');

      // Tab through form fields
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Enter text using keyboard
      await page.keyboard.type('test@example.com');
      await page.keyboard.press('Tab');
      await page.keyboard.type('password123');

      // Submit using keyboard
      await page.keyboard.press('Enter');

      // Should have navigated to dashboard
      await page.waitForURL('/dashboard');
      expect(page.url()).toContain('/dashboard');
    });

    test('should have sufficient color contrast', async () => {
      await page.goto('/login');

      // Get styles of text elements
      const styles = await page.evaluate(() => {
        const emailLabel = document.querySelector('label[for="email"]');
        const submitButton = document.querySelector('button[type="submit"]');

        return {
          emailLabel: {
            color: window.getComputedStyle(emailLabel).color,
            fontSize: window.getComputedStyle(emailLabel).fontSize
          },
          submitButton: {
            color: window.getComputedStyle(submitButton).color,
            backgroundColor: window.getComputedStyle(submitButton).backgroundColor
          }
        };
      });

      // Basic contrast check (simplified)
      expect(styles.emailLabel.color).toBeDefined();
      expect(styles.emailLabel.fontSize).toBeDefined();
      expect(styles.submitButton.color).toBeDefined();
      expect(styles.submitButton.backgroundColor).toBeDefined();
    });
  });

  describe('Cross-Browser Testing', () => {
    test('should work in Chrome', async () => {
      // This test would run with Chrome-specific settings
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toContain('Chrome');
    });

    test('should handle different browser quirks', async () => {
      // Test browser-specific behaviors
      await page.goto('/dashboard');

      // Check if browser-specific CSS is applied
      const browserClass = await page.$('.chrome-specific');
      if (browserClass) {
        expect(await browserClass.isVisible()).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Mock network failure
      await page.route('**/api/posts', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/dashboard');

      // Should show offline message
      const offlineMessage = await page.getText('.offline-message');
      expect(offlineMessage).toBe('You are offline. Some features may not be available.');
    });

    test('should handle API errors', async () => {
      // Mock API error
      await page.route('**/api/posts', async (route) => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' })
        });
      });

      await page.goto('/dashboard');

      // Should show error notification
      const errorMessage = await page.getText('.error-notification');
      expect(errorMessage).toBe('Failed to load posts');
    });
  });
});

// Additional E2E utilities example
describe('E2E Utilities', () => {
  let browser: BrowserManager;
  let page: Page;

  beforeEach(async () => {
    browser = new BrowserManager();
    await browser.launch({ headless: true });
    page = await browser.newPage();
  });

  afterEach(async () => {
    await browser.close();
  });

  test('should use advanced user actions', async () => {
    await page.goto('https://example.com');

    // Use advanced actions
    await UserActions(page)
      .moveToElement('button')
      .click()
      .type('Hello World')
      .pause(1000)
      .clear()
      .perform();

    // Verify actions completed
    const button = await page.$('button');
    expect(button).toBeDefined();
  });

  test('should use custom assertions', async () => {
    await page.goto('https://example.com');

    // Use custom E2E assertions
    await E2EAssertions(page).assertVisible('h1');
    await E2EAssertions(page).assertContainsText('h1', 'Example');
    await E2EAssertions(page).assertElementExists('a');
    await E2EAssertions(page).assertURLContains('example');
  });

  test('should handle file uploads', async () => {
    await page.goto('https://example.com/upload');

    // Simulate file upload
    const fileInput = await page.$('#file-input');
    const filePath = '/path/to/test/file.txt';

    await fileInput.uploadFile(filePath);

    // Verify file was uploaded
    const uploadStatus = await page.getText('.upload-status');
    expect(uploadStatus).toBe('File uploaded successfully');
  });

  test('should handle forms and validation', async () => {
    await page.goto('https://example.com/form');

    // Fill form
    await page.fill('#name', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.select('#country', 'US');
    await page.check('#terms');

    // Submit form
    await page.click('#submit');

    // Wait for success message
    await page.waitForVisible('.success-message');

    const successMessage = await page.getText('.success-message');
    expect(successMessage).toBe('Form submitted successfully');
  });

  test('should handle iframes', async () => {
    await page.goto('https://example.com/iframe');

    // Switch to iframe
    const iframe = await page.$('iframe');
    const frame = await iframe.contentFrame();

    // Interact with iframe content
    await frame.fill('#input', 'Test');
    await frame.click('#button');

    // Switch back to main frame
    await page.mainFrame();

    // Verify result
    const result = await page.getText('#result');
    expect(result).toBe('Test');
  });

  test('should handle multiple tabs', async () => {
    // Start with one tab
    await page.goto('https://example.com');

    // Open new tab
    const newPage = await browser.newPage();
    await newPage.goto('https://example.com/new');

    // Switch between tabs
    await browser.switchToPage(page);
    expect(page.url()).toContain('example.com');

    await browser.switchToPage(newPage);
    expect(newPage.url()).toContain('/new');

    // Close new tab
    await newPage.close();
  });
});

// Export for use in other tests
export {
  TestApplication,
  LoginPage,
  DashboardPage,
  PostDetailPage
};