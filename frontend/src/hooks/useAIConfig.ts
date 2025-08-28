import { useState, useEffect } from 'react';
import { localStorageManager, AIConfigData } from '../utils/api';

export const useAIConfig = () => {
  const [config, setConfig] = useState<AIConfigData | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  const loadConfig = () => {
    const savedConfig = localStorageManager.getAIConfig();
    setConfig(savedConfig);
    setIsConfigured(localStorageManager.hasAIConfig());
  };

  const updateConfig = (newConfig: AIConfigData) => {
    localStorageManager.setAIConfig(newConfig);
    loadConfig(); // 重新加载配置
  };

  const clearConfig = () => {
    localStorageManager.removeAIConfig();
    loadConfig(); // 重新加载配置
  };

  useEffect(() => {
    loadConfig();
    
    // 监听存储变化
    const handleStorageChange = () => {
      loadConfig();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return {
    config,
    isConfigured,
    loadConfig,
    updateConfig,
    clearConfig
  };
};
