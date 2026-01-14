"""
Models API
"""

import logging
from typing import Any

from claudeflare.types import Model, AIProvider
from claudeflare.client import ClaudeFlare
from claudeflare.exceptions import error_from_response

logger = logging.getLogger("claudeflare")


class Models:
    """Models resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def list(self) -> dict[str, Any]:
        """
        List all available models.

        Returns:
            Models list response
        """
        endpoint = "models"

        logger.debug(f"Listing models: {endpoint}")

        response = await self.client.get(endpoint)

        if not response.is_error:
            return response.json()

        error = error_from_response(response.status_code, response.json())
        raise error

    async def get(self, model_id: str) -> Model:
        """
        Get a specific model by ID.

        Args:
            model_id: Model ID

        Returns:
            Model information
        """
        endpoint = f"models/{model_id}"

        logger.debug(f"Getting model: {endpoint}")

        response = await self.client.get(endpoint)

        if not response.is_error:
            data = response.json()
            return Model(**data)

        error = error_from_response(response.status_code, response.json())
        raise error

    async def find(self, query: str) -> Model | None:
        """
        Find model by name or ID.

        Args:
            query: Model name or ID

        Returns:
            Model if found, None otherwise
        """
        result = await self.list()

        # Try exact match
        for model_data in result.get("models", []):
            model = Model(**model_data)
            if model.id == query or model.name.lower() == query.lower():
                return model

        # Try partial match
        for model_data in result.get("models", []):
            model = Model(**model_data)
            if query.lower() in model.name.lower():
                return model

        return None

    async def list_by_provider(self, provider: AIProvider) -> list[Model]:
        """
        List models by provider.

        Args:
            provider: AI provider

        Returns:
            List of models
        """
        result = await self.list()
        return [
            Model(**m)
            for m in result.get("models", [])
            if m.get("provider") == provider.value
        ]

    async def get_cheapest(
        self, provider: AIProvider | None = None, max_context_length: int | None = None
    ) -> Model | None:
        """
        Get cheapest model.

        Args:
            provider: Filter by provider
            max_context_length: Maximum context length

        Returns:
            Cheapest model
        """
        models = await self.list()
        models_list = [Model(**m) for m in models.get("models", [])]

        if provider:
            models_list = [m for m in models_list if m.provider == provider]

        if max_context_length:
            models_list = [m for m in models_list if m.context_length <= max_context_length]

        # Sort by total cost
        models_with_pricing = [m for m in models_list if m.pricing]
        models_with_pricing.sort(
            key=lambda m: (m.pricing.input_cost_per_1k + m.pricing.output_cost_per_1k)
        )

        return models_with_pricing[0] if models_with_pricing else None

    async def get_largest_context(self, provider: AIProvider | None = None) -> Model | None:
        """
        Get model with largest context window.

        Args:
            provider: Filter by provider

        Returns:
            Model with largest context
        """
        models = await self.list()
        models_list = [Model(**m) for m in models.get("models", [])]

        if provider:
            models_list = [m for m in models_list if m.provider == provider]

        if not models_list:
            return None

        return max(models_list, key=lambda m: m.context_length)
