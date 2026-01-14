package claudeflare

import (
	"context"
	"fmt"
	"sort"
)

// ModelsService provides model operations
type ModelsService struct {
	client *Client
}

// NewModelsService creates a new models service
func NewModelsService(client *Client) *ModelsService {
	return &ModelsService{client: client}
}

// List lists all available models
func (s *ModelsService) List(ctx context.Context) (*ModelsListResponse, error) {
	var resp ModelsListResponse
	err := s.client.doRequest(ctx, "GET", "models", nil, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list models: %w", err)
	}

	return &resp, nil
}

// Get gets a specific model by ID
func (s *ModelsService) Get(ctx context.Context, id string) (*Model, error) {
	var resp Model
	err := s.client.doRequest(ctx, "GET", "models/"+id, nil, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to get model: %w", err)
	}

	return &resp, nil
}

// Find finds a model by name or ID
func (s *ModelsService) Find(ctx context.Context, query string) (*Model, error) {
	resp, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	// Try exact match
	for _, model := range resp.Models {
		if model.ID == query || model.Name == query {
			return &model, nil
		}
	}

	// Try partial match
	for _, model := range resp.Models {
		if contains(model.Name, query) {
			return &model, nil
		}
	}

	return nil, NewNotFoundError("model")
}

// ListByProvider lists models by provider
func (s *ModelsService) ListByProvider(ctx context.Context, provider AIProvider) ([]Model, error) {
	resp, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	var models []Model
	for _, model := range resp.Models {
		if model.Provider == provider {
			models = append(models, model)
		}
	}

	return models, nil
}

// GetCheapest gets the cheapest model
func (s *ModelsService) GetCheapest(ctx context.Context, provider *AIProvider, maxContextLength *int) (*Model, error) {
	resp, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	var models []Model
	for _, model := range resp.Models {
		if model.Pricing == nil {
			continue
		}

		if provider != nil && model.Provider != *provider {
			continue
		}

		if maxContextLength != nil && model.ContextLength > *maxContextLength {
			continue
		}

		models = append(models, model)
	}

	if len(models) == 0 {
		return nil, NewNotFoundError("model")
	}

	// Sort by total cost
	sort.Slice(models, func(i, j int) bool {
		costI := models[i].Pricing.InputCostPer1K + models[i].Pricing.OutputCostPer1K
		costJ := models[j].Pricing.InputCostPer1K + models[j].Pricing.OutputCostPer1K
		return costI < costJ
	})

	return &models[0], nil
}

// GetLargestContext gets the model with the largest context window
func (s *ModelsService) GetLargestContext(ctx context.Context, provider *AIProvider) (*Model, error) {
	resp, err := s.List(ctx)
	if err != nil {
		return nil, err
	}

	var models []Model
	if provider != nil {
		for _, model := range resp.Models {
			if model.Provider == *provider {
				models = append(models, model)
			}
		}
	} else {
		models = resp.Models
	}

	if len(models) == 0 {
		return nil, NewNotFoundError("model")
	}

	// Find model with largest context
	largest := models[0]
	for _, model := range models[1:] {
		if model.ContextLength > largest.ContextLength {
			largest = model
		}
	}

	return &largest, nil
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
