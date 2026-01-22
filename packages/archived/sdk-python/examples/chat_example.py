"""
Chat Completions Examples

Demonstrates basic and advanced usage of the chat completions API
"""

import asyncio
from claudeflare import ClaudeFlare, Message, AIProvider

# Initialize client
client = ClaudeFlare(api_key="your-api-key", base_url="http://localhost:8787", debug=True)


async def simple_chat():
    """Simple chat completion"""
    print("\n=== Simple Chat ===\n")

    response = await client.chat.completions.create(
        ChatCompletionParams(
            messages=[
                Message(role="user", content="What is Cloudflare Workers?")
            ],
            model="claude-3-5-sonnet-20241022",
            temperature=0.7,
            max_tokens=1000,
        )
    )

    print(f"Response: {response.content}")
    print(f"Usage: {response.usage}")


async def multi_turn_conversation():
    """Multi-turn conversation"""
    print("\n=== Multi-turn Conversation ===\n")

    messages = [
        Message(role="system", content="You are a helpful coding assistant."),
        Message(role="user", content="What is TypeScript?"),
    ]

    # First turn
    response1 = await client.chat.completions.create(
        ChatCompletionParams(messages=messages, temperature=0.7)
    )

    print(f"Assistant: {response1.content}")

    # Add assistant response to conversation
    messages.append(Message(role="assistant", content=response1.content))

    # Second turn
    messages.append(Message(role="user", content="Can you show me an example?"))

    response2 = await client.chat.completions.create(
        ChatCompletionParams(messages=messages, temperature=0.7)
    )

    print(f"Assistant: {response2.content}")


async def streaming_chat():
    """Streaming chat completion"""
    print("\n=== Streaming Chat ===\n")

    await client.chat.completions.create_stream(
        ChatCompletionParams(
            messages=[Message(role="user", content="Explain quantum computing in simple terms")],
            stream=True,
            temperature=0.7,
        ),
        lambda event: print(event.content, end="", flush=True) if event.content else None,
    )

    print("\n\nStream complete!")


async def different_providers():
    """Using different providers"""
    print("\n=== Different Providers ===\n")

    providers = [AIProvider.ANTHROPIC, AIProvider.OPENAI, AIProvider.GROQ]

    for provider in providers:
        print(f"\n--- Using {provider.value} ---\n")

        try:
            response = await client.chat.completions.create(
                ChatCompletionParams(
                    messages=[Message(role="user", content=f"Say hello from {provider.value}")],
                    provider=provider,
                    temperature=0.7,
                )
            )

            print(response.content)
        except Exception as error:
            print(f"Error with {provider.value}: {error}")


async def error_handling():
    """Error handling"""
    print("\n=== Error Handling ===\n")

    from claudeflare import (
        ValidationError,
        AuthenticationError,
        RateLimitError,
        NotFoundError,
    )

    try:
        response = await client.chat.completions.create(
            ChatCompletionParams(
                messages=[Message(role="user", content="Hello")],
                model="non-existent-model",
            )
        )
    except AuthenticationError as error:
        print(f"Authentication failed: {error.message}")
    except RateLimitError as error:
        print(f"Rate limit exceeded: {error.message}")
        print(f"Retry after: {error.retry_after}")
    except NotFoundError as error:
        print(f"Model not found: {error.message}")
    except ValidationError as error:
        print(f"Validation error: {error.message}")


async def main():
    """Run all examples"""
    try:
        await simple_chat()
        await multi_turn_conversation()
        await streaming_chat()
        await different_providers()
        await error_handling()
    except Exception as error:
        print(f"Error running examples: {error}")


if __name__ == "__main__":
    asyncio.run(main())
