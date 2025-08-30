import React, { useState, useEffect } from 'react';
import { Settings, Key, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface APIConfig {
  provider: string;
  api_key: string;
  base_url?: string;
  model?: string;
}

interface ScanResult {
  scan_result: {
    [key: string]: {
      found: boolean;
      keys: Array<{
        name: string;
        preview: string;
        is_placeholder: boolean;
      }>;
      valid_key: string | null;
    };
  };
  summary: {
    total_providers_configured: number;
    recommended_provider: string;
    needs_configuration: boolean;
  };
}

const APIKeyManager: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 配置表单状态
  const [config, setConfig] = useState<APIConfig>({
    provider: 'deepseek',
    api_key: '',
    base_url: '',
    model: ''
  });

  // 扫描环境变量
  const scanEnvironmentKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/config/scan-keys');
      const result = await response.json();
      if (result.success) {
        setScanResult(result.data);
        
        // 如果找到配置，自动选择推荐的提供商
        if (!result.data.summary.needs_configuration) {
          setConfig(prev => ({
            ...prev,
            provider: result.data.summary.recommended_provider
          }));
        }
      } else {
        setError(result.error || '扫描失败');
      }
    } catch (err) {
      setError('网络错误，无法扫描环境变量');
    } finally {
      setLoading(false);
    }
  };

  // 设置API密钥
  const setAPIKey = async () => {
    if (!config.api_key.trim()) {
      setError('请输入API密钥');
      return;
    }

    setConfiguring(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/config/set-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      const result = await response.json();
      if (result.success) {
        setSuccess(`${config.provider} API密钥配置成功！`);
        setConfig({ ...config, api_key: '' }); // 清空输入框
        // 重新扫描以更新状态
        await scanEnvironmentKeys();
      } else {
        setError(result.error || '配置失败');
      }
    } catch (err) {
      setError('网络错误，配置失败');
    } finally {
      setConfiguring(false);
    }
  };

  // 测试连接
  const testConnection = async () => {
    setTestingConnection(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/config/test-connection', {
        method: 'POST',
      });
      
      const result = await response.json();
      if (result.success) {
        setSuccess('AI服务连接测试成功！');
      } else {
        setError(result.error || '连接测试失败');
      }
    } catch (err) {
      setError('网络错误，无法测试连接');
    } finally {
      setTestingConnection(false);
    }
  };

  // 组件挂载时扫描环境变量
  useEffect(() => {
    if (isOpen) {
      scanEnvironmentKeys();
    }
  }, [isOpen]);

  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case 'deepseek': return 'DeepSeek';
      case 'openai': return 'OpenAI';
      case 'volcano': return '火山引擎';
      default: return provider;
    }
  };

  const getProviderDefaults = (provider: string) => {
    switch (provider) {
      case 'deepseek':
        return { base_url: 'https://api.deepseek.com', model: 'deepseek-chat' };
      case 'openai':
        return { base_url: 'https://api.openai.com/v1', model: 'gpt-4' };
      case 'volcano':
        return { base_url: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k-250115' };
      default:
        return { base_url: '', model: '' };
    }
  };

  const handleProviderChange = (provider: string) => {
    const defaults = getProviderDefaults(provider);
    setConfig({
      provider,
      api_key: config.api_key,
      base_url: defaults.base_url,
      model: defaults.model
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="API配置"
      >
        <Settings size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Key className="mr-2" size={20} />
              API密钥配置
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* 环境变量扫描结果 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin mr-2" size={20} />
              扫描环境变量中...
            </div>
          ) : scanResult && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">环境变量扫描结果</h3>
              
              {scanResult.summary.needs_configuration ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <AlertCircle className="text-yellow-600 mr-2" size={20} />
                    <span className="text-yellow-800">未找到有效的API密钥，需要手动配置</span>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <CheckCircle className="text-green-600 mr-2" size={20} />
                    <span className="text-green-800">
                      找到 {scanResult.summary.total_providers_configured} 个已配置的提供商，
                      推荐使用: {getProviderDisplayName(scanResult.summary.recommended_provider)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(scanResult.scan_result).map(([provider, info]) => (
                  <div
                    key={provider}
                    className={`border rounded-lg p-3 ${
                      info.found ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{getProviderDisplayName(provider)}</span>
                      {info.found ? (
                        <CheckCircle className="text-green-600" size={16} />
                      ) : (
                        <AlertCircle className="text-gray-400" size={16} />
                      )}
                    </div>
                    {info.keys.length > 0 ? (
                      <div className="text-sm text-gray-600">
                        {info.keys.map((key, index) => (
                          <div key={index} className={key.is_placeholder ? 'text-red-500' : 'text-green-600'}>
                            {key.name}: {key.is_placeholder ? '占位符' : key.preview}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">未找到配置</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 手动配置表单 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">手动配置API密钥</h3>
            
            <div className="space-y-4">
              {/* 选择提供商 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI提供商
                </label>
                <select
                  value={config.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="deepseek">DeepSeek (推荐)</option>
                  <option value="openai">OpenAI</option>
                  <option value="volcano">火山引擎</option>
                </select>
              </div>

              {/* API密钥 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API密钥 *
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    placeholder="请输入您的API密钥"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* 基础URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API基础URL (可选)
                </label>
                <input
                  type="text"
                  value={config.base_url}
                  onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                  placeholder="使用默认URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 模型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  模型名称 (可选)
                </label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  placeholder="使用默认模型"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* 错误和成功消息 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                {success}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={setAPIKey}
                disabled={configuring || !config.api_key.trim()}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {configuring ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    配置中...
                  </>
                ) : (
                  '保存配置'
                )}
              </button>
              
              <button
                onClick={testConnection}
                disabled={testingConnection}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    测试中...
                  </>
                ) : (
                  '测试连接'
                )}
              </button>
              
              <button
                onClick={scanEnvironmentKeys}
                disabled={loading}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                重新扫描
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeyManager;