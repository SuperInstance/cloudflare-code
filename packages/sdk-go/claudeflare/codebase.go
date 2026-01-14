package claudeflare

import (
	"context"
	"fmt"
	"mime/multipart"
)

// CodebaseService provides codebase RAG operations
type CodebaseService struct {
	client *Client

	Upload     *CodebaseUploadService
	Search     *CodebaseSearchService
	Management *CodebaseManagementService
}

// NewCodebaseService creates a new codebase service
func NewCodebaseService(client *Client) *CodebaseService {
	s := &CodebaseService{client: client}
	s.Upload = &CodebaseUploadService{service: s}
	s.Search = &CodebaseSearchService{service: s}
	s.Management = &CodebaseManagementService{service: s}
	return s
}

// CodebaseUploadService provides codebase upload operations
type CodebaseUploadService struct {
	service *CodebaseService
}

// Create uploads codebase for indexing
func (s *CodebaseUploadService) Create(ctx context.Context, req *CodebaseUploadRequest) (*CodebaseUploadResponse, error) {
	// Build multipart form data
	body, contentType, err := createMultipartFormData(req)
	if err != nil {
		return nil, fmt.Errorf("failed to create multipart form: %w", err)
	}

	resp, err := s.service.client.doRequestRawWithContentType(ctx, "POST", "codebase/upload", body, contentType)
	if err != nil {
		return nil, fmt.Errorf("failed to upload codebase: %w", err)
	}
	defer resp.Body.Close()

	var uploadResp CodebaseUploadResponse
	if err := decodeJSON(resp.Body, &uploadResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &uploadResp, nil
}

// UploadFiles uploads files directly
func (s *CodebaseUploadService) UploadFiles(ctx context.Context, files []CodebaseFile) (*CodebaseUploadResponse, error) {
	return s.Create(ctx, &CodebaseUploadRequest{
		Files: files,
	})
}

// UploadRepository uploads repository from URL
func (s *CodebaseUploadService) UploadRepository(ctx context.Context, repositoryURL, branch string) (*CodebaseUploadResponse, error) {
	return s.Create(ctx, &CodebaseUploadRequest{
		RepositoryURL: repositoryURL,
		Branch:        branch,
	})
}

// CodebaseSearchService provides codebase search operations
type CodebaseSearchService struct {
	service *CodebaseService
}

// Query searches codebase
func (s *CodebaseSearchService) Query(ctx context.Context, req *CodebaseSearchRequest) (*CodebaseSearchResponse, error) {
	var resp CodebaseSearchResponse
	err := s.service.client.doRequest(ctx, "POST", "codebase/search", req, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to search codebase: %w", err)
	}

	return &resp, nil
}

// Search performs simple search
func (s *CodebaseSearchService) Search(ctx context.Context, query string, topK *int) (*CodebaseSearchResponse, error) {
	return s.Query(ctx, &CodebaseSearchRequest{
		Query: query,
		TopK:  topK,
	})
}

// SearchByPath searches by file path
func (s *CodebaseSearchService) SearchByPath(ctx context.Context, path, query string, topK *int) (*CodebaseSearchResponse, error) {
	return s.Query(ctx, &CodebaseSearchRequest{
		Query: query,
		TopK:  topK,
		Filters: map[string]interface{}{
			"path": path,
		},
	})
}

// SearchByLanguage searches by language
func (s *CodebaseSearchService) SearchByLanguage(ctx context.Context, language, query string, topK *int) (*CodebaseSearchResponse, error) {
	return s.Query(ctx, &CodebaseSearchRequest{
		Query: query,
		TopK:  topK,
		Filters: map[string]interface{}{
			"language": language,
		},
	})
}

// CodebaseManagementService provides codebase management operations
type CodebaseManagementService struct {
	service *CodebaseService
}

// GetStats gets codebase statistics
func (s *CodebaseManagementService) GetStats(ctx context.Context) (*CodebaseStats, error) {
	var stats CodebaseStats
	err := s.service.client.doRequest(ctx, "GET", "codebase/stats", nil, &stats)
	if err != nil {
		return nil, fmt.Errorf("failed to get codebase stats: %w", err)
	}

	return &stats, nil
}

// GetFile gets a specific file
func (s *CodebaseManagementService) GetFile(ctx context.Context, path string) (map[string]interface{}, error) {
	var file map[string]interface{}
	err := s.service.client.doRequest(ctx, "GET", "codebase/file?path="+path, nil, &file)
	if err != nil {
		return nil, fmt.Errorf("failed to get file: %w", err)
	}

	return file, nil
}

// Clear clears codebase index
func (s *CodebaseManagementService) Clear(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := s.service.client.doRequest(ctx, "DELETE", "codebase", nil, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to clear codebase: %w", err)
	}

	return result, nil
}

// Reindex reindexes codebase
func (s *CodebaseManagementService) Reindex(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := s.service.client.doRequest(ctx, "POST", "codebase/reindex", nil, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to reindex codebase: %w", err)
	}

	return result, nil
}

// BatchUpload uploads files in batches
func (s *CodebaseManagementService) BatchUpload(ctx context.Context, files []CodebaseFile, batchSize int) ([]*CodebaseUploadResponse, error) {
	var results []*CodebaseUploadResponse

	for i := 0; i < len(files); i += batchSize {
		end := i + batchSize
		if end > len(files) {
			end = len(files)
		}

		batch := files[i:end]
		resp, err := s.service.client.codebase.Upload.Create(ctx, &CodebaseUploadRequest{
			Files: batch,
		})
		if err != nil {
			return results, err
		}

		results = append(results, resp)
	}

	return results, nil
}

// createMultipartFormData creates multipart form data for upload
func createMultipartFormData(req *CodebaseUploadRequest) (string, string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add repository URL
	if req.RepositoryURL != "" {
		if err := writer.WriteField("repository_url", req.RepositoryURL); err != nil {
			return "", "", err
		}
	}

	// Add branch
	if req.Branch != "" {
		if err := writer.WriteField("branch", req.Branch); err != nil {
			return "", "", err
		}
	}

	// Add include patterns
	for i, pattern := range req.IncludePatterns {
		field := fmt.Sprintf("include_patterns[%d]", i)
		if err := writer.WriteField(field, pattern); err != nil {
			return "", "", err
		}
	}

	// Add exclude patterns
	for i, pattern := range req.ExcludePatterns {
		field := fmt.Sprintf("exclude_patterns[%d]", i)
		if err := writer.WriteField(field, pattern); err != nil {
			return "", "", err
		}
	}

	// Add max file size
	if req.MaxFileSize > 0 {
		if err := writer.WriteField("max_file_size", fmt.Sprintf("%d", req.MaxFileSize)); err != nil {
			return "", "", err
		}
	}

	// Add files
	for i, file := range req.Files {
		// File path
		pathField := fmt.Sprintf("files[%d][path]", i)
		if err := writer.WriteField(pathField, file.Path); err != nil {
			return "", "", err
		}

		// File content
		contentField := fmt.Sprintf("files[%d][content]", i)
		if err := writer.WriteField(contentField, file.Content); err != nil {
			return "", "", err
		}
	}

	// Close writer to finalize form data
	if err := writer.Close(); err != nil {
		return "", "", err
	}

	return body.String(), writer.FormDataContentType(), nil
}
