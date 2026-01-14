"""
Type definitions for ClaudeFlare SDK
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


# ============================================================================
# Enums
# ============================================================================


class MessageRole(str, Enum):
    """Message role in chat completion."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class AIProvider(str, Enum):
    """AI provider."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GROQ = "groq"
    CEREBRAS = "cerebras"
    CLOUDFLARE = "cloudflare"


class FinishReason(str, Enum):
    """Reason for chat completion to finish."""

    STOP = "stop"
    LENGTH = "length"
    CONTENT_FILTER = "content_filter"
    TOOL_USE = "tool_use"


class AgentType(str, Enum):
    """Type of agent."""

    CHAT = "chat"
    CODE = "code"
    SEARCH = "search"
    ANALYSIS = "analysis"
    REVIEW = "review"


class AgentStatus(str, Enum):
    """Status of an agent."""

    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"


class CodeAnalysisType(str, Enum):
    """Type of code analysis."""

    SECURITY = "security"
    PERFORMANCE = "performance"
    QUALITY = "quality"
    COMPLEXITY = "complexity"
    DOCUMENTATION = "documentation"


# ============================================================================
# Data Models
# ============================================================================


@dataclass
class Message:
    """Chat message."""

    role: MessageRole
    content: str
    timestamp: float | None = None


@dataclass
class TokenUsage:
    """Token usage information."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

    @property
    def prompt_tokens(self) -> int:
        return self._prompt_tokens

    @property
    def completion_tokens(self) -> int:
        return self._completion_tokens

    @property
    def total_tokens(self) -> int:
        return self._total_tokens


@dataclass
class Tool:
    """Function/tool definition."""

    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class ToolCall:
    """Tool/function call."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class CodeStyle:
    """Code style preferences."""

    indent: str = "spaces"  # 'spaces' or 'tabs'
    indent_size: int = 2
    semicolons: bool = True
    quotes: str = "double"  # 'single' or 'double'
    trailing_commas: bool = True


# ============================================================================
# Request Models
# ============================================================================


@dataclass
class ChatCompletionParams:
    """Parameters for chat completion request."""

    messages: list[Message]
    model: str | None = None
    provider: AIProvider | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    stream: bool = False
    stop_sequences: list[str] | None = None
    top_k: int | None = None
    top_p: float | None = None
    session_id: str | None = None
    metadata: dict[str, Any] | None = None
    tools: list[Tool] | None = None
    tool_choice: str | None = None  # 'auto', 'any', 'none'


@dataclass
class CodeGenerationParams:
    """Parameters for code generation request."""

    prompt: str
    language: str
    framework: str | None = None
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    stream: bool = False
    context: list[str] | None = None
    style: CodeStyle | None = None


@dataclass
class CodeAnalysisParams:
    """Parameters for code analysis request."""

    code: str
    language: str
    analysis_type: CodeAnalysisType
    model: str | None = None


@dataclass
class AgentOrchestrationParams:
    """Parameters for agent orchestration request."""

    task: str
    agents: list[AgentType] | None = None
    auto_select: bool = False
    context: dict[str, Any] | None = None
    max_parallelism: int | None = None
    timeout: int | None = None


@dataclass
class CodebaseSearchParams:
    """Parameters for codebase search."""

    query: str
    top_k: int | None = None
    filters: dict[str, Any] | None = None
    include_snippets: bool = False


# ============================================================================
# Response Models
# ============================================================================


@dataclass
class ChatCompletionResponse:
    """Response from chat completion request."""

    id: str
    content: str
    model: str
    provider: AIProvider
    finish_reason: FinishReason
    usage: TokenUsage
    timestamp: float
    request_id: str | None = None
    tool_calls: list[ToolCall] | None = None


@dataclass
class ChatCompletionStreamEvent:
    """Event from chat completion stream."""

    type: str  # 'content', 'error', 'done'
    content: str | None = None
    error: dict[str, Any] | None = None
    done: bool = False
    usage: TokenUsage | None = None
    finish_reason: str | None = None


@dataclass
class CodeGenerationResponse:
    """Response from code generation request."""

    id: str
    code: str
    language: str
    framework: str | None = None
    explanation: str | None = None
    usage: TokenUsage | None = None
    timestamp: float = 0.0
    request_id: str | None = None


@dataclass
class CodeFinding:
    """Finding from code analysis."""

    type: str  # 'error', 'warning', 'info', 'suggestion'
    severity: str  # 'low', 'medium', 'high', 'critical'
    message: str
    location: dict[str, Any] | None = None
    suggestion: str | None = None


@dataclass
class CodeAnalysisResponse:
    """Response from code analysis request."""

    id: str
    analysis_type: CodeAnalysisType
    findings: list[CodeFinding]
    summary: str
    score: int
    timestamp: float
    request_id: str | None = None


@dataclass
class ModelCapabilities:
    """Model capabilities."""

    streaming: bool
    function_calling: bool
    vision: bool
    code_generation: bool
    analysis: bool


@dataclass
class ModelPricing:
    """Model pricing information."""

    input_cost_per_1k: float
    output_cost_per_1k: float


@dataclass
class Model:
    """Model information."""

    id: str
    name: str
    provider: AIProvider
    context_length: int
    description: str
    capabilities: ModelCapabilities
    pricing: ModelPricing | None = None


@dataclass
class Agent:
    """Agent information."""

    id: str
    name: str
    description: str
    type: AgentType
    status: AgentStatus
    capabilities: list[str]
    created_at: float


@dataclass
class AgentExecution:
    """Agent execution result."""

    agent: Agent
    status: str  # 'pending', 'running', 'completed', 'failed'
    result: Any | None = None
    error: str | None = None
    started_at: float | None = None
    completed_at: float | None = None


@dataclass
class AgentResult:
    """Result from agent orchestration."""

    output: str
    artifacts: list[dict[str, Any]] | None = None
    metrics: dict[str, Any] | None = None


@dataclass
class AgentOrchestrationResponse:
    """Response from agent orchestration request."""

    id: str
    status: str  # 'pending', 'running', 'completed', 'failed'
    result: AgentResult | None = None
    agents: list[AgentExecution] = field(default_factory=list)
    timestamp: float = 0.0
    request_id: str | None = None


@dataclass
class CodebaseFile:
    """File for codebase upload."""

    path: str
    content: str


@dataclass
class CodebaseUploadResponse:
    """Response from codebase upload."""

    id: str
    status: str  # 'processing', 'completed', 'failed'
    files_processed: int
    chunks_indexed: int
    timestamp: float


@dataclass
class CodebaseResult:
    """Result from codebase search."""

    chunk_id: str
    file: dict[str, str]  # {path, language}
    content: str
    score: float
    location: dict[str, int]  # {start_line, end_line}
    metadata: dict[str, Any] | None = None


@dataclass
class CodebaseSearchResponse:
    """Response from codebase search."""

    query: str
    results: list[CodebaseResult]
    total_results: int
    timestamp: float


@dataclass
class CodebaseStats:
    """Codebase statistics."""

    total_files: int
    total_chunks: int
    total_size: int
    languages: dict[str, int]
    last_indexed: float
