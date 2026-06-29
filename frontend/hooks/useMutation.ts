"use client";

import { useState, useCallback } from 'react';

type MutationOptions<T> = {
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
};

/**
 * Custom hook to execute async mutations (inserts, updates, RPCs)
 * with loading, error, and success states.
 */
export function useMutation<T, Args extends any[]>(
  mutationFn: (...args: Args) => Promise<T>,
  options?: MutationOptions<T>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(
    async (...args: Args): Promise<T> => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const result = await mutationFn(...args);
        setSuccess(true);
        if (options?.onSuccess) {
          options.onSuccess(result);
        }
        return result;
      } catch (err: any) {
        const message = err?.message ?? 'An error occurred during mutation';
        setError(message);
        if (options?.onError) {
          options.onError(err);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn, options]
  );

  return {
    mutate,
    loading,
    error,
    success,
  };
}
