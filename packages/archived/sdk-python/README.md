# claudeflare

> Python SDK for ClaudeFlare - Distributed AI coding platform

[![PyPI version](https://badge.fury.io/py/claudeflare.svg)](https://pypi.org/project/claudeflare/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Full async/await support
- Type hints for better IDE support
- Chat completions with streaming
- Code generation and analysis
- Multi-agent orchestration
- Codebase RAG (Retrieval Augmented Generation)
- Automatic retry with exponential backoff
- Comprehensive error handling
- Debug logging

## Installation

```bash
pip install claudeflare
```

## Quick Start

```python
import asyncio
from claudeflare import ClaudeFlare, Message

async def main():
    client = ClaudeFlare(api_key="your-api-key")

    response = await client.chat.completions.create(
        messages=[Message(role="user", content="Hello!")]
    )

    print(response.content)

asyncio.run(main())
```

## Usage Examples

### Chat Completions

```python
from claudeflare import ClaudeFlare, Message

client = ClaudeFlare(api_key="your-api-key")

# Simple completion
response = await client.chat.completions.create(
    messages=[
        Message(role="system", content="You are a helpful assistant."),
        Message(role="user", content="What is Cloudflare Workers?")
    ],
    temperature=0.7,
    max_tokens=1000,
)

print(response.content)
```

### Streaming

```python
# Callback-based streaming
await client.chat.completions.create_stream(
    messages=[Message(role="user", content="Tell me a story")],
    stream=True,
    callback=lambda event: print(event.content, end="", flush=True)
)

# Async iterator
async for event in client.chat.completions.create_stream(
    messages=[Message(role="user", content="Explain AI")],
    stream=True,
):
    if event.content:
        print(event.content, end="", flush=True)
```

### Code Generation

```python
from claudeflare import CodeStyle

result = await client.code.generate.generate(
    prompt="Create a REST API for user management",
    language="typescript",
    framework="express",
    style=CodeStyle(
        indent="spaces",
        indent_size=2,
        semicolons=True,
    ),
)

print(result.code)
print(result.explanation)
```

### Code Analysis

```python
# Security analysis
analysis = await client.code.analyze.security(code, "typescript")
print(f"Security Score: {analysis.score}/100")

# Performance analysis
analysis = await client.code.analyze.performance(code, "javascript")

# Quality analysis
analysis = await client.code.analyze.quality(code, "python")

# Generate documentation
docs = await client.code.analyze.document(code, "typescript")
```

### Agent Orchestration

```python
from claudeflare import AgentType

# Orchestrate agents
result = await client.agents.orchestrate.create(
    task="Analyze this codebase and generate documentation",
    agents=[AgentType.CODE, AgentType.ANALYSIS],
    auto_select=True,
)

print(result.result.output)

# Streaming updates
async for update in client.agents.orchestrate.create_stream(
    task="Review and refactor this code",
    agents=[AgentType.CODE, AgentType.REVIEW],
):
    print(f"Status: {update.status}")
```

### Codebase RAG

```python
# Upload repository
upload = await client.codebase.upload.create(
    repository_url="https://github.com/user/repo",
    branch="main",
)

# Search codebase
results = await client.codebase.search.query(
    query="How is authentication implemented?",
    top_k=5,
    filters={"language": "typescript"},
)

for result in results.results:
    print(f"{result.file['path']}:{result.location['start_line']}")
    print(result.content)

# Get statistics
stats = await client.codebase.management.get_stats()
print(f"Total files: {stats.total_files}")
```

## Configuration

```python
client = ClaudeFlare(
    api_key="your-api-key",
    base_url="https://api.claudeflare.com",
    api_version="v1",
    timeout=60.0,
    max_retries=3,
    debug=False,
)
```

## Error Handling

```python
from claudeflare import (
    ValidationError,
    AuthenticationError,
    RateLimitError,
    NotFoundError,
)

try:
    response = await client.chat.completions.create(...)
except AuthenticationError as e:
    print(f"Authentication failed: {e.message}")
except RateLimitError as e:
    print(f"Rate limit exceeded: {e.message}")
    print(f"Retry after: {e.retry_after}")
except ValidationError as e:
    print(f"Validation error: {e.message}")
```

## Environment Variables

```python
# Load from environment
from claudeflare import from_env

client = from_env()  # Requires CLAUDEFLARE_API_KEY environment variable
```

## License

MIT

## Support

- Documentation: https://docs.claudeflare.com/python
- GitHub: https://github.com/claudeflare/sdk-python
