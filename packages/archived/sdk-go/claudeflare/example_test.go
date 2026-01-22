package claudeflare_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/claudeflare/sdk-go/claudeflare"
)

func ExampleClient() {
	// Create a new client
	client := claudeflare.NewClient("your-api-key")

	// Use the client
	response, err := client.Chat.Completions().Create(context.Background(), &claudeflare.ChatCompletionRequest{
		Messages: []claudeflare.Message{
			{Role: claudeflare.MessageRoleUser, Content: "Hello!"},
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(response.Content)
}

func ExampleClient_chatStreaming() {
	client := claudeflare.NewClient("your-api-key")

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
}

func ExampleClient_codeGeneration() {
	client := claudeflare.NewClient("your-api-key")

	response, err := client.Code.Generate.Generate(context.Background(), &claudeflare.CodeGenerationRequest{
		Prompt:   "Create a REST API for user management",
		Language: "typescript",
		Framework: "express",
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(response.Code)
	fmt.Println(response.Explanation)
}

func ExampleClient_codeAnalysis() {
	client := claudeflare.NewClient("your-api-key")

	code := `
function addUser(name, email) {
	const user = { name, email };
	database.save(user);
	return user;
}
	`

	analysis, err := client.Code.Analyze.Security(context.Background(), code, "javascript")
	if err != nil {
		panic(err)
	}

	fmt.Printf("Security Score: %d/100\n", analysis.Score)
	fmt.Printf("Summary: %s\n", analysis.Summary)

	for _, finding := range analysis.Findings {
		fmt.Printf("- [%s] %s\n", finding.Severity, finding.Message)
	}
}

func ExampleClient_agentOrchestration() {
	client := claudeflare.NewClient("your-api-key")

	response, err := client.Agents.Orchestrate.Create(context.Background(), &claudeflare.AgentOrchestrationRequest{
		Task: "Analyze this codebase and generate documentation",
		Agents: []claudeflare.AgentType{
			claudeflare.AgentTypeCode,
			claudeflare.AgentTypeAnalysis,
		},
		AutoSelect: true,
	})
	if err != nil {
		panic(err)
	}

	if response.Result != nil {
		fmt.Println(response.Result.Output)
	}
}

func ExampleClient_codebaseSearch() {
	client := claudeflare.NewClient("your-api-key")

	// Upload codebase
	_, err := client.Codebase.Upload.UploadRepository(
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
		fmt.Printf("%s:%d - Score: %.2f\n", result.File["path"], result.Location["start_line"], result.Score)
	}
}

func ExampleClient_models() {
	client := claudeflare.NewClient("your-api-key")

	// List all models
	models, err := client.Models.List(context.Background())
	if err != nil {
		panic(err)
	}

	for _, model := range models.Models {
		fmt.Printf("%s - %s\n", model.Name, model.Provider)
	}

	// Get cheapest model
	cheapest, err := client.Models.GetCheapest(context.Background(), claudeflare.AIProviderPtr(claudeflare.AIProviderAnthropic), nil)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Cheapest model: %s\n", cheapest.Name)
}

func TestExample(t *testing.T) {
	// This test is here to ensure the examples compile
	// Actual testing would require a mock server
	client := claudeflare.NewClient("test-api-key")
	if client == nil {
		t.Fatal("client is nil")
	}
}
