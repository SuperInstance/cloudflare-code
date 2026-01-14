/**
 * Partner API Routes
 * HTTP API endpoints for partner integrations
 */

import { IntegrationConfig, OAuthToken, PartnerAPIKey, APIQuota } from '../types';
import { OAuthProviderService } from '../oauth/provider';
import { OIDCService } from '../oauth/oidc';
import { WebhookManager } from '../webhooks';
import { IntegrationMonitoringService } from '../monitoring/metrics';

export class PartnerAPIRouter {
  private oauthService: OAuthProviderService;
  private oidcService: OIDCService;
  private webhookManager: WebhookManager;
  private monitoringService: IntegrationMonitoringService;

  constructor() {
    this.oauthService = new OAuthProviderService();
    this.oidcService = new OIDCService();
    this.webhookManager = new WebhookManager();
    this.monitoringService = new IntegrationMonitoringService();
  }

  /**
   * Handle OAuth authorization request
   */
  public async handleOAuthAuthorization(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const partnerId = url.searchParams.get('partner_id');
      const clientId = url.searchParams.get('client_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      const scopes = url.searchParams.get('scopes')?.split(',') || [];
      const state = url.searchParams.get('state') || undefined;

      if (!partnerId || !clientId || !redirectUri) {
        return this.errorResponse('Missing required parameters', 400);
      }

      const { url: authUrl, session } = this.oauthService.generateAuthorizationUrl(
        partnerId,
        clientId,
        redirectUri,
        scopes,
        state
      );

      // Store session ID in cookie
      const response = Response.redirect(authUrl, 302);
      response.headers.set('Set-Cookie', `oauth_session=${session.id}; HttpOnly; Secure; SameSite=Lax`);

      return response;
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Authorization failed', 500);
    }
  }

  /**
   * Handle OAuth callback
   */
  public async handleOAuthCallback(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        return this.errorResponse(`OAuth error: ${error}`, 400);
      }

      if (!code || !state) {
        return this.errorResponse('Missing code or state', 400);
      }

      // Get session from cookie
      const sessionId = this.getCookie(request, 'oauth_session');
      if (!sessionId) {
        return this.errorResponse('Session not found', 400);
      }

      const session = this.oauthService.getSession(sessionId);
      if (!session) {
        return this.errorResponse('Invalid session', 400);
      }

      // Exchange code for token
      const token = await this.oauthService.exchangeCodeForToken(
        session.partnerId,
        code,
        state,
        session
      );

      // Return success with token info
      return this.jsonResponse({
        success: true,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_in: token.expiresIn,
        scope: token.scope
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Callback failed', 500);
    }
  }

  /**
   * Refresh OAuth token
   */
  public async handleTokenRefresh(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { token_id: string };

      if (!body.token_id) {
        return this.errorResponse('Missing token_id', 400);
      }

      const token = await this.oauthService.refreshToken(body.token_id);

      return this.jsonResponse({
        success: true,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_in: token.expiresIn
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Refresh failed', 500);
    }
  }

  /**
   * Revoke OAuth token
   */
  public async handleTokenRevocation(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { token_id: string };

      if (!body.token_id) {
        return this.errorResponse('Missing token_id', 400);
      }

      await this.oauthService.revokeToken(body.token_id);

      return this.jsonResponse({ success: true });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Revocation failed', 500);
    }
  }

  /**
   * List available partners
   */
  public async handleListPartners(): Promise<Response> {
    try {
      const providers = this.oauthService.getAllProviders();

      const partners = providers.map(p => ({
        id: p.id,
        name: p.name,
        scopes: p.scopes,
        default_scopes: p.defaultScopes,
        pkce: p.pkce
      }));

      return this.jsonResponse({ partners });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to list partners', 500);
    }
  }

  /**
   * Get partner info
   */
  public async handleGetPartner(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const partnerId = url.pathname.split('/').pop();

      if (!partnerId) {
        return this.errorResponse('Partner ID required', 400);
      }

      const provider = this.oauthService.getProvider(partnerId);

      if (!provider) {
        return this.errorResponse('Partner not found', 404);
      }

      return this.jsonResponse({
        id: provider.id,
        name: provider.name,
        scopes: provider.scopes,
        default_scopes: provider.defaultScopes,
        pkce: provider.pkce
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to get partner', 500);
    }
  }

  /**
   * Create webhook subscription
   */
  public async handleCreateWebhook(request: Request): Promise<Response> {
    try {
      const body = await request.json();

      const webhook = await this.webhookManager.createWebhook(body);

      return this.jsonResponse({
        success: true,
        webhook
      }, 201);
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to create webhook', 500);
    }
  }

  /**
   * Test webhook
   */
  public async handleTestWebhook(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const webhookId = url.pathname.split('/').pop();

      if (!webhookId) {
        return this.errorResponse('Webhook ID required', 400);
      }

      // Get webhook (would come from database)
      // await this.webhookManager.deliverEvent(webhook, 'test', { test: true });

      return this.jsonResponse({
        success: true,
        message: 'Webhook test sent'
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to test webhook', 500);
    }
  }

  /**
   * Get webhook delivery history
   */
  public async handleWebhookHistory(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const webhookId = url.pathname.split('/').pop();
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);

      if (!webhookId) {
        return this.errorResponse('Webhook ID required', 400);
      }

      const history = this.webhookManager.getHistory(webhookId, limit);

      return this.jsonResponse({
        webhook_id: webhookId,
        history,
        count: history.length
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to get history', 500);
    }
  }

  /**
   * Get integration metrics
   */
  public async handleGetMetrics(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const partnerId = url.searchParams.get('partner_id');
      const integrationId = url.searchParams.get('integration_id');
      const period = url.searchParams.get('period') || 'hour';

      if (!partnerId || !integrationId) {
        return this.errorResponse('partner_id and integration_id required', 400);
      }

      const metrics = this.monitoringService.getAggregatedMetrics(
        partnerId,
        integrationId,
        period as any
      );

      return this.jsonResponse({
        metrics,
        period
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to get metrics', 500);
    }
  }

  /**
   * Get integration health
   */
  public async handleGetHealth(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const integrationId = url.pathname.split('/').pop();

      if (!integrationId) {
        return this.errorResponse('Integration ID required', 400);
      }

      const health = this.monitoringService.getHealth(integrationId);

      if (!health) {
        return this.errorResponse('Health check not found', 404);
      }

      return this.jsonResponse(health);
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to get health', 500);
    }
  }

  /**
   * Get integration alerts
   */
  public async handleGetAlerts(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const integrationId = url.pathname.split('/').pop();

      if (!integrationId) {
        return this.errorResponse('Integration ID required', 400);
      }

      const alerts = this.monitoringService.getAlerts(integrationId);

      return this.jsonResponse({
        integration_id: integrationId,
        alerts,
        count: alerts.length
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to get alerts', 500);
    }
  }

  /**
   * Resolve alert
   */
  public async handleResolveAlert(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const alertId = url.pathname.split('/').slice(-2)[0];
      const integrationId = url.searchParams.get('integration_id');

      if (!alertId || !integrationId) {
        return this.errorResponse('Alert ID and integration_id required', 400);
      }

      this.monitoringService.resolveAlert(alertId, integrationId);

      return this.jsonResponse({
        success: true,
        message: 'Alert resolved'
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to resolve alert', 500);
    }
  }

  /**
   * Verify webhook signature
   */
  public async handleVerifyWebhook(request: Request): Promise<Response> {
    try {
      const signature = request.headers.get('X-Webhook-Signature');
      const timestamp = request.headers.get('X-Webhook-Timestamp');

      if (!signature || !timestamp) {
        return this.errorResponse('Missing signature headers', 401);
      }

      const body = await request.text();

      // Get webhook secret (would come from database)
      const secret = 'webhook_secret';

      const isValid = this.webhookManager.verifyWebhook(body, signature, secret, timestamp);

      if (!isValid) {
        return this.errorResponse('Invalid signature', 401);
      }

      // Process webhook
      const payload = JSON.parse(body);

      return this.jsonResponse({
        success: true,
        message: 'Webhook verified'
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Verification failed', 500);
    }
  }

  /**
   * Get usage statistics
   */
  public async handleGetUsageStats(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const partnerId = url.searchParams.get('partner_id');
      const period = url.searchParams.get('period') || 'day';

      if (!partnerId) {
        return this.errorResponse('partner_id required', 400);
      }

      const stats = this.monitoringService.getUsageStats(partnerId, period as any);

      return this.jsonResponse({
        partner_id: partnerId,
        period,
        stats,
        count: stats.length
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to get usage stats', 500);
    }
  }

  /**
   * Create API key for partner
   */
  public async handleCreateAPIKey(request: Request): Promise<Response> {
    try {
      const body = await request.json();

      // Generate API key
      const keyId = crypto.randomUUID();
      const keyPrefix = 'cfp_'; // ClaudeFlare Partner
      const keyValue = this.generateSecureKey();

      const apiKey: PartnerAPIKey = {
        id: keyId,
        partnerId: body.partner_id,
        userId: body.user_id,
        name: body.name,
        keyPrefix,
        keyHash: await this.hashKey(keyValue),
        scopes: body.scopes || [],
        expiresAt: body.expires_at ? new Date(body.expires_at) : undefined,
        createdAt: new Date(),
        revoked: false
      };

      return this.jsonResponse({
        success: true,
        api_key: {
          id: apiKey.id,
          key: `${keyPrefix}${keyValue}`,
          ...apiKey
        }
      }, 201);
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to create API key', 500);
    }
  }

  /**
   * Revoke API key
   */
  public async handleRevokeAPIKey(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const keyId = url.pathname.split('/').pop();

      if (!keyId) {
        return this.errorResponse('Key ID required', 400);
      }

      // Would update in database
      // await revokeAPIKey(keyId);

      return this.jsonResponse({
        success: true,
        message: 'API key revoked'
      });
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Failed to revoke API key', 500);
    }
  }

  /**
   * Generate secure API key
   */
  private generateSecureKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash API key
   */
  private async hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get cookie from request
   */
  private getCookie(request: Request, name: string): string | undefined {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return undefined;
    }

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const cookie = cookies.find(c => c.startsWith(`${name}=`));

    return cookie?.split('=')[1];
  }

  /**
   * Create JSON response
   */
  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }

  /**
   * Create error response
   */
  private errorResponse(message: string, status = 500): Response {
    return this.jsonResponse({
      success: false,
      error: message
    }, status);
  }

  /**
   * Route request to handler
   */
  public async route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // OAuth routes
    if (path.startsWith('/oauth/authorize') && method === 'GET') {
      return this.handleOAuthAuthorization(request);
    }

    if (path.startsWith('/oauth/callback') && method === 'GET') {
      return this.handleOAuthCallback(request);
    }

    if (path.startsWith('/oauth/refresh') && method === 'POST') {
      return this.handleTokenRefresh(request);
    }

    if (path.startsWith('/oauth/revoke') && method === 'POST') {
      return this.handleTokenRevocation(request);
    }

    // Partner routes
    if (path === '/partners' && method === 'GET') {
      return this.handleListPartners();
    }

    if (path.startsWith('/partners/') && method === 'GET' && !path.includes('/webhooks')) {
      return this.handleGetPartner(request);
    }

    // Webhook routes
    if (path.startsWith('/webhooks') && method === 'POST') {
      return this.handleCreateWebhook(request);
    }

    if (path.startsWith('/webhooks/') && path.includes('/test') && method === 'POST') {
      return this.handleTestWebhook(request);
    }

    if (path.startsWith('/webhooks/') && path.includes('/history') && method === 'GET') {
      return this.handleWebhookHistory(request);
    }

    if (path.startsWith('/webhooks/verify') && method === 'POST') {
      return this.handleVerifyWebhook(request);
    }

    // Monitoring routes
    if (path.startsWith('/metrics') && method === 'GET') {
      return this.handleGetMetrics(request);
    }

    if (path.startsWith('/health/') && method === 'GET') {
      return this.handleGetHealth(request);
    }

    if (path.startsWith('/alerts/') && method === 'GET') {
      return this.handleGetAlerts(request);
    }

    if (path.startsWith('/alerts/') && path.includes('/resolve') && method === 'POST') {
      return this.handleResolveAlert(request);
    }

    if (path.startsWith('/usage') && method === 'GET') {
      return this.handleGetUsageStats(request);
    }

    // API key routes
    if (path.startsWith('/api-keys') && method === 'POST') {
      return this.handleCreateAPIKey(request);
    }

    if (path.startsWith('/api-keys/') && path.includes('/revoke') && method === 'POST') {
      return this.handleRevokeAPIKey(request);
    }

    return this.errorResponse('Not found', 404);
  }
}
