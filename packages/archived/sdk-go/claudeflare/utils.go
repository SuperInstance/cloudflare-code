package claudeflare

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"strings"
)

// doRequest is a helper for making requests and decoding JSON response
func (c *Client) doRequest(ctx context.Context, method, path string, body, v interface{}) error {
	resp, err := c.doRequestRaw(ctx, method, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return c.decodeResponse(resp, v)
}

// doRequestRaw makes a request and returns the raw response
func (c *Client) doRequestRaw(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	return c.doRequestRawWithContentType(ctx, method, path, body, "application/json")
}

// doRequestRawWithContentType makes a request with custom content type
func (c *Client) doRequestRawWithContentType(ctx context.Context, method, path string, body interface{}, contentType string) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		switch v := body.(type) {
		case string:
			bodyReader = strings.NewReader(v)
		case []byte:
			bodyReader = bytes.NewReader(v)
		default:
			jsonData, err := json.Marshal(body)
			if err != nil {
				return nil, err
			}
			bodyReader = bytes.NewReader(jsonData)
		}
	}

	url := fmt.Sprintf("%s/%s/%s", c.config.BaseURL, c.config.APIVersion, path)

	var lastErr error
	for attempt := 0; attempt <= c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			delay := calculateBackoff(attempt)
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
		if err != nil {
			return nil, err
		}

		// Set headers
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
		req.Header.Set("Content-Type", contentType)
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

// calculateBackoff calculates exponential backoff delay
func calculateBackoff(attempt int) time.Duration {
	delay := time.Duration(1<<uint(attempt-1)) * time.Second
	if delay > 8*time.Second {
		delay = 8 * time.Second
	}
	return delay
}

// decodeJSON decodes JSON from reader
func decodeJSON(r io.Reader, v interface{}) error {
	return json.NewDecoder(r).Decode(v)
}

// sseDecoder decodes Server-Sent Events
type sseDecoder struct {
	scanner *bufio.Scanner
}

// newSSEDecoder creates a new SSE decoder
func newSSEDecoder(r io.Reader) *sseDecoder {
	return &sseDecoder{
		scanner: bufio.NewScanner(r),
	}
}

// Next reads the next SSE event
func (d *sseDecoder) Next() (*ChatCompletionStreamEvent, error) {
	for d.scanner.Scan() {
		line := d.scanner.Text()

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}

		// Parse "data: " prefix
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		// Check for [DONE] sentinel
		if data == "[DONE]" {
			return &ChatCompletionStreamEvent{
				Type: "done",
				Done: true,
			}, nil
		}

		// Parse JSON data
		var event ChatCompletionStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			// Invalid JSON, skip
			continue
		}

		return &event, nil
	}

	if err := d.scanner.Err(); err != nil {
		return nil, err
	}

	return nil, nil
}
