import { useState, useCallback, useRef } from 'react';
import { ApiRequest, ApiResponseData, SavedRequest, RequestHistory } from '@/types';
import { getApiClient } from '@/lib/api/client';
import { generateId } from '@/lib/utils/cn';

export function usePlayground() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RequestHistory[]>([]);
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendRequest = useCallback(async (request: ApiRequest) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const client = getApiClient();
      const responseData = await client.executeRequest(
        request,
        abortControllerRef.current.signal
      );

      setResponse(responseData);

      // Add to history
      const historyItem: RequestHistory = {
        id: generateId(),
        request,
        response: responseData,
        timestamp: new Date(),
        successful: responseData.status >= 200 && responseData.status < 300,
      };

      setHistory((prev) => [historyItem, ...prev.slice(0, 99)]); // Keep last 100

      return responseData;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);

      // Add failed request to history
      const historyItem: RequestHistory = {
        id: generateId(),
        request,
        response: {
          status: 0,
          statusText: 'Network Error',
          headers: {},
          body: { error: errorMessage },
          duration: 0,
          size: 0,
        },
        timestamp: new Date(),
        successful: false,
      };

      setHistory((prev) => [historyItem, ...prev.slice(0, 99)]);

      throw err;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setError('Request cancelled');
    }
  }, []);

  const saveRequest = useCallback(
    (request: ApiRequest, name: string, tags?: string[]) => {
      const savedRequest: SavedRequest = {
        id: generateId(),
        name,
        request,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags,
      };

      setSavedRequests((prev) => [...prev, savedRequest]);
      return savedRequest;
    },
    []
  );

  const deleteSavedRequest = useCallback((id: string) => {
    setSavedRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateSavedRequest = useCallback(
    (id: string, updates: Partial<SavedRequest>) => {
      setSavedRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ...updates, updatedAt: new Date() } : r
        )
      );
    },
    []
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const loadFromHistory = useCallback((historyItem: RequestHistory) => {
    return historyItem.request;
  }, []);

  const loadSavedRequest = useCallback((savedRequest: SavedRequest) => {
    return savedRequest.request;
  }, []);

  return {
    isLoading,
    response,
    error,
    history,
    savedRequests,
    sendRequest,
    cancelRequest,
    saveRequest,
    deleteSavedRequest,
    updateSavedRequest,
    clearHistory,
    loadFromHistory,
    loadSavedRequest,
  };
}
