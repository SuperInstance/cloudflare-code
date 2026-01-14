/**
 * WebSocket hook for real-time updates
 */

import { useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage, WSMessageType } from '@/types';

interface WebSocketOptions {
  onMessage?: (type: WSMessageType, data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  send: (type: WSMessageType, data: unknown) => void;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

export function useWebSocket(
  url: string | null,
  options: WebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnect = true,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);
  const manualCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (!url) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectedRef.current = true;
        manualCloseRef.current = false;
        onConnect?.();

        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(message.type, message.data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        isConnectedRef.current = false;
        wsRef.current = null;
        onDisconnect?.();

        // Attempt reconnect if not manually closed
        if (reconnect && !manualCloseRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        onError?.(error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      onError?.(error as Event);
    }
  }, [url, reconnect, reconnectInterval, onConnect, onMessage, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectedRef.current = false;
  }, []);

  const send = useCallback(
    (type: WSMessageType, data: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message: WebSocketMessage = { type, data };
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('WebSocket is not connected. Message not sent:', { type, data });
      }
    },
    []
  );

  // Auto-connect on mount
  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    send,
    connect,
    disconnect,
    isConnected: isConnectedRef.current,
  };
}

// ============================================================================
// Chat Streaming WebSocket Hook
// ============================================================================

interface ChatStreamOptions {
  onChunk: (chunk: string) => void;
  onComplete: (metadata?: unknown) => void;
  onError: (error: Error) => void;
}

export function useChatStream(url: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const onChunkRef = useRef<((chunk: string) => void) | null>(null);
  const onCompleteRef = useRef<((metadata?: unknown) => void) | null>(null);
  const onErrorRef = useRef<((error: Error) => void) | null>(null);

  const startStream = useCallback((
    sessionId: string,
    message: string,
    options: ChatStreamOptions
  ) => {
    if (!url) {
      options.onError(new Error('WebSocket URL not configured'));
      return;
    }

    // Store callbacks
    onChunkRef.current = options.onChunk;
    onCompleteRef.current = options.onComplete;
    onErrorRef.current = options.onError;

    try {
      const ws = new WebSocket(`${url}?session=${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send the message
        ws.send(JSON.stringify({
          type: 'chat.request',
          data: { message },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'chat.chunk') {
            onChunkRef.current?.(data.data.content);
          } else if (data.type === 'chat.complete') {
            onCompleteRef.current?.(data.data.metadata);
            ws.close();
          } else if (data.type === 'chat.error') {
            onErrorRef.current?.(new Error(data.data.message));
            ws.close();
          }
        } catch (error) {
          onErrorRef.current?.(error as Error);
        }
      };

      ws.onerror = () => {
        onErrorRef.current?.(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch (error) {
      onErrorRef.current?.(error as Error);
    }
  }, [url]);

  const stopStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    startStream,
    stopStream,
    isStreaming: wsRef.current?.readyState === WebSocket.OPEN,
  };
}

// ============================================================================
// Collaboration WebSocket Hook
// ============================================================================

interface CollabMessage {
  type: 'cursor' | 'presence' | 'edit';
  userId: string;
  data: unknown;
}

export function useCollaboration(url: string | null, fileId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  const on = useCallback((type: string, callback: (data: unknown) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)?.add(callback);

    return () => {
      listenersRef.current.get(type)?.delete(callback);
    };
  }, []);

  const emit = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: CollabMessage = {
        type: type as CollabMessage['type'],
        userId: '', // Will be set by auth middleware
        data,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback(() => {
    if (!url || !fileId) return;

    try {
      const ws = new WebSocket(`${url}?file=${fileId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const message: CollabMessage = JSON.parse(event.data);
          const listeners = listenersRef.current.get(message.type);
          listeners?.forEach((callback) => callback(message.data));
        } catch (error) {
          console.error('Failed to parse collab message:', error);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Auto-reconnect
        setTimeout(() => {
          if (fileId) connect();
        }, 3000);
      };
    } catch (error) {
      console.error('Collaboration WebSocket error:', error);
    }
  }, [url, fileId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (fileId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [fileId, connect, disconnect]);

  return {
    on,
    emit,
    connect,
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
