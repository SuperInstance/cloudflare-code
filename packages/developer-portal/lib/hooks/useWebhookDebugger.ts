import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { WebhookEvent } from '@/types';

export function useWebhookDebugger(webhookUrl?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [filter, setFilter] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!webhookUrl) return;

    // Connect to websocket for real-time webhook events
    const socket = io(webhookUrl, {
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('webhook', (event: WebhookEvent) => {
      setEvents((prev) => [event, ...prev.slice(0, 999)]); // Keep last 1000
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [webhookUrl]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const replayEvent = useCallback(async (event: WebhookEvent) => {
    // Send replay request to server
    try {
      const response = await fetch('/api/webhooks/replay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId: event.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to replay event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error replaying event:', error);
      throw error;
    }
  }, []);

  const verifySignature = useCallback(
    (event: WebhookEvent, secret: string): boolean => {
      if (!event.signature) return false;

      // Implement signature verification logic
      // This is a placeholder - actual implementation depends on your signature algorithm
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(event.data));
      const expectedSignature = hmac.digest('hex');

      return event.signature === expectedSignature;
    },
    []
  );

  const filteredEvents = events.filter((event) => {
    if (!filter) return true;
    return event.type.toLowerCase().includes(filter.toLowerCase());
  });

  return {
    isConnected,
    events: filteredEvents,
    selectedEvent,
    setSelectedEvent,
    filter,
    setFilter,
    clearEvents,
    replayEvent,
    verifySignature,
  };
}
