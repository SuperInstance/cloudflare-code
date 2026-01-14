/**
 * Privacy Worker Entry Point
 * Coordinates all privacy Durable Objects
 * @packageDocumentation
 */

import {
  ConsentManager,
  RightToAccess,
  RightToErasure,
  RetentionPolicyManager,
  PrivacyPolicyGenerator,
} from './index';

export interface Env {
  PRIVACY_CONSENT: DurableObjectNamespace;
  PRIVACY_ACCESS: DurableObjectNamespace;
  PRIVACY_ERASURE: DurableObjectNamespace;
  PRIVACY_RETENTION: DurableObjectNamespace;
  PRIVACY_POLICY: DurableObjectNamespace;
  PRIVACY_KV: KVNamespace;
  PRIVACY_DB?: D1Database;
}

/**
 * Main Privacy Worker
 * Routes requests to appropriate Durable Objects
 */
export default {
  /**
   * Handle incoming requests
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' || path === '/') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            service: '@claudeflare/privacy',
            version: '1.0.0',
            timestamp: Date.now(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Route to appropriate DO based on path
      if (path.startsWith('/consent')) {
        const consentManager = env.PRIVACY_CONSENT.get(
          env.PRIVACY_CONSENT.idFromName('consent-manager')
        );
        return consentManager.fetch(request);
      }

      if (path.startsWith('/access')) {
        const rightToAccess = env.PRIVACY_ACCESS.get(
          env.PRIVACY_ACCESS.idFromName('access-manager')
        );
        return rightToAccess.fetch(request);
      }

      if (path.startsWith('/erasure')) {
        const rightToErasure = env.PRIVACY_ERASURE.get(
          env.PRIVACY_ERASURE.idFromName('erasure-manager')
        );
        return rightToErasure.fetch(request);
      }

      if (path.startsWith('/retention')) {
        const retentionManager = env.PRIVACY_RETENTION.get(
          env.PRIVACY_RETENTION.idFromName('retention-manager')
        );
        return retentionManager.fetch(request);
      }

      if (path.startsWith('/policy')) {
        const policyGenerator = env.PRIVACY_POLICY.get(
          env.PRIVACY_POLICY.idFromName('policy-generator')
        );
        return policyGenerator.fetch(request);
      }

      // 404 for unknown paths
      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: 'The requested endpoint does not exist',
          availableEndpoints: [
            '/consent/*',
            '/access/*',
            '/erasure/*',
            '/retention/*',
            '/policy/*',
            '/health',
          ],
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Privacy worker error:', error);

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
          service: '@claudeflare/privacy',
          timestamp: Date.now(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },

  /**
   * Handle scheduled events for automated retention
   */
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // Run retention policies daily
    const retentionManager = env.PRIVACY_RETENTION.get(
      env.PRIVACY_RETENTION.idFromName('retention-manager')
    );

    try {
      // Get all active policies
      const policiesResponse = await retentionManager.fetch(
        new Request('https://privacy/retention/policy?active=true', {
          method: 'GET',
        })
      );

      if (policiesResponse.ok) {
        const policies = await policiesResponse.json();

        // Execute each policy
        for (const policy of policies.policies) {
          await retentionManager.fetch(
            new Request('https://privacy/retention/execute', {
              method: 'POST',
              body: JSON.stringify({
                policyId: policy.id,
                dryRun: false,
              }),
            })
          );
        }
      }
    } catch (error) {
      console.error('Scheduled retention error:', error);
    }
  },
};

/**
 * Export Durable Object classes
 */
export {
  ConsentManager,
  RightToAccess,
  RightToErasure,
  RetentionPolicyManager,
  PrivacyPolicyGenerator,
};
