package claudeflare

import (
	"context"
	"fmt"
)

// AgentsService provides agent orchestration operations
type AgentsService struct {
	client *Client

	Orchestrate *AgentOrchestrationService
	Registry    *AgentRegistryService
}

// NewAgentsService creates a new agents service
func NewAgentsService(client *Client) *AgentsService {
	s := &AgentsService{client: client}
	s.Orchestrate = &AgentOrchestrationService{service: s}
	s.Registry = &AgentRegistryService{service: s}
	return s
}

// AgentOrchestrationService provides agent orchestration operations
type AgentOrchestrationService struct {
	service *AgentsService
}

// Create orchestrates agents for a task
func (s *AgentOrchestrationService) Create(ctx context.Context, req *AgentOrchestrationRequest) (*AgentOrchestrationResponse, error) {
	var resp AgentOrchestrationResponse
	err := s.service.client.doRequest(ctx, "POST", "agents/orchestrate", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to orchestrate agents: %w", err)
	}

	return &resp, nil
}

// CreateStream orchestrates agents with streaming updates
func (s *AgentOrchestrationService) CreateStream(ctx context.Context, req *AgentOrchestrationRequest) (<-chan AgentOrchestrationResponse, <-chan error) {
	respChan := make(chan AgentOrchestrationResponse, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(respChan)
		defer close(errChan)

		resp, err := s.service.client.doRequestRaw(ctx, "POST", "agents/orchestrate", req)
		if err != nil {
			errChan <- fmt.Errorf("failed to create orchestration stream: %w", err)
			return
		}
		defer resp.Body.Close()

		decoder := newSSEDecoder(resp.Body)
		for {
			event, err := decoder.Next()
			if err != nil {
				errChan <- err
				return
			}

			if event == nil || event.Done {
				return
			}

			var orchestrationResp AgentOrchestrationResponse
			if err := decodeJSON(event.Data, &orchestrationResp); err == nil {
				select {
				case respChan <- orchestrationResp:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return respChan, errChan
}

// AgentRegistryService provides agent registry operations
type AgentRegistryService struct {
	service *AgentsService
}

// GetStatus gets agent registry status
func (s *AgentRegistryService) GetStatus(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := s.service.client.doRequest(ctx, "GET", "agents/status", nil, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get agent registry status: %w", err)
	}

	return result, nil
}

// List lists available agents
func (s *AgentRegistryService) List(ctx context.Context, agentType *AgentType) ([]Agent, error) {
	endpoint := "agents/available"
	if agentType != nil {
		endpoint += "/" + string(*agentType)
	}

	var result struct {
		Agents    []Agent `json:"agents"`
		Count     int     `json:"count"`
		Timestamp float64 `json:"timestamp"`
	}

	err := s.service.client.doRequest(ctx, "GET", endpoint, nil, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}

	return result.Agents, nil
}

// GetAll gets all available agents
func (s *AgentRegistryService) GetAll(ctx context.Context) ([]Agent, error) {
	return s.List(ctx, nil)
}

// GetByType gets agents by type
func (s *AgentRegistryService) GetByType(ctx context.Context, agentType AgentType) ([]Agent, error) {
	return s.List(ctx, &agentType)
}
