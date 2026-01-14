package claudeflare

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// ErrorCode represents an error code
type ErrorCode string

const (
	ErrorCodeValidation    ErrorCode = "VALIDATION_ERROR"
	ErrorCodeUnauthorized  ErrorCode = "UNAUTHORIZED"
	ErrorCodeForbidden     ErrorCode = "FORBIDDEN"
	ErrorCodeNotFound      ErrorCode = "NOT_FOUND"
	ErrorCodeRateLimit     ErrorCode = "RATE_LIMIT_EXCEEDED"
	ErrorCodeInternal      ErrorCode = "INTERNAL_ERROR"
	ErrorCodeServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"
	ErrorCodeTimeout       ErrorCode = "TIMEOUT"
	ErrorCodeProvider      ErrorCode = "PROVIDER_ERROR"
)

// APIError represents an API error
type APIError struct {
	Code       ErrorCode              `json:"code"`
	Message    string                 `json:"message"`
	StatusCode int                    `json:"-"`
	RequestID  string                 `json:"request_id,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// IsRetryable returns true if the error is retryable
func (e *APIError) IsRetryable() bool {
	return e.StatusCode == http.StatusTooManyRequests ||
		e.StatusCode == http.StatusInternalServerError ||
		e.StatusCode == http.StatusBadGateway ||
		e.StatusCode == http.StatusServiceUnavailable ||
		e.StatusCode == http.StatusGatewayTimeout
}

// ValidationError represents a validation error (400)
type ValidationError struct {
	*APIError
}

func NewValidationError(message string, details map[string]interface{}) *ValidationError {
	return &ValidationError{
		APIError: &APIError{
			Code:       ErrorCodeValidation,
			Message:    message,
			StatusCode: http.StatusBadRequest,
			Details:    details,
		},
	}
}

// AuthenticationError represents an authentication error (401)
type AuthenticationError struct {
	*APIError
}

func NewAuthenticationError(message string) *AuthenticationError {
	return &AuthenticationError{
		APIError: &APIError{
			Code:       ErrorCodeUnauthorized,
			Message:    message,
			StatusCode: http.StatusUnauthorized,
		},
	}
}

// ForbiddenError represents a forbidden error (403)
type ForbiddenError struct {
	*APIError
}

func NewForbiddenError(message string) *ForbiddenError {
	return &ForbiddenError{
		APIError: &APIError{
			Code:       ErrorCodeForbidden,
			Message:    message,
			StatusCode: http.StatusForbidden,
		},
	}
}

// NotFoundError represents a not found error (404)
type NotFoundError struct {
	*APIError
}

func NewNotFoundError(resource string) *NotFoundError {
	return &NotFoundError{
		APIError: &APIError{
			Code:       ErrorCodeNotFound,
			Message:    fmt.Sprintf("%s not found", resource),
			StatusCode: http.StatusNotFound,
		},
	}
}

// RateLimitError represents a rate limit error (429)
type RateLimitError struct {
	*APIError
	RetryAfter int `json:"retry_after,omitempty"`
}

func NewRateLimitError(message string, retryAfter int) *RateLimitError {
	return &RateLimitError{
		APIError: &APIError{
			Code:       ErrorCodeRateLimit,
			Message:    message,
			StatusCode: http.StatusTooManyRequests,
		},
		RetryAfter: retryAfter,
	}
}

// InternalServerError represents an internal server error (500)
type InternalServerError struct {
	*APIError
}

func NewInternalServerError(message string) *InternalServerError {
	return &InternalServerError{
		APIError: &APIError{
			Code:       ErrorCodeInternal,
			Message:    message,
			StatusCode: http.StatusInternalServerError,
		},
	}
}

// ServiceUnavailableError represents a service unavailable error (503)
type ServiceUnavailableError struct {
	*APIError
}

func NewServiceUnavailableError(message string) *ServiceUnavailableError {
	return &ServiceUnavailableError{
		APIError: &APIError{
			Code:       ErrorCodeServiceUnavailable,
			Message:    message,
			StatusCode: http.StatusServiceUnavailable,
		},
	}
}

// TimeoutError represents a timeout error (408)
type TimeoutError struct {
	*APIError
}

func NewTimeoutError(message string) *TimeoutError {
	return &TimeoutError{
		APIError: &APIError{
			Code:       ErrorCodeTimeout,
			Message:    message,
			StatusCode: http.StatusRequestTimeout,
		},
	}
}

// ProviderError represents a provider error (502)
type ProviderError struct {
	*APIError
	Provider string
}

func NewProviderError(provider, message string) *ProviderError {
	return &ProviderError{
		APIError: &APIError{
			Code:       ErrorCodeProvider,
			Message:    fmt.Sprintf("%s: %s", provider, message),
			StatusCode: http.StatusBadGateway,
		},
		Provider: provider,
	}
}

// errorResponse represents an error response from the API
type errorResponse struct {
	Error *APIError `json:"error"`
}

// decodeError decodes an error response
func decodeError(statusCode int, body []byte) error {
	var errResp errorResponse
	if err := json.Unmarshal(body, &errResp); err != nil {
		// If we can't decode the error, return a generic error
		return &APIError{
			Code:       ErrorCodeInternal,
			Message:    string(body),
			StatusCode: statusCode,
		}
	}

	errResp.Error.StatusCode = statusCode

	switch statusCode {
	case http.StatusBadRequest:
		return &ValidationError{APIError: errResp.Error}
	case http.StatusUnauthorized:
		return &AuthenticationError{APIError: errResp.Error}
	case http.StatusForbidden:
		return &ForbiddenError{APIError: errResp.Error}
	case http.StatusNotFound:
		return &NotFoundError{APIError: errResp.Error}
	case http.StatusTooManyRequests:
		retryAfter := 0
		if errResp.Error.Details != nil {
			if ra, ok := errResp.Error.Details["retry_after"].(float64); ok {
				retryAfter = int(ra)
			}
		}
		return &RateLimitError{
			APIError:    errResp.Error,
			RetryAfter: retryAfter,
		}
	case http.StatusInternalServerError:
		return &InternalServerError{APIError: errResp.Error}
	case http.StatusServiceUnavailable:
		return &ServiceUnavailableError{APIError: errResp.Error}
	case http.StatusRequestTimeout:
		return &TimeoutError{APIError: errResp.Error}
	case http.StatusBadGateway:
		return &ProviderError{
			APIError:  errResp.Error,
			Provider: "upstream",
		}
	default:
		return errResp.Error
	}
}
