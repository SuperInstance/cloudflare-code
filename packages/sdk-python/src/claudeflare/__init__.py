"""
ClaudeFlare Python SDK

A comprehensive Python SDK for the ClaudeFlare distributed AI coding platform
"""

from claudeflare.client import ClaudeFlare
from claudeflare.resources import (
    Chat,
    Code,
    Agents,
    Models,
    Codebase,
)
from claudeflare.types import (
    Message,
    ChatCompletionParams,
    ChatCompletionResponse,
    CodeGenerationParams,
    CodeGenerationResponse,
    CodeAnalysisParams,
    CodeAnalysisResponse,
    AgentOrchestrationParams,
    AgentOrchestrationResponse,
    Model,
)
from claudeflare.exceptions import (
    ClaudeFlareError,
    ValidationError,
    AuthenticationError,
    RateLimitError,
    NotFoundError,
)

__version__ = "0.1.0"
__all__ = [
    # Client
    "ClaudeFlare",
    # Resources
    "Chat",
    "Code",
    "Agents",
    "Models",
    "Codebase",
    # Types
    "Message",
    "ChatCompletionParams",
    "ChatCompletionResponse",
    "CodeGenerationParams",
    "CodeGenerationResponse",
    "CodeAnalysisParams",
    "CodeAnalysisResponse",
    "AgentOrchestrationParams",
    "AgentOrchestrationResponse",
    "Model",
    # Exceptions
    "ClaudeFlareError",
    "ValidationError",
    "AuthenticationError",
    "RateLimitError",
    "NotFoundError",
]

# Default client instance
_default_client: ClaudeFlare | None = None


def from_env() -> ClaudeFlare:
    """
    Create a ClaudeFlare client from environment variables.

    Requires CLAUDEFLARE_API_KEY environment variable to be set.

    Returns:
        ClaudeFlare client instance

    Raises:
        ValidationError: If CLAUDEFLARE_API_KEY is not set
    """
    global _default_client

    if _default_client is None:
        import os

        api_key = os.environ.get("CLAUDEFLARE_API_KEY")
        if not api_key:
            from claudeflare.exceptions import ValidationError

            raise ValidationError("CLAUDEFLARE_API_KEY environment variable is not set")

        _default_client = ClaudeFlare(api_key=api_key)

    return _default_client
