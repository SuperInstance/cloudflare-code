'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, RealTimeMetric, DataPoint } from '@/types';

interface RealTimeContextValue {
  isConnected: boolean;
  metrics: Map<string, DataPoint[]>;
  latestMetrics: Map<string, number>;
  subscribeToMetric: (metricName: string) => void;
  unsubscribeFromMetric: (metricName: string) => void;
  sendMessage: (type: string, data: any) => void;
}

const RealTimeContext = createContext<RealTimeContextValue | undefined>(undefined);

interface RealTimeProviderProps {
  children: ReactNode;
  url?: string;
  autoConnect?: boolean;
}

export const RealTimeProvider: React.FC<RealTimeProviderProps> = ({
  children,
  url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  autoConnect = true,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<Map<string, DataPoint[]>>(new Map());
  const [latestMetrics, setLatestMetrics] = useState<Map<string, number>>(new Map());
  const [subscriptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!autoConnect) return;

    const socketInstance = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);

      // Resubscribe to metrics on reconnect
      subscriptions.forEach((metricName) => {
        socketInstance.emit('subscribe', { metric: metricName });
      });
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    socketInstance.on('message', (message: WebSocketMessage) => {
      handleIncomingMessage(message);
    });

    socketInstance.on('metric', (data: RealTimeMetric) => {
      handleMetricData(data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [url, autoConnect]);

  const handleIncomingMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'alert':
        // Handle alert message
        console.log('Alert received:', message.data);
        break;

      case 'incident':
        // Handle incident message
        console.log('Incident received:', message.data);
        break;

      case 'anomaly':
        // Handle anomaly message
        console.log('Anomaly received:', message.data);
        break;

      case 'status':
        // Handle status update
        console.log('Status update:', message.data);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  const handleMetricData = useCallback((data: RealTimeMetric) => {
    const dataPoint: DataPoint = {
      timestamp: data.timestamp,
      value: data.value,
      labels: data.labels,
    };

    setMetrics((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(data.name) || [];

      // Keep last 100 data points
      const updated = [...existing, dataPoint].slice(-100);

      // Trim old data points (older than 1 hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const trimmed = updated.filter((dp) => new Date(dp.timestamp).getTime() > oneHourAgo);

      newMap.set(data.name, trimmed);
      return newMap;
    });

    setLatestMetrics((prev) => {
      const newMap = new Map(prev);
      newMap.set(data.name, data.value);
      return newMap;
    });
  }, []);

  const subscribeToMetric = useCallback(
    (metricName: string) => {
      if (subscriptions.has(metricName)) return;

      subscriptions.add(metricName);

      if (socket && isConnected) {
        socket.emit('subscribe', { metric: metricName });
      }
    },
    [socket, isConnected, subscriptions]
  );

  const unsubscribeFromMetric = useCallback(
    (metricName: string) => {
      subscriptions.delete(metricName);

      if (socket && isConnected) {
        socket.emit('unsubscribe', { metric: metricName });
      }
    },
    [socket, isConnected, subscriptions]
  );

  const sendMessage = useCallback(
    (type: string, data: any) => {
      if (socket && isConnected) {
        socket.emit(type, data);
      }
    },
    [socket, isConnected]
  );

  const value: RealTimeContextValue = {
    isConnected,
    metrics,
    latestMetrics,
    subscribeToMetric,
    unsubscribeFromMetric,
    sendMessage,
  };

  return <RealTimeContext.Provider value={value}>{children}</RealTimeContext.Provider>;
};

export const useRealTime = () => {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within RealTimeProvider');
  }
  return context;
};

export default RealTimeProvider;
