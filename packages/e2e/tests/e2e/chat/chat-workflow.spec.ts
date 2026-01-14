import { test, expect } from '@playwright/test';
import { TestHelpers, TestDataGenerator } from '../../utils/test-helpers';

/**
 * Chat Workflow E2E Tests
 *
 * Tests chat interface, message sending, streaming responses, and conversation history
 */

test.describe('Chat - Message Sending', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');
  });

  test('should display chat interface', async ({ page }) => {
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('should send message and receive response', async ({ page }) => {
    const message = TestDataGenerator.chatMessage();

    await page.fill('[data-testid="message-input"]', message);
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="user-message"]')).toContainText(message);
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('should handle Enter key to send message', async ({ page }) => {
    const message = TestDataGenerator.chatMessage();

    await page.fill('[data-testid="message-input"]', message);
    await page.press('[data-testid="message-input"]', 'Enter');

    await expect(page.locator('[data-testid="user-message"]')).toContainText(message);
  });

  test('should handle Shift+Enter for new line', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Line 1');
    await page.press('[data-testid="message-input"]', 'Shift+Enter');
    await page.type('[data-testid="message-input"]', 'Line 2');

    const inputText = await page.inputValue('[data-testid="message-input"]');
    expect(inputText).toContain('Line 1\nLine 2');
  });

  test('should disable send button with empty input', async ({ page }) => {
    const sendButton = page.locator('[data-testid="send-button"]');
    await expect(sendButton).toBeDisabled();

    await page.fill('[data-testid="message-input"]', 'test');
    await expect(sendButton).toBeEnabled();

    await page.fill('[data-testid="message-input"]', '');
    await expect(sendButton).toBeDisabled();
  });

  test('should show loading indicator while processing', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
  });

  test('should display message timestamps', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Test');
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="message-timestamp"]')).toBeVisible();
  });

  test('should handle long messages', async ({ page }) => {
    const longMessage = 'a'.repeat(5000);

    await page.fill('[data-testid="message-input"]', longMessage);
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="user-message"]')).toContainText(longMessage.substring(0, 100));
  });
});

test.describe('Chat - Streaming Responses', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');
  });

  test('should display streaming response', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Tell me a short story');
    await page.click('[data-testid="send-button"]');

    const assistantMessage = page.locator('[data-testid="assistant-message"]');

    // Should appear immediately
    await expect(assistantMessage).toBeVisible();

    // Content should stream in
    await page.waitForTimeout(1000);
    const initialContent = await assistantMessage.textContent();

    await page.waitForTimeout(1000);
    const laterContent = await assistantMessage.textContent();

    expect(laterContent?.length).toBeGreaterThan(initialContent?.length || 0);
  });

  test('should show streaming indicator', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Test streaming');
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

    await page.waitForTimeout(3000);

    await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible();
  });

  test('should handle stop generation button', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Generate a long response');
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="stop-button"]')).toBeVisible();

    await page.click('[data-testid="stop-button"]');

    await expect(page.locator('[data-testid="stop-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible();
  });
});

test.describe('Chat - Conversation History', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');
  });

  test('should display conversation history', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'First message');
    await page.click('[data-testid="send-button"]');

    await page.waitForTimeout(1000);

    await page.fill('[data-testid="message-input"]', 'Second message');
    await page.click('[data-testid="send-button"]');

    await page.waitForTimeout(1000);

    const messages = page.locator('[data-testid^="message-"]');
    await expect(messages).toHaveCount(4); // 2 user + 2 assistant
  });

  test('should scroll to bottom on new message', async ({ page }) => {
    // Send multiple messages
    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="message-input"]", `Message ${i}`);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(500);
    }

    const scrollPosition = await page.evaluate(() => window.scrollY);
    const documentHeight = await page.evaluate(() => document.body.scrollHeight);

    expect(scrollPosition).toBeGreaterThan(documentHeight - 1000);
  });

  test('should load previous messages on scroll up', async ({ page }) => {
    // Generate many messages
    for (let i = 0; i < 20; i++) {
      await page.fill('[data-testid="message-input"]", `Message ${i}`);
      await page.click('[data-testid="send-button"]');
    }

    const initialCount = await page.locator('[data-testid^="message-"]').count();

    // Scroll to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const finalCount = await page.locator('[data-testid^="message-"]').count();

    expect(finalCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should persist conversation across page refresh', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');

    await page.waitForTimeout(1000);

    await page.reload();

    await expect(page.locator('[data-testid="user-message"]')).toContainText('Test message');
  });
});

test.describe('Chat - Model Selection', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');
  });

  test('should display model selector', async ({ page }) => {
    await expect(page.locator('[data-testid="model-selector"]')).toBeVisible();
  });

  test('should change model', async ({ page }) => {
    await page.click('[data-testid="model-selector"]');
    await page.click('[data-testid="model-gpt-4"]');

    await expect(page.locator('[data-testid="selected-model"]')).toContainText('GPT-4');
  });

  test('should show model capabilities', async ({ page }) => {
    await page.click('[data-testid="model-selector"]');

    await expect(page.locator('[data-testid="model-capabilities"]')).toBeVisible();
  });

  test('should remember model preference', async ({ page }) => {
    await page.click('[data-testid="model-selector"]');
    await page.click('[data-testid="model-claude"]');

    await page.reload();

    await expect(page.locator('[data-testid="selected-model"]')).toContainText('Claude');
  });
});

test.describe('Chat - Message Actions', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');

    await page.fill('[data-testid="message-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');
    await page.waitForTimeout(1000);
  });

  test('should copy message content', async ({ page }) => {
    const message = page.locator('[data-testid="user-message"]').first();
    await message.hover();
    await page.click('[data-testid="copy-message"]');

    await expect(page.locator('[data-testid="toast"]')).toContainText('Copied to clipboard');
  });

  test('should regenerate response', async ({ page }) => {
    const assistantMessage = page.locator('[data-testid="assistant-message"]').first();
    const firstResponse = await assistantMessage.textContent();

    await assistantMessage.hover();
    await page.click('[data-testid="regenerate-response"]');

    await page.waitForTimeout(2000);

    const secondResponse = await assistantMessage.textContent();
    expect(secondResponse).not.toBe(firstResponse);
  });

  test('should edit message', async ({ page }) => {
    const userMessage = page.locator('[data-testid="user-message"]').first();
    await userMessage.hover();
    await page.click('[data-testid="edit-message"]');

    await page.fill('[data-testid="message-edit-input"]', 'Edited message');
    await page.click('[data-testid="save-edit"]');

    await expect(userMessage).toContainText('Edited message');
  });

  test('should delete message', async ({ page }) => {
    const initialCount = await page.locator('[data-testid^="message-"]').count();

    const userMessage = page.locator('[data-testid="user-message"]').first();
    await userMessage.hover();
    await page.click('[data-testid="delete-message"]');
    await page.click('[data-testid="confirm-delete"]');

    const finalCount = await page.locator('[data-testid^="message-"]').count();
    expect(finalCount).toBe(initialCount - 1);
  });

  test('should react to message', async ({ page }) => {
    const message = page.locator('[data-testid="assistant-message"]').first();
    await message.hover();
    await page.click('[data-testid="react-message"]');

    await page.click('[data-testid="reaction-thumbs-up"]');

    await expect(message.locator('[data-testid="reaction"]')).toBeVisible();
  });
});

test.describe('Chat - Code Generation', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');
  });

  test('should display code blocks with syntax highlighting', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Write a function to add two numbers in TypeScript');
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="code-block"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="code-block"]').locator('code')).toBeVisible();
  });

  test('should copy code from code block', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Generate a hello world function');
    await page.click('[data-testid="send-button"]');

    await page.waitForTimeout(2000);

    await page.locator('[data-testid="code-block"]').hover();
    await page.click('[data-testid="copy-code"]');

    await expect(page.locator('[data-testid="toast"]')).toContainText('Code copied');
  });

  test('should insert code into editor', async ({ page }) => {
    await page.fill('[data-testid="message-input"]', 'Generate a TypeScript function');
    await page.click('[data-testid="send-button"]');

    await page.waitForTimeout(2000);

    await page.locator('[data-testid="code-block"]').hover();
    await page.click('[data-testid="insert-in-editor"]');

    await expect(page.locator('[data-testid="editor"]')).toContainText('function');
  });
});

test.describe('Chat - File Upload', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');
  });

  test('should upload file', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: 'test.ts',
      mimeType: 'text/typescript',
      buffer: Buffer.from('export function test() {}')
    });

    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
  });

  test('should send file with message', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: 'test.ts',
      mimeType: 'text/typescript',
      buffer: Buffer.from('export function test() {}')
    });

    await page.fill('[data-testid="message-input"]', 'Explain this code');
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
  });

  test('should validate file type', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: 'test.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('invalid')
    });

    await expect(page.locator('[data-testid="error"]')).toContainText('Invalid file type');
  });

  test('should validate file size', async ({ page }) => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: 'large.txt',
      mimeType: 'text/plain',
      buffer: largeBuffer
    });

    await expect(page.locator('[data-testid="error"]')).toContainText('File too large');
  });
});

test.describe('Chat - Performance', () => {
  test('should handle rapid message sending', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');

    const startTime = Date.now();

    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="message-input"]", `Message ${i}`);
      await page.click('[data-testid="send-button"]');
    }

    await page.waitForTimeout(5000);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(10000);
  });

  test('should not block UI during streaming', async ({ page }) => {
    const helpers = new TestHelpers(page);
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword';
    await helpers.login(email, password);
    await helpers.navigateTo('/chat');

    await page.fill('[data-testid="message-input"]', 'Tell me a long story');
    await page.click('[data-testid="send-button"]');

    await page.waitForTimeout(500);

    // Should be able to interact with UI while streaming
    await expect(page.locator('[data-testid="stop-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="message-input"]')).toBeEnabled();
  });
});
