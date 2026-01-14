"""
Codebase RAG API
"""

import logging
from typing import Any

from claudeflare.types import (
    CodebaseFile,
    CodebaseUploadParams,
    CodebaseUploadResponse,
    CodebaseSearchParams,
    CodebaseSearchResponse,
)
from claudeflare.client import ClaudeFlare
from claudeflare.exceptions import error_from_response

logger = logging.getLogger("claudeflare")


class CodebaseUpload:
    """Codebase upload resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def create(self, params: CodebaseUploadParams) -> CodebaseUploadResponse:
        """
        Upload codebase for indexing.

        Args:
            params: Upload parameters

        Returns:
            Upload response
        """
        endpoint = "codebase/upload"

        # Build multipart form data
        import httpx

        data = {}
        files = {}

        if params.repository_url:
            data["repository_url"] = params.repository_url

        if params.branch:
            data["branch"] = params.branch

        if params.include_patterns:
            for i, pattern in enumerate(params.include_patterns):
                data[f"include_patterns[{i}]"] = pattern

        if params.exclude_patterns:
            for i, pattern in enumerate(params.exclude_patterns):
                data[f"exclude_patterns[{i}]"] = pattern

        if params.max_file_size:
            data["max_file_size"] = str(params.max_file_size)

        if params.files:
            for i, file in enumerate(params.files):
                files[f"files[{i}][path]"] = (None, file.path)
                files[f"files[{i}][content]"] = (None, file.content)

        logger.debug(f"Uploading codebase: {endpoint}")

        # Use multipart/form-data
        response = await self.client._client.post(
            f"{self.client.base_url}/{self.client.api_version}/{endpoint}",
            headers={"Authorization": f"Bearer {self.client.api_key}"},
            data=data,
            files=files,
        )

        if not response.is_error:
            result = response.json()
            return CodebaseUploadResponse(**result)

        error = error_from_response(response.status_code, response.json())
        raise error

    async def upload_files(self, files: list[CodebaseFile]) -> CodebaseUploadResponse:
        """Upload files directly."""
        return await self.create(CodebaseUploadParams(files=files))

    async def upload_repository(
        self, repository_url: str, branch: str | None = None
    ) -> CodebaseUploadResponse:
        """Upload repository from URL."""
        return await self.create(
            CodebaseUploadParams(repository_url=repository_url, branch=branch)
        )


class CodebaseSearch:
    """Codebase search resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def query(self, params: CodebaseSearchParams) -> CodebaseSearchResponse:
        """
        Search codebase.

        Args:
            params: Search parameters

        Returns:
            Search response
        """
        endpoint = "codebase/search"
        body = {
            "query": params.query,
            "top_k": params.top_k,
            "filters": params.filters,
            "include_snippets": params.include_snippets,
        }

        body = {k: v for k, v in body.items() if v is not None}

        logger.debug(f"Searching codebase: {endpoint}")

        response = await self.client.post(endpoint, json_data=body)

        if not response.is_error:
            data = response.json()
            return CodebaseSearchResponse(**data)

        error = error_from_response(response.status_code, response.json())
        raise error

    async def search(
        self, query: str, **kwargs
    ) -> CodebaseSearchResponse:
        """Simple search with query string."""
        return await self.query(CodebaseSearchParams(query=query, **kwargs))

    async def search_by_path(
        self, path: str, query: str, top_k: int | None = None
    ) -> CodebaseSearchResponse:
        """Search by file path."""
        return await self.query(
            CodebaseSearchParams(
                query=query, top_k=top_k, filters={"path": path}
            )
        )

    async def search_by_language(
        self, language: str, query: str, top_k: int | None = None
    ) -> CodebaseSearchResponse:
        """Search by language."""
        return await self.query(
            CodebaseSearchParams(
                query=query, top_k=top_k, filters={"language": language}
            )
        )


class CodebaseManagement:
    """Codebase management resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def get_stats(self) -> dict[str, Any]:
        """Get codebase statistics."""
        endpoint = "codebase/stats"

        logger.debug(f"Getting codebase stats: {endpoint}")

        response = await self.client.get(endpoint)

        if not response.is_error:
            return response.json()

        error = error_from_response(response.status_code, response.json())
        raise error

    async def get_file(self, path: str) -> dict[str, Any]:
        """Get a specific file."""
        endpoint = f"codebase/file?path={path}"

        logger.debug(f"Getting codebase file: {endpoint}")

        response = await self.client.get(endpoint)

        if not response.is_error:
            return response.json()

        error = error_from_response(response.status_code, response.json())
        raise error

    async def clear(self) -> dict[str, Any]:
        """Clear codebase index."""
        endpoint = "codebase"

        logger.debug(f"Clearing codebase: {endpoint}")

        response = await self.client.delete(endpoint)

        if not response.is_error:
            return response.json()

        error = error_from_response(response.status_code, response.json())
        raise error

    async def reindex(self) -> dict[str, Any]:
        """Reindex codebase."""
        endpoint = "codebase/reindex"

        logger.debug(f"Reindexing codebase: {endpoint}")

        response = await self.client.post(endpoint, json_data={})

        if not response.is_error:
            return response.json()

        error = error_from_response(response.status_code, response.json())
        raise error

    async def batch_upload(
        self, files: list[CodebaseFile], batch_size: int = 100
    ) -> list[CodebaseUploadResponse]:
        """Upload files in batches."""
        results = []

        for i in range(0, len(files), batch_size):
            batch = files[i : i + batch_size]
            result = await self.client.codebase.upload.create(
                CodebaseUploadParams(files=batch)
            )
            results.append(result)

        return results


class Codebase:
    """Codebase API namespace."""

    def __init__(
        self,
        upload: CodebaseUpload,
        search: CodebaseSearch,
        management: CodebaseManagement,
    ):
        self.upload = upload
        self.search = search
        self.management = management
