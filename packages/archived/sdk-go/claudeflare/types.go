package claudeflare

import "time"

// MessageRole represents the role of a message
type MessageRole string

const (
	MessageRoleSystem    MessageRole = "system"
	MessageRoleUser      MessageRole = "user"
	MessageRoleAssistant MessageRole = "assistant"
)

// Message represents a chat message
type Message struct {
	Role      MessageRole `json:"role"`
	Content   string      `json:"content"`
	Timestamp *float64    `json:"timestamp,omitempty"`
}

// AIProvider represents an AI provider
type AIProvider string

const (
	AIProviderAnthropic  AIProvider = "anthropic"
	AIProviderOpenAI     AIProvider = "openai"
	AIProviderGroq       AIProvider = "groq"
	AIProviderCerebras   AIProvider = "cerebras"
	AIProviderCloudflare AIProvider = "cloudflare"
)

// FinishReason represents the reason a completion finished
type FinishReason string

const (
	FinishReasonStop          FinishReason = "stop"
	FinishReasonLength        FinishReason = "length"
	FinishReasonContentFilter FinishReason = "content_filter"
	FinishReasonToolUse       FinishReason = "tool_use"
)

// TokenUsage represents token usage information
type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Tool represents a function/tool
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

// ToolCall represents a tool/function call
type ToolCall struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// ChatCompletionRequest represents a chat completion request
type ChatCompletionRequest struct {
	Messages       []Message              `json:"messages"`
	Model          string                 `json:"model,omitempty"`
	Provider       AIProvider             `json:"provider,omitempty"`
	Temperature    *float64               `json:"temperature,omitempty"`
	MaxTokens      *int                   `json:"max_tokens,omitempty"`
	Stream         bool                   `json:"stream,omitempty"`
	StopSequences  []string               `json:"stop_sequences,omitempty"`
	TopK           *int                   `json:"top_k,omitempty"`
	TopP           *float64               `json:"top_p,omitempty"`
	SessionID      string                 `json:"session_id,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	Tools          []Tool                 `json:"tools,omitempty"`
	ToolChoice     string                 `json:"tool_choice,omitempty"`
}

// ChatCompletionResponse represents a chat completion response
type ChatCompletionResponse struct {
	ID          string       `json:"id"`
	Content     string       `json:"content"`
	Model       string       `json:"model"`
	Provider    AIProvider   `json:"provider"`
	FinishReason FinishReason `json:"finish_reason"`
	Usage       TokenUsage   `json:"usage"`
	Timestamp   float64      `json:"timestamp"`
	RequestID   string       `json:"request_id,omitempty"`
	ToolCalls   []ToolCall   `json:"tool_calls,omitempty"`
}

// CodeStyle represents code style preferences
type CodeStyle struct {
	Indent         string `json:"indent,omitempty"`
	IndentSize     int    `json:"indent_size,omitempty"`
	Semicolons     bool   `json:"semicolons,omitempty"`
	Quotes         string `json:"quotes,omitempty"`
	TrailingCommas bool   `json:"trailing_commas,omitempty"`
}

// CodeGenerationRequest represents a code generation request
type CodeGenerationRequest struct {
	Prompt      string     `json:"prompt"`
	Language    string     `json:"language"`
	Framework   string     `json:"framework,omitempty"`
	Model       string     `json:"model,omitempty"`
	Temperature *float64   `json:"temperature,omitempty"`
	MaxTokens   *int       `json:"max_tokens,omitempty"`
	Stream      bool       `json:"stream,omitempty"`
	Context     []string   `json:"context,omitempty"`
	Style       *CodeStyle `json:"style,omitempty"`
}

// CodeGenerationResponse represents a code generation response
type CodeGenerationResponse struct {
	ID          string      `json:"id"`
	Code        string      `json:"code"`
	Language    string      `json:"language"`
	Framework   string      `json:"framework,omitempty"`
	Explanation string      `json:"explanation,omitempty"`
	Usage       *TokenUsage `json:"usage,omitempty"`
	Timestamp   float64     `json:"timestamp"`
	RequestID   string      `json:"request_id,omitempty"`
}

// CodeAnalysisType represents the type of code analysis
type CodeAnalysisType string

const (
	CodeAnalysisTypeSecurity      CodeAnalysisType = "security"
	CodeAnalysisTypePerformance   CodeAnalysisType = "performance"
	CodeAnalysisTypeQuality       CodeAnalysisType = "quality"
	CodeAnalysisTypeComplexity    CodeAnalysisType = "complexity"
	CodeAnalysisTypeDocumentation CodeAnalysisType = "documentation"
)

// CodeAnalysisRequest represents a code analysis request
type CodeAnalysisRequest struct {
	Code         string           `json:"code"`
	Language     string           `json:"language"`
	AnalysisType CodeAnalysisType `json:"analysis_type"`
	Model        string           `json:"model,omitempty"`
}

// CodeFinding represents a finding from code analysis
type CodeFinding struct {
	Type      string                 `json:"type"`
	Severity  string                 `json:"severity"`
	Message   string                 `json:"message"`
	Location  map[string]interface{} `json:"location,omitempty"`
	Suggestion string                `json:"suggestion,omitempty"`
}

// CodeAnalysisResponse represents a code analysis response
type CodeAnalysisResponse struct {
	ID          string          `json:"id"`
	AnalysisType CodeAnalysisType `json:"analysis_type"`
	Findings    []CodeFinding   `json:"findings"`
	Summary     string          `json:"summary"`
	Score       int             `json:"score"`
	Timestamp   float64         `json:"timestamp"`
	RequestID   string          `json:"request_id,omitempty"`
}

// AgentType represents the type of agent
type AgentType string

const (
	AgentTypeChat     AgentType = "chat"
	AgentTypeCode     AgentType = "code"
	AgentTypeSearch   AgentType = "search"
	AgentTypeAnalysis AgentType = "analysis"
	AgentTypeReview   AgentType = "review"
)

// AgentStatus represents the status of an agent
type AgentStatus string

const (
	AgentStatusIdle    AgentStatus = "idle"
	AgentStatusBusy    AgentStatus = "busy"
	AgentStatusOffline AgentStatus = "offline"
)

// Agent represents an agent
type Agent struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Type        AgentType   `json:"type"`
	Status      AgentStatus `json:"status"`
	Capabilities []string   `json:"capabilities"`
	CreatedAt   float64     `json:"created_at"`
}

// AgentOrchestrationRequest represents an agent orchestration request
type AgentOrchestrationRequest struct {
	Task           string                 `json:"task"`
	Agents         []AgentType            `json:"agents,omitempty"`
	AutoSelect     bool                   `json:"auto_select,omitempty"`
	Context        map[string]interface{} `json:"context,omitempty"`
	MaxParallelism *int                   `json:"max_parallelism,omitempty"`
	Timeout        *int                   `json:"timeout,omitempty"`
}

// AgentExecution represents an agent execution
type AgentExecution struct {
	Agent       Agent                   `json:"agent"`
	Status      string                  `json:"status"`
	Result      map[string]interface{}  `json:"result,omitempty"`
	Error       string                  `json:"error,omitempty"`
	StartedAt   *float64                `json:"started_at,omitempty"`
	CompletedAt *float64                `json:"completed_at,omitempty"`
}

// AgentResult represents the result from agent orchestration
type AgentResult struct {
	Output    string                 `json:"output"`
	Artifacts []map[string]interface{} `json:"artifacts,omitempty"`
	Metrics   map[string]interface{}  `json:"metrics,omitempty"`
}

// AgentOrchestrationResponse represents an agent orchestration response
type AgentOrchestrationResponse struct {
	ID        string             `json:"id"`
	Status    string             `json:"status"`
	Result    *AgentResult       `json:"result,omitempty"`
	Agents    []AgentExecution   `json:"agents"`
	Timestamp float64            `json:"timestamp"`
	RequestID string             `json:"request_id,omitempty"`
}

// ModelCapabilities represents model capabilities
type ModelCapabilities struct {
	Streaming       bool `json:"streaming"`
	FunctionCalling bool `json:"function_calling"`
	Vision          bool `json:"vision"`
	CodeGeneration  bool `json:"code_generation"`
	Analysis        bool `json:"analysis"`
}

// ModelPricing represents model pricing
type ModelPricing struct {
	InputCostPer1K  float64 `json:"input_cost_per_1k"`
	OutputCostPer1K float64 `json:"output_cost_per_1k"`
}

// Model represents a model
type Model struct {
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	Provider      AIProvider         `json:"provider"`
	ContextLength int                `json:"context_length"`
	Description   string             `json:"description"`
	Capabilities  ModelCapabilities  `json:"capabilities"`
	Pricing       *ModelPricing      `json:"pricing,omitempty"`
}

// ModelsListResponse represents a list of models
type ModelsListResponse struct {
	Models    []Model `json:"models"`
	Count     int     `json:"count"`
	Timestamp float64 `json:"timestamp"`
}

// CodebaseFile represents a file for codebase upload
type CodebaseFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// CodebaseUploadRequest represents a codebase upload request
type CodebaseUploadRequest struct {
	RepositoryURL   string          `json:"repository_url,omitempty"`
	Branch          string          `json:"branch,omitempty"`
	Files           []CodebaseFile  `json:"files,omitempty"`
	IncludePatterns []string        `json:"include_patterns,omitempty"`
	ExcludePatterns []string        `json:"exclude_patterns,omitempty"`
	MaxFileSize     int             `json:"max_file_size,omitempty"`
}

// CodebaseUploadResponse represents a codebase upload response
type CodebaseUploadResponse struct {
	ID              string  `json:"id"`
	Status          string  `json:"status"`
	FilesProcessed  int     `json:"files_processed"`
	ChunksIndexed   int     `json:"chunks_indexed"`
	Timestamp       float64 `json:"timestamp"`
}

// CodebaseSearchRequest represents a codebase search request
type CodebaseSearchRequest struct {
	Query           string                 `json:"query"`
	TopK            *int                   `json:"top_k,omitempty"`
	Filters         map[string]interface{} `json:"filters,omitempty"`
	IncludeSnippets bool                   `json:"include_snippets,omitempty"`
}

// CodebaseResult represents a result from codebase search
type CodebaseResult struct {
	ChunkID  string                 `json:"chunk_id"`
	File     map[string]string      `json:"file"`
	Content  string                 `json:"content"`
	Score    float64                `json:"score"`
	Location map[string]int         `json:"location"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// CodebaseSearchResponse represents a codebase search response
type CodebaseSearchResponse struct {
	Query        string            `json:"query"`
	Results      []CodebaseResult  `json:"results"`
	TotalResults int               `json:"total_results"`
	Timestamp    float64           `json:"timestamp"`
}

// CodebaseStats represents codebase statistics
type CodebaseStats struct {
	TotalFiles  int               `json:"total_files"`
	TotalChunks int               `json:"total_chunks"`
	TotalSize   int               `json:"total_size"`
	Languages   map[string]int    `json:"languages"`
	LastIndexed float64           `json:"last_indexed"`
}
