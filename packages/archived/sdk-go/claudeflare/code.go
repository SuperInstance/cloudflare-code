package claudeflare

import (
	"context"
	"fmt"
)

// CodeService provides code generation and analysis operations
type CodeService struct {
	client *Client

	Generate *CodeGenerationService
	Analyze  *CodeAnalysisService
}

// NewCodeService creates a new code service
func NewCodeService(client *Client) *CodeService {
	s := &CodeService{client: client}
	s.Generate = &CodeGenerationService{service: s}
	s.Analyze = &CodeAnalysisService{service: s}
	return s
}

// CodeGenerationService provides code generation operations
type CodeGenerationService struct {
	service *CodeService
}

// Generate generates code from a prompt
func (s *CodeGenerationService) Generate(ctx context.Context, req *CodeGenerationRequest) (*CodeGenerationResponse, error) {
	var resp CodeGenerationResponse
	err := s.service.client.doRequest(ctx, "POST", "code/generate", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to generate code: %w", err)
	}

	return &resp, nil
}

// GenerateStream generates code with streaming
func (s *CodeGenerationService) GenerateStream(ctx context.Context, req *CodeGenerationRequest) (<-chan string, <-chan error) {
	chunkChan := make(chan string, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		req.Stream = true
		resp, err := s.service.client.doRequestRaw(ctx, "POST", "code/generate", req)
		if err != nil {
			errChan <- fmt.Errorf("failed to generate code stream: %w", err)
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

			if event.Content != "" {
				select {
				case chunkChan <- event.Content:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return chunkChan, errChan
}

// CodeAnalysisService provides code analysis operations
type CodeAnalysisService struct {
	service *CodeService
}

// Analyze analyzes code
func (s *CodeAnalysisService) Analyze(ctx context.Context, req *CodeAnalysisRequest) (*CodeAnalysisResponse, error) {
	var resp CodeAnalysisResponse
	err := s.service.client.doRequest(ctx, "POST", "code/analyze", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze code: %w", err)
	}

	return &resp, nil
}

// Security performs security analysis
func (s *CodeAnalysisService) Security(ctx context.Context, code, language string) (*CodeAnalysisResponse, error) {
	return s.Analyze(ctx, &CodeAnalysisRequest{
		Code:         code,
		Language:     language,
		AnalysisType: CodeAnalysisTypeSecurity,
	})
}

// Performance performs performance analysis
func (s *CodeAnalysisService) Performance(ctx context.Context, code, language string) (*CodeAnalysisResponse, error) {
	return s.Analyze(ctx, &CodeAnalysisRequest{
		Code:         code,
		Language:     language,
		AnalysisType: CodeAnalysisTypePerformance,
	})
}

// Quality performs quality analysis
func (s *CodeAnalysisService) Quality(ctx context.Context, code, language string) (*CodeAnalysisResponse, error) {
	return s.Analyze(ctx, &CodeAnalysisRequest{
		Code:         code,
		Language:     language,
		AnalysisType: CodeAnalysisTypeQuality,
	})
}

// Complexity performs complexity analysis
func (s *CodeAnalysisService) Complexity(ctx context.Context, code, language string) (*CodeAnalysisResponse, error) {
	return s.Analyze(ctx, &CodeAnalysisRequest{
		Code:         code,
		Language:     language,
		AnalysisType: CodeAnalysisTypeComplexity,
	})
}

// Document generates documentation
func (s *CodeAnalysisService) Document(ctx context.Context, code, language string) (*CodeAnalysisResponse, error) {
	return s.Analyze(ctx, &CodeAnalysisRequest{
		Code:         code,
		Language:     language,
		AnalysisType: CodeAnalysisTypeDocumentation,
	})
}
