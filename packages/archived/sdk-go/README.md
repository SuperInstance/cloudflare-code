# claudeflare-go

> Go SDK for ClaudeFlare - Distributed AI coding platform

[![Go Reference](https://pkg.go.dev/badge/github.com/claudeflare/sdk-go.svg)](https://pkg.go.dev/github.com/claudeflare/sdk-go)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Idiomatic Go code with full context support
- Type-safe API with structs
- Chat completions with streaming via channels
- Code generation and analysis
- Multi-agent orchestration
- Codebase RAG (Retrieval Augmented Generation)
- Automatic retry with exponential backoff
- Comprehensive error handling
- Debug logging

## Installation

```bash
go get github.com/claudeflare/sdk-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "github.com/claudeflare/sdk-go/claudeflare"
)

func main() {
    client := claudeflare.NewClient("your-api-key")

    response, err := client.Chat.Completions().Create(
        context.Background(),
        &claudeflare.ChatCompletionRequest{
            Messages: []claudeflare.Message{
                {Role: claudeflare.MessageRoleUser, Content: "Hello!"},
            },
        },
    )

    if err != nil {
        panic(err)
    }

    fmt.Println(response.Content)
}
```

## Usage Examples

### Chat Completions

```go
response, err := client.Chat.Completions().Create(
    context.Background(),
    &claudeflare.ChatCompletionRequest{
        Messages: []claudeflare.Message{
            {Role: claudeflare.MessageRoleSystem, Content: "You are a helpful assistant."},
            {Role: claudeflare.MessageRoleUser, Content: "What is Cloudflare Workers?"},
        },
        Temperature: claudeflare.Float64Ptr(0.7),
        MaxTokens:   claudeflare.IntPtr(1000),
    },
)

if err != nil {
    panic(err)
}

fmt.Println(response.Content)
```

### Streaming

```go
eventChan, errChan := client.Chat.Completions().CreateStream(
    context.Background(),
    &claudeflare.ChatCompletionRequest{
        Messages: []claudeflare.Message{
            {Role: claudeflare.MessageRoleUser, Content: "Tell me a story"},
        },
        Stream: true,
    },
)

for {
    select {
    case event := <-eventChan:
        if event.Type == "done" {
            return
        }
        if event.Content != "" {
            fmt.Print(event.Content)
        }
    case err := <-errChan:
        if err != nil {
            panic(err)
        }
        return
    }
}
```

### Code Generation

```go
response, err := client.Code.Generate.Generate(
    context.Background(),
    &claudeflare.CodeGenerationRequest{
        Prompt:   "Create a REST API for user management",
        Language: "typescript",
        Framework: "express",
        Style: &claudeflare.CodeStyle{
            Indent:     "spaces",
            IndentSize: 2,
            Semicolons: true,
        },
    },
)

if err != nil {
    panic(err)
}

fmt.Println(response.Code)
fmt.Println(response.Explanation)
```

### Code Analysis

```go
// Security analysis
analysis, err := client.Code.Analyze.Security(
    context.Background(),
    code,
    "javascript",
)

if err != nil {
    panic(err)
}

fmt.Printf("Security Score: %d/100\n", analysis.Score)

for _, finding := range analysis.Findings {
    fmt.Printf("- [%s] %s\n", finding.Severity, finding.Message)
}

// Performance analysis
analysis, err := client.Code.Analyze.Performance(ctx, code, "javascript")

// Quality analysis
analysis, err := client.Code.Analyze.Quality(ctx, code, "python")

// Generate documentation
docs, err := client.Code.Analyze.Document(ctx, code, "typescript")
```

### Agent Orchestration

```go
response, err := client.Agents.Orchestrate.Create(
    context.Background(),
    &claudeflare.AgentOrchestrationRequest{
        Task: "Analyze this codebase and generate documentation",
        Agents: []claudeflare.AgentType{
            claudeflare.AgentTypeCode,
            claudeflare.AgentTypeAnalysis,
        },
        AutoSelect: true,
    },
)

if err != nil {
    panic(err)
}

if response.Result != nil {
    fmt.Println(response.Result.Output)
}
```

### Codebase RAG

```go
// Upload repository
upload, err := client.Codebase.Upload.UploadRepository(
    context.Background(),
    "https://github.com/user/repo",
    "main",
)

if err != nil {
    panic(err)
}

// Search codebase
results, err := client.Codebase.Search.Search(
    context.Background(),
    "How is authentication implemented?",
    claudeflare.IntPtr(5),
)

if err != nil {
    panic(err)
}

for _, result := range results.Results {
    fmt.Printf("%s:%d - Score: %.2f\n",
        result.File["path"],
        result.Location["start_line"],
        result.Score,
    )
}

// Get statistics
stats, err := client.Codebase.Management.GetStats(context.Background())
if err != nil {
    panic(err)
}

fmt.Printf("Total files: %d\n", stats.TotalFiles)
```

## Configuration

```go
client := claudeflare.NewClientWithConfig(claudeflare.Config{
    APIKey:     "your-api-key",
    BaseURL:    "https://api.claudeflare.com",
    APIVersion: "v1",
    Timeout:    60 * time.Second,
    MaxRetries: 3,
    Debug:      false,
})
```

## Error Handling

```go
response, err := client.Chat.Completions().Create(ctx, req)

if err != nil {
    switch e := err.(type) {
    case *claudeflare.AuthenticationError:
        fmt.Printf("Authentication failed: %s\n", e.Message)
    case *claudeflare.RateLimitError:
        fmt.Printf("Rate limit exceeded: %s\n", e.Message)
        fmt.Printf("Retry after: %d\n", e.RetryAfter)
    case *claudeflare.ValidationError:
        fmt.Printf("Validation error: %s\n", e.Message)
    case *claudeflare.NotFoundError:
        fmt.Printf("Resource not found: %s\n", e.Message)
    default:
        panic(err)
    }
}
```

## Context Support

All API methods accept a `context.Context` parameter for cancellation and timeout control:

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

response, err := client.Chat.Completions().Create(ctx, req)
```

## Helper Functions

```go
// Create pointers from values
temperature := claudeflare.Float64Ptr(0.7)
maxTokens := claudeflare.IntPtr(1000)

// Create helper functions
topK := claudeflare.IntPtr(5)
```

## License

MIT

## Support

- Documentation: https://docs.claudeflare.com/go
- GitHub: https://github.com/claudeflare/sdk-go
