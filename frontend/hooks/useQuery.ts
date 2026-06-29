// =====================================================================
// hooks/useQuery.ts
// React hooks for data fetching with loading/error/empty states.
// =====================================================================
import { useState, useEffect, useCallback } from 'react';

type AsyncFn<T> = () => Promise<T>;

/**
 * Generic data-fetching hook. Calls the given async function on mount
 * and manages loading/error/data state.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useQuery(fetchAdminMetrics);
 */
export function useQuery<T>(fn: AsyncFn<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'An error occurred');
      console.error('useQuery error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
