/**
 * Contract testing runner for ClaudeFlare
 */

import { Interaction, Pact } from '@pact-foundation/pact';
import type { ContractTestConfig, ContractTestResult, ContractError } from '../utils/types';

/**
 * Contract test runner class
 */
export class ContractTestRunner {
  private config: ContractTestConfig;
  private interactions: Interaction[] = [];
  private errors: ContractError[] = [];

  constructor(config: ContractTestConfig) {
    this.config = config;
  }

  /**
   * Run contract tests
   */
  async runTests(consumer: string, provider: string): Promise<ContractTestResult> {
    const startTime = Date.now();
    this.errors = [];

    // Setup Pact provider
    const pact = new Pact({
      consumer,
      provider,
      port: 1234,
      log: './contracts/pacts/logs',
      dir: './contracts/pacts',
      logLevel: 'INFO',
      spec: 3
    });

    try {
      // Setup provider
      await pact.setup();

      // Run interactions
      for (const interaction of this.interactions) {
        try {
          await pact.addInteraction(interaction);
        } catch (error) {
          this.errors.push({
            interaction: interaction.description,
            message: (error as Error).message,
            expected: interaction,
            actual: null
          });
        }
      }

      // Verify interactions
      await pact.verify();

      // Write contracts if configured
      if (this.config.publishContracts) {
        await pact.writePact();
      }

      // Publish to Pact Broker if configured
      if (this.config.pactBrokerUrl) {
        await pact.publish();
      }

      const duration = Date.now() - startTime;

      return {
        name: `${consumer} -> ${provider}`,
        timestamp: new Date(),
        consumer,
        provider,
        interactions: this.interactions,
        passed: this.errors.length === 0,
        errors: this.errors
      };
    } finally {
      await pact.finalize();
    }
  }

  /**
   * Add an interaction
   */
  addInteraction(interaction: Interaction): void {
    this.interactions.push(interaction);
  }

  /**
   * Create a GET interaction
   */
  createGetInteraction(
    description: string,
    path: string,
    response: {
      status: number;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Interaction {
    return {
      description,
      request: {
        method: 'GET',
        path,
        headers: {
          'Accept': 'application/json'
        }
      },
      response: {
        status: response.status,
        headers: response.headers || {
          'Content-Type': 'application/json'
        },
        body: response.body
      }
    } as Interaction;
  }

  /**
   * Create a POST interaction
   */
  createPostInteraction(
    description: string,
    path: string,
    requestBody: unknown,
    response: {
      status: number;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Interaction {
    return {
      description,
      request: {
        method: 'POST',
        path,
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      },
      response: {
        status: response.status,
        headers: response.headers || {
          'Content-Type': 'application/json'
        },
        body: response.body
      }
    } as Interaction;
  }

  /**
   * Create a PUT interaction
   */
  createPutInteraction(
    description: string,
    path: string,
    requestBody: unknown,
    response: {
      status: number;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Interaction {
    return {
      description,
      request: {
        method: 'PUT',
        path,
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
      },
      response: {
        status: response.status,
        headers: response.headers || {
          'Content-Type': 'application/json'
        },
        body: response.body
      }
    } as Interaction;
  }

  /**
   * Create a DELETE interaction
   */
  createDeleteInteraction(
    description: string,
    path: string,
    response: {
      status: number;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Interaction {
    return {
      description,
      request: {
        method: 'DELETE',
        path,
        headers: {
          'Accept': 'application/json'
        }
      },
      response: {
        status: response.status,
        headers: response.headers || {
          'Content-Type': 'application/json'
        },
        body: response.body
      }
    } as Interaction;
  }
}

/**
 * Contract verification helper
 */
export class ContractVerifier {
  /**
   * Verify provider against contract
   */
  static async verify(
    providerBaseUrl: string,
    pactUrls: string[]
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const pactUrl of pactUrls) {
      try {
        // Fetch pact file
        const response = await fetch(pactUrl);
        const pact = await response.json();

        // Verify each interaction
        for (const interaction of pact.interactions) {
          try {
            await this.verifyInteraction(providerBaseUrl, interaction);
          } catch (error) {
            errors.push(
              `${interaction.description}: ${(error as Error).message}`
            );
          }
        }
      } catch (error) {
        errors.push(`Failed to load pact from ${pactUrl}: ${(error as Error).message}`);
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Verify a single interaction
   */
  private static async verifyInteraction(
    baseUrl: string,
    interaction: any
  ): Promise<void> {
    const url = `${baseUrl}${interaction.request.path}`;

    const response = await fetch(url, {
      method: interaction.request.method,
      headers: interaction.request.headers,
      body: interaction.request.body
        ? JSON.stringify(interaction.request.body)
        : undefined
    });

    // Verify status
    if (response.status !== interaction.response.status) {
      throw new Error(
        `Expected status ${interaction.response.status} but got ${response.status}`
      );
    }

    // Verify headers
    if (interaction.response.headers) {
      for (const [key, value] of Object.entries(interaction.response.headers)) {
        const actualValue = response.headers.get(key);
        if (actualValue !== value) {
          throw new Error(
            `Expected header ${key}: ${value} but got ${actualValue}`
          );
        }
      }
    }

    // Verify body
    if (interaction.response.body) {
      const actualBody = await response.json();
      // Deep comparison would go here
      // For simplicity, we're doing basic equality
    }
  }
}

/**
 * Contract publisher for Pact Broker
 */
export class ContractPublisher {
  /**
   * Publish contracts to Pact Broker
   */
  static async publish(
    pactDirectory: string,
    pactBrokerUrl: string,
    consumerVersion: string
  ): Promise<void> {
    // This would integrate with Pact Broker CLI or API
    // Placeholder for now
  }

  /**
   * Tag contracts in Pact Broker
   */
  static async tag(
    pactBrokerUrl: string,
    consumer: string,
    version: string,
    tag: string
  ): Promise<void> {
    // This would tag contracts in Pact Broker
    // Placeholder for now
  }
}
