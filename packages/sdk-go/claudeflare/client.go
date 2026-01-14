// Package claudeflare provides a Go SDK for ClaudeFlare
package claudeflare

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Default configuration values
const (
	DefaultBaseURL     = "https://api.claudeflare.com"
	DefaultAPIVersion  = "v1"
	DefaultTimeout     = 60 * time.Second
	DefaultMaxRetries  = 3
	DefaultUserAgent   = "claudeflare-go/0.1.0"
)

// Config is the configuration for the ClaudeFlare client
type Config struct {
	// APIKey is the API key for authentication (required)
	APIKey string

	// BaseURL is the base URL for API requests
	BaseURL string

	// APIVersion is the API version to use
	APIVersion string

	// Timeout is the request timeout
	Timeout time.Duration

	// MaxRetries is the maximum number of retries
	MaxRetries int

	// Debug enables debug logging
	Debug bool

	// HTTPClient is the custom HTTP client to use
	HTTPClient *http.Client

	// DefaultHeaders are additional headers to include in all requests
	DefaultHeaders map[string]string
}

// Client is the ClaudeFlare API client
type Client struct {
	config     Config
	httpClient *http.Client

	// API resources
	Chat    *ChatService
	Code    *CodeService
	Agents  *AgentsService
	Models  *ModelsService
	Codebase *CodebaseService
}

// NewClient creates a new ClaudeFlare client
func NewClient(apiKey string) *Client {
	return NewClientWithConfig(Config{
		APIKey: apiKey,
	})
}

// NewClientWithConfig creates a new ClaudeFlare client with custom configuration
func NewClientWithConfig(config Config) *Client {
	if config.BaseURL == "" {
		config.BaseURL = DefaultBaseURL
	}
	if config.APIVersion == "" {
		config.APIVersion = DefaultAPIVersion
	}
	if config.Timeout == 0 {
		config.Timeout = DefaultTimeout
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = DefaultMaxRetries
	}

	httpClient := config.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: config.Timeout,
		}
	}

	client := &Client{
		config:     config,
		httpClient: httpClient,
	}

	// Initialize services
	client.Chat = NewChatService(client)
	client.Code = NewCodeService(client)
	client.Agents = NewAgentsService(client)
	client.Models = NewModelsService(client)
	client.Codebase = NewCodebaseService(client)

	return client
}

// doRequest performs an HTTP request with retry logic
func (c *Client) doRequest(
	ctx context.Context,
	method, path string,
	body interface{},
) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonData)
	}

	url := fmt.Sprintf("%s/%s/%s", c.config.BaseURL, c.config.APIVersion, path)

	var lastErr error
	for attempt := 0; attempt <= c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			delay := time.Duration(1<<uint(attempt-1)) * time.Second
			if delay > 8*time.Second {
				delay = 8 * time.Second
			}
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		// Set headers
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", DefaultUserAgent)
		req.Header.Set("X-Request-ID", generateRequestID())

		// Add default headers
		for k, v := range c.config.DefaultHeaders {
			req.Header.Set(k, v)
		}

		// Log request if debug mode
		if c.config.Debug {
			fmt.Printf("[DEBUG] Request: %s %s\n", method, url)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			if c.config.Debug {
				fmt.Printf("[DEBUG] Request failed: %v\n", err)
			}
			continue
		}

		// Log response if debug mode
		if c.config.Debug {
			fmt.Printf("[DEBUG] Response: %d %s\n", resp.StatusCode, resp.Status)
		}

		// Don't retry non-retryable errors
		if resp.StatusCode < 500 && resp.StatusCode != 408 && resp.StatusCode != 429 {
			return resp, nil
		}

		// Retry server errors
		resp.Body.Close()
		lastErr = fmt.Errorf("server error: %d", resp.StatusCode)
	}

	return nil, lastErr
}

// decodeResponse decodes a JSON response
func (c *Client) decodeResponse(resp *http.Response, v interface{}) error {
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return decodeError(resp.StatusCode, body)
	}

	if err := json.Unmarshal(body, v); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	return nil
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	return fmt.Sprintf("req_%d_%s", time.Now().UnixMilli(), randomString(9))
}

// randomString generates a random string
func randomString(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[time.Now().UnixNano()%int64(len(chars))]
	}
	return string(b)
}
