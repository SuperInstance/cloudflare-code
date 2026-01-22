"""
Code generation and analysis API
"""

import logging
from typing import Any

from claudeflare.types import (
    CodeGenerationParams,
    CodeGenerationResponse,
    CodeAnalysisParams,
    CodeAnalysisResponse,
    CodeAnalysisType,
    TokenUsage,
)
from claudeflare.client import ClaudeFlare
from claudeflare.exceptions import error_from_response

logger = logging.getLogger("claudeflare")


class CodeGeneration:
    """Code generation resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def generate(self, params: CodeGenerationParams) -> CodeGenerationResponse:
        """
        Generate code from a prompt.

        Args:
            params: Generation parameters

        Returns:
            Code generation response
        """
        endpoint = "code/generate"
        body = {
            "prompt": params.prompt,
            "language": params.language,
            "framework": params.framework,
            "model": params.model,
            "temperature": params.temperature,
            "max_tokens": params.max_tokens,
            "stream": params.stream,
            "context": params.context,
            "style": (
                {
                    "indent": params.style.indent,
                    "indent_size": params.style.indent_size,
                    "semicolons": params.style.semicolons,
                    "quotes": params.style.quotes,
                    "trailing_commas": params.style.trailing_commas,
                }
                if params.style
                else None
            ),
        }

        body = {k: v for k, v in body.items() if v is not None}

        logger.debug(f"Generating code: {endpoint}")

        response = await self.client.post(endpoint, json_data=body)

        if not response.is_error:
            data = response.json()
            return CodeGenerationResponse(**data)

        error = error_from_response(response.status_code, response.json())
        raise error


class CodeAnalysis:
    """Code analysis resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def analyze(self, params: CodeAnalysisParams) -> CodeAnalysisResponse:
        """
        Analyze code.

        Args:
            params: Analysis parameters

        Returns:
            Code analysis response
        """
        endpoint = "code/analyze"
        body = {
            "code": params.code,
            "language": params.language,
            "analysis_type": params.analysis_type.value,
            "model": params.model,
        }

        body = {k: v for k, v in body.items() if v is not None}

        logger.debug(f"Analyzing code: {endpoint}")

        response = await self.client.post(endpoint, json_data=body)

        if not response.is_error:
            data = response.json()
            return CodeAnalysisResponse(**data)

        error = error_from_response(response.status_code, response.json())
        raise error

    async def security(self, code: str, language: str) -> CodeAnalysisResponse:
        """Perform security analysis."""
        return await self.analyze(
            CodeAnalysisParams(
                code=code,
                language=language,
                analysis_type=CodeAnalysisType.SECURITY,
            )
        )

    async def performance(self, code: str, language: str) -> CodeAnalysisResponse:
        """Perform performance analysis."""
        return await self.analyze(
            CodeAnalysisParams(
                code=code,
                language=language,
                analysis_type=CodeAnalysisType.PERFORMANCE,
            )
        )

    async def quality(self, code: str, language: str) -> CodeAnalysisResponse:
        """Perform quality analysis."""
        return await self.analyze(
            CodeAnalysisParams(
                code=code,
                language=language,
                analysis_type=CodeAnalysisType.QUALITY,
            )
        )

    async def complexity(self, code: str, language: str) -> CodeAnalysisResponse:
        """Perform complexity analysis."""
        return await self.analyze(
            CodeAnalysisParams(
                code=code,
                language=language,
                analysis_type=CodeAnalysisType.COMPLEXITY,
            )
        )

    async def document(self, code: str, language: str) -> CodeAnalysisResponse:
        """Generate documentation."""
        return await self.analyze(
            CodeAnalysisParams(
                code=code,
                language=language,
                analysis_type=CodeAnalysisType.DOCUMENTATION,
            )
        )


class Code:
    """Code API namespace."""

    def __init__(self, generate: CodeGeneration, analyze: CodeAnalysis):
        self.generate = generate
        self.analyze = analyze
