import { useState, useEffect } from 'react';
import { aiAPI, AIStatus, localStorageManager } from '../utils/api';

export const useAIStatus = () => {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await aiAPI.getStatus();
      
      if (response.success && response.data) {
        setStatus(response.data);
      } else {
        setError(response.message || 'Failed to get AI status');
        setStatus(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // 监听本地存储变化
    const handleStorageChange = () => {
      checkStatus();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return {
    status,
    loading,
    error,
    refresh: checkStatus,
    isConfigured: localStorageManager.hasAIConfig()
  };
};