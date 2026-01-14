"""
Exception classes for ClaudeFlare SDK
"""

from typing import Any


class ClaudeFlareError(Exception):
    """
    Base exception class for all ClaudeFlare errors.

    Attributes:
        code: Error code
        message: Error message
        status_code: HTTP status code
        request_id: Request ID for tracing
        details: Additional error details
    """

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        status_code: int = 500,
        request_id: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.request_id = request_id
        self.details = details or {}

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary."""
        return {
            "code": self.code,
            "message": self.message,
            "status_code": self.status_code,
            "request_id": self.request_id,
            "details": self.details,
        }


class ValidationError(ClaudeFlareError):
    """
    Validation error (400).

    Raised when the request contains invalid data.
    """

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message, "VALIDATION_ERROR", 400, None, details)


class AuthenticationError(ClaudeFlareError):
    """
    Authentication error (401).

    Raised when authentication fails or API key is invalid.
    """

    def __init__(self, message: str = "Authentication failed", request_id: str | None = None):
        super().__init__(message, "UNAUTHORIZED", 401, request_id)


class ForbiddenError(ClaudeFlareError):
    """
    Forbidden error (403).

    Raised when the client doesn't have permission to access a resource.
    """

    def __init__(self, message: str = "Access forbidden", request_id: str | None = None):
        super().__init__(message, "FORBIDDEN", 403, request_id)


class NotFoundError(ClaudeFlareError):
    """
    Not found error (404).

    Raised when a requested resource doesn't exist.
    """

    def __init__(self, resource: str, request_id: str | None = None):
        super().__init__(f"{resource} not found", "NOT_FOUND", 404, request_id)


class RateLimitError(ClaudeFlareError):
    """
    Rate limit error (429).

    Raised when the client exceeds rate limits.

    Attributes:
        retry_after: Seconds until retry is allowed
    """

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: int | None = None,
        request_id: str | None = None,
    ):
        super().__init__(message, "RATE_LIMIT_EXCEEDED", 429, request_id)
        self.retry_after = retry_after


class InternalServerError(ClaudeFlareError):
    """
    Internal server error (500).

    Raised when the server encounters an unexpected error.
    """

    def __init__(self, message: str = "Internal server error", request_id: str | None = None):
        super().__init__(message, "INTERNAL_ERROR", 500, request_id)


class ServiceUnavailableError(ClaudeFlareError):
    """
    Service unavailable error (503).

    Raised when the service is temporarily unavailable.
    """

    def __init__(self, message: str = "Service unavailable", request_id: str | None = None):
        super().__init__(message, "SERVICE_UNAVAILABLE", 503, request_id)


class TimeoutError(ClaudeFlareError):
    """
    Timeout error (408).

    Raised when a request times out.
    """

    def __init__(self, message: str = "Request timeout"):
        super().__init__(message, "TIMEOUT", 408)


class ProviderError(ClaudeFlareError):
    """
    Upstream provider error (502).

    Raised when an upstream AI provider encounters an error.
    """

    def __init__(self, provider: str, message: str = "Provider error", request_id: str | None = None):
        super().__init__(f"{provider}: {message}", "PROVIDER_ERROR", 502, request_id)
        self.provider = provider


def error_from_response(status_code: int, data: dict[str, Any]) -> ClaudeFlareError:
    """
    Create appropriate exception from API response.

    Args:
        status_code: HTTP status code
        data: Response data

    Returns:
        Appropriate exception instance
    """
    error_info = data.get("error", {})
    code = error_info.get("code", "UNKNOWN_ERROR")
    message = error_info.get("message", "An error occurred")
    details = error_info.get("details")
    request_id = error_info.get("request_id")

    if status_code == 400:
        return ValidationError(message, details)
    elif status_code == 401:
        return AuthenticationError(message, request_id)
    elif status_code == 403:
        return ForbiddenError(message, request_id)
    elif status_code == 404:
        return NotFoundError(message, request_id)
    elif status_code == 408:
        return TimeoutError(message)
    elif status_code == 429:
        return RateLimitError(message, error_info.get("retry_after"), request_id)
    elif status_code == 500:
        return InternalServerError(message, request_id)
    elif status_code == 502:
        return ProviderError("upstream", message, request_id)
    elif status_code == 503:
        return ServiceUnavailableError(message, request_id)
    else:
        return ClaudeFlareError(message, code, status_code, request_id, details)


def is_retryable_error(error: BaseException) -> bool:
    """
    Check if an error is retryable.

    Args:
        error: Exception to check

    Returns:
        True if error is retryable
    """
    if isinstance(error, ClaudeFlareError):
        return error.status_code in (408, 429, 500, 502, 503, 504)

    return False
