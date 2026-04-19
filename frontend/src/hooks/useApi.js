import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../lib/api';

export function useApi(path, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { skip = false, deps = [] } = options;

  const fetch = useCallback(async () => {
    if (skip || !path) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(path);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, skip, ...deps]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
