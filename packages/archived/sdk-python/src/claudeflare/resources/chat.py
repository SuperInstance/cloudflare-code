"""
Chat completions API
"""

import logging
from typing import Any, AsyncIterator

from claudeflare.types import (
    Message,
    ChatCompletionParams,
    ChatCompletionResponse,
    ChatCompletionStreamEvent,
    TokenUsage,
    AIProvider,
    FinishReason,
)
from claudeflare.client import ClaudeFlare
from claudeflare.exceptions import error_from_response

logger = logging.getLogger("claudeflare")


class ChatCompletions:
    """Chat completions resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def create(self, params: ChatCompletionParams) -> ChatCompletionResponse:
        """
        Create a chat completion.

        Args:
            params: Completion parameters

        Returns:
            Chat completion response

        Raises:
            ClaudeFlareError: On API errors
        """
        endpoint = "chat/stream" if params.stream else "chat"

        # Build request body
        body = {
            "messages": [
                {
                    "role": msg.role.value,
                    "content": msg.content,
                    "timestamp": msg.timestamp,
                }
                for msg in params.messages
            ],
            "model": params.model,
            "provider": params.provider.value if params.provider else None,
            "temperature": params.temperature,
            "max_tokens": params.max_tokens,
            "stream": params.stream,
            "stop_sequences": params.stop_sequences,
            "top_k": params.top_k,
            "top_p": params.top_p,
            "session_id": params.session_id,
            "metadata": params.metadata,
            "tools": [
                {"name": tool.name, "description": tool.description, "input_schema": tool.input_schema}
                for tool in params.tools or []
            ]
            or None,
            "tool_choice": params.tool_choice,
        }

        # Remove None values
        body = {k: v for k, v in body.items() if v is not None}

        logger.debug(f"Creating chat completion: {endpoint}")

        response = await self.client.post(endpoint, json_data=body)

        if params.stream:
            # Accumulate stream
            content = ""
            usage = None
            finish_reason = None

            async for chunk in self._stream_chunks(response):
                if chunk.get("content"):
                    content += chunk["content"]
                if chunk.get("usage"):
                    usage = TokenUsage(**chunk["usage"])
                if chunk.get("finish_reason"):
                    finish_reason = chunk["finish_reason"]

            return ChatCompletionResponse(
                id=f"chat_{int(__import__('time').time() * 1000)}",
                content=content,
                model=params.model or "claude-3-5-sonnet-20241022",
                provider=params.provider or AIProvider.ANTHROPIC,
                finish_reason=FinishReason(finish_reason or "stop"),
                usage=usage or TokenUsage(0, 0, 0),
                timestamp=__import__("time").time(),
            )

        # Non-streaming response
        if not response.is_error:
            data = response.json()
            return ChatCompletionResponse(**data)

        error = error_from_response(response.status_code, response.json())
        raise error

    async def create_stream(
        self, params: ChatCompletionParams
    ) -> AsyncIterator[ChatCompletionStreamEvent]:
        """
        Create a streaming chat completion.

        Args:
            params: Completion parameters

        Yields:
            Stream events

        Raises:
            ClaudeFlareError: On API errors
        """
        params.stream = True

        endpoint = "chat/stream"
        body = {
            "messages": [
                {"role": msg.role.value, "content": msg.content, "timestamp": msg.timestamp}
                for msg in params.messages
            ],
            "model": params.model,
            "provider": params.provider.value if params.provider else None,
            "temperature": params.temperature,
            "max_tokens": params.max_tokens,
            "stream": True,
        }

        body = {k: v for k, v in body.items() if v is not None}

        logger.debug(f"Creating streaming chat completion: {endpoint}")

        response = await self.client.post(endpoint, json_data=body)

        if response.is_error:
            error = error_from_response(response.status_code, response.json())
            raise error

        async for chunk in self._stream_chunks(response):
            yield ChatCompletionStreamEvent(**chunk)

    async def _stream_chunks(self, response) -> AsyncIterator[dict[str, Any]]:
        """Parse SSE stream and yield chunks."""
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue

            data = line[6:]  # Remove 'data: ' prefix

            if data == "[DONE]":
                yield {"type": "done", "done": True}
                break

            try:
                import json

                chunk = json.loads(data)
                yield chunk
            except json.JSONDecodeError:
                logger.debug(f"Failed to parse chunk: {data}")


class Chat:
    """Chat API namespace."""

    def __init__(self, completions: ChatCompletions):
        self.completions = completions
