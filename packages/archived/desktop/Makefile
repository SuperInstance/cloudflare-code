.PHONY: build dev test clean install

# Build targets
BINARY_NAME=claudeflare-desktop
BUILD_DIR=../../bin
GO=go

build:
	$(GO) build -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/desktop

dev:
	$(GO) run ./cmd/desktop/main.go

test:
	$(GO) test -v ./...

test-coverage:
	$(GO) test -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html

clean:
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html

install:
	$(GO) install ./cmd/desktop

# WASM targets
wasm:
	GOOS=js GOARCH=wasm $(GO) build -o $(BUILD_DIR)/desktop.wasm ./cmd/desktop

deps:
	$(GO) mod download
	$(GO) mod tidy

lint:
	golangci-lint run

fmt:
	gofmt -w .
	goimports -w .
