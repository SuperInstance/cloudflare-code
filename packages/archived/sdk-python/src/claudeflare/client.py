"""
Main ClaudeFlare client
"""

import logging
import time
import uuid
from typing import Any

import httpx

from claudeflare.exceptions import (
    error_from_response,
    is_retryable_error,
    ValidationError,
)
from claudeflare.resources import Chat, Code, Agents, Models, Codebase
from claudeflare.types import AIProvider

logger = logging.getLogger("claudeflare")


class ClaudeFlare:
    """
    Main ClaudeFlare client.

    Example:
        ```python
        from claudeflare import ClaudeFlare

        client = ClaudeFlare(api_key="your-api-key")

        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": "Hello!"}]
        )
        print(response.content)
        ```
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.claudeflare.com",
        api_version: str = "v1",
        timeout: float = 60.0,
        max_retries: int = 3,
        debug: bool = False,
        http_client: httpx.AsyncClient | None = None,
    ):
        """
        Initialize ClaudeFlare client.

        Args:
            api_key: API key for authentication
            base_url: Base URL for API requests
            api_version: API version to use
            timeout: Request timeout in seconds
            max_retries: Maximum number of retries
            debug: Enable debug logging
            http_client: Custom HTTP client
        """
        # Validate configuration
        if not api_key or not isinstance(api_key, str) or not api_key.strip():
            raise ValidationError("API key is required and must be a non-empty string")

        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.api_version = api_version
        self.timeout = timeout
        self.max_retries = max_retries
        self.debug = debug

        # Configure logging
        if debug:
            logging.basicConfig(level=logging.DEBUG)
            logger.setLevel(logging.DEBUG)

        # Create HTTP client
        self._client = http_client or httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(max_keepalive_connections=100, max_connections=100),
        )

        # Initialize resources
        self.chat = Chat(self)
        self.code = Code(self)
        self.agents = Agents(self)
        self.models = Models(self)
        self.codebase = Codebase(self)

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

    def _generate_request_id(self) -> str:
        """Generate unique request ID."""
        return f"req_{int(time.time() * 1000)}_{uuid.uuid4().hex[:9]}"

    def _build_headers(self, request_id: str | None = None) -> dict[str, str]:
        """Build request headers."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"claudeflare-python/0.1.0",
            "X-Request-ID": request_id or self._generate_request_id(),
        }

    async def _request(
        self,
        method: str,
        path: str,
        json_data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        **kwargs,
    ) -> httpx.Response:
        """
        Make HTTP request with retry logic.

        Args:
            method: HTTP method
            path: Request path
            json_data: JSON body data
            params: Query parameters
            **kwargs: Additional arguments for httpx

        Returns:
            Response object

        Raises:
            ClaudeFlareError: On API errors
        """
        url = f"{self.base_url}/{self.api_version}/{path.lstrip('/')}"
        headers = self._build_headers()

        logger.debug(f"Request: {method} {url}")

        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await self._client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json_data,
                    params=params,
                    **kwargs,
                )

                logger.debug(f"Response: {response.status_code}")

                # Don't retry non-retryable errors
                if response.is_error:
                    try:
                        data = response.json()
                        error = error_from_response(response.status_code, data)

                        if not is_retryable_error(error) or attempt >= self.max_retries:
                            raise error

                        last_error = error
                    except Exception as e:
                        if attempt >= self.max_retries:
                            raise

                        last_error = e

                # Success or don't retry
                return response

            except httpx.TimeoutException as e:
                logger.warning(f"Request timeout (attempt {attempt + 1}/{self.max_retries + 1})")
                last_error = e

            except httpx.NetworkError as e:
                logger.warning(f"Network error (attempt {attempt + 1}/{self.max_retries + 1})")
                last_error = e

            except Exception as e:
                # Don't retry unknown errors
                raise

            # Wait before retrying
            if attempt < self.max_retries:
                delay = min(2**attempt, 8)  # Exponential backoff with max 8 seconds
                logger.debug(f"Retrying after {delay}s...")
                await anyio.sleep(delay)

        # All retries exhausted
        if last_error:
            raise last_error

        raise Exception("Request failed after all retries")

    async def get(self, path: str, **kwargs) -> httpx.Response:
        """Make GET request."""
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, json_data: dict[str, Any] | None = None, **kwargs) -> httpx.Response:
        """Make POST request."""
        return await self._request("POST", path, json_data=json_data, **kwargs)

    async def delete(self, path: str, **kwargs) -> httpx.Response:
        """Make DELETE request."""
        return await self._request("DELETE", path, **kwargs)


# Import anyio at runtime to avoid hard dependency
try:
    import anyio
except ImportError:
    # Fallback to asyncio
    import asyncio

    class _anyio:
        @staticmethod
        async def sleep(seconds: float):
            await asyncio.sleep(seconds)

    anyio = _anyio()  # type: ignore
