"""
Agent orchestration API
"""

import logging
from typing import Any, AsyncIterator

from claudeflare.types import (
    AgentOrchestrationParams,
    AgentOrchestrationResponse,
    Agent,
    AgentType,
)
from claudeflare.client import ClaudeFlare
from claudeflare.exceptions import error_from_response

logger = logging.getLogger("claudeflare")


class AgentOrchestration:
    """Agent orchestration resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def create(self, params: AgentOrchestrationParams) -> AgentOrchestrationResponse:
        """
        Orchestrate agents for a task.

        Args:
            params: Orchestration parameters

        Returns:
            Orchestration response
        """
        endpoint = "agents/orchestrate"
        body = {
            "task": params.task,
            "agents": [a.value for a in params.agents] if params.agents else None,
            "auto_select": params.auto_select,
            "context": params.context,
            "max_parallelism": params.max_parallelism,
            "timeout": params.timeout,
        }

        body = {k: v for k, v in body.items() if v is not None}

        logger.debug(f"Orchestrating agents: {endpoint}")

        response = await self.client.post(endpoint, json_data=body)

        if not response.is_error:
            data = response.json()
            return AgentOrchestrationResponse(**data)

        error = error_from_response(response.status_code, response.json())
        raise error

    async def create_stream(
        self, params: AgentOrchestrationParams
    ) -> AsyncIterator[AgentOrchestrationResponse]:
        """
        Orchestrate agents with streaming updates.

        Args:
            params: Orchestration parameters

        Yields:
            Orchestration updates
        """
        endpoint = "agents/orchestrate"
        body = {
            "task": params.task,
            "agents": [a.value for a in params.agents] if params.agents else None,
            "auto_select": params.auto_select,
            "context": params.context,
            "max_parallelism": params.max_parallelism,
            "timeout": params.timeout,
        }

        body = {k: v for k, v in body.items() if v is not None}

        logger.debug(f"Orchestrating agents with streaming: {endpoint}")

        response = await self.client.post(
            endpoint,
            json_data=body,
            headers={"Accept": "text/event-stream"},
        )

        if response.is_error:
            error = error_from_response(response.status_code, response.json())
            raise error

        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue

            data = line[6:]

            if data == "[DONE]":
                break

            try:
                import json

                update = json.loads(data)
                yield AgentOrchestrationResponse(**update)
            except json.JSONDecodeError:
                logger.debug(f"Failed to parse update: {data}")


class AgentRegistry:
    """Agent registry resource."""

    def __init__(self, client: ClaudeFlare):
        self.client = client

    async def get_status(self) -> dict[str, Any]:
        """Get agent registry status."""
        endpoint = "agents/status"

        logger.debug(f"Getting agent registry status: {endpoint}")

        response = await self.client.get(endpoint)

        if not response.is_error:
            return response.json()

        error = error_from_response(response.status_code, response.json())
        raise error

    async def list(self, agent_type: AgentType | None = None) -> dict[str, Any]:
        """
        List available agents.

        Args:
            agent_type: Filter by agent type

        Returns:
            List of agents
        """
        endpoint = f"agents/available/{agent_type.value}" if agent_type else "agents/available"

        logger.debug(f"Listing available agents: {endpoint}")

        response = await self.client.get(endpoint)

        if not response.is_error:
            return response.json()

        error = error_from_response(response.status_code, response.json())
        raise error

    async def get_all(self) -> list[Agent]:
        """Get all available agents."""
        result = await self.list()
        return [Agent(**a) for a in result.get("agents", [])]

    async def get_by_type(self, agent_type: AgentType) -> list[Agent]:
        """Get agents by type."""
        result = await self.list(agent_type)
        return [Agent(**a) for a in result.get("agents", [])]


class Agents:
    """Agents API namespace."""

    def __init__(self, orchestrate: AgentOrchestration, registry: AgentRegistry):
        self.orchestrate = orchestrate
        self.registry = registry
