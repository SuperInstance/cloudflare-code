package claudeflare

import (
	"context"
	"fmt"
)

// ChatService provides chat completion operations
type ChatService struct {
	client *Client
}

// NewChatService creates a new chat service
func NewChatService(client *Client) *ChatService {
	return &ChatService{client: client}
}

// ChatCompletionsService provides chat completion operations
type ChatCompletionsService struct {
	service *ChatService
}

// Completions returns the completions service
func (s *ChatService) Completions() *ChatCompletionsService {
	return &ChatCompletionsService{service: s}
}

// Create creates a chat completion
func (s *ChatCompletionsService) Create(ctx context.Context, req *ChatCompletionRequest) (*ChatCompletionResponse, error) {
	endpoint := "chat"
	if req.Stream {
		endpoint = "chat/stream"
	}

	var resp ChatCompletionResponse
	err := s.service.client.doRequest(ctx, "POST", endpoint, req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create chat completion: %w", err)
	}

	return &resp, nil
}

// CreateStream creates a streaming chat completion
func (s *ChatCompletionsService) CreateStream(ctx context.Context, req *ChatCompletionRequest) (<-chan ChatCompletionStreamEvent, <-chan error) {
	eventChan := make(chan ChatCompletionStreamEvent, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(eventChan)
		defer close(errChan)

		endpoint := "chat/stream"
		resp, err := s.service.client.doRequestRaw(ctx, "POST", endpoint, req)
		if err != nil {
			errChan <- fmt.Errorf("failed to create stream: %w", err)
			return
		}
		defer resp.Body.Close()

		// Parse SSE stream
		decoder := newSSEDecoder(resp.Body)
		for {
			event, err := decoder.Next()
			if err != nil {
				errChan <- err
				return
			}

			if event == nil {
				return
			}

			select {
			case eventChan <- *event:
			case <-ctx.Done():
				return
			}
		}
	}()

	return eventChan, errChan
}

// ChatCompletionStreamEvent represents an event from the stream
type ChatCompletionStreamEvent struct {
	Type         string     `json:"type"`
	Content      string     `json:"content,omitempty"`
	Error        *APIError  `json:"error,omitempty"`
	Done         bool       `json:"done,omitempty"`
	Usage        *TokenUsage `json:"usage,omitempty"`
	FinishReason string     `json:"finish_reason,omitempty"`
}
