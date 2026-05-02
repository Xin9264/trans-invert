import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, Key, Loader2, Settings } from 'lucide-react';
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from '../utils/api';

interface APIConfig {
  provider: 'deepseek';
  api_key: string;
  base_url?: string;
  model?: string;
}

interface ScanResult {
  scan_result: {
    deepseek: {
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
  const [config, setConfig] = useState<APIConfig>({
    provider: 'deepseek',
    api_key: '',
    base_url: DEEPSEEK_BASE_URL,
    model: DEEPSEEK_MODEL
  });

  const scanEnvironmentKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/config/scan-keys');
      const result = await response.json();
      if (result.success) {
        setScanResult(result.data);
      } else {
        setError(result.error || '扫描失败');
      }
    } catch {
      setError('网络错误，无法扫描环境变量');
    } finally {
      setLoading(false);
    }
  };

  const setAPIKey = async () => {
    if (!config.api_key.trim()) {
      setError('请输入DeepSeek API密钥');
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
        body: JSON.stringify({
          provider: 'deepseek',
          api_key: config.api_key,
          base_url: config.base_url,
          model: DEEPSEEK_MODEL
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSuccess('DeepSeek API密钥配置成功');
        setConfig({ ...config, api_key: '' });
        await scanEnvironmentKeys();
      } else {
        setError(result.error || '配置失败');
      }
    } catch {
      setError('网络错误，配置失败');
    } finally {
      setConfiguring(false);
    }
  };

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
        setSuccess('DeepSeek连接测试成功');
      } else {
        setError(result.error || '连接测试失败');
      }
    } catch {
      setError('网络错误，无法测试连接');
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      scanEnvironmentKeys();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="DeepSeek配置"
      >
        <Settings size={20} />
      </button>
    );
  }

  const deepseek = scanResult?.scan_result.deepseek;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Key className="mr-2" size={20} />
              DeepSeek API配置
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              x
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin mr-2" size={20} />
              扫描环境变量中...
            </div>
          ) : deepseek && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">环境变量扫描结果</h3>
              <div className={`border rounded-lg p-4 ${deepseek.found ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                <div className="flex items-center mb-2">
                  {deepseek.found ? (
                    <CheckCircle className="text-green-600 mr-2" size={20} />
                  ) : (
                    <AlertCircle className="text-yellow-600 mr-2" size={20} />
                  )}
                  <span className={deepseek.found ? 'text-green-800' : 'text-yellow-800'}>
                    {deepseek.found ? '已找到DeepSeek API密钥' : '未找到有效的DeepSeek API密钥'}
                  </span>
                </div>
                {deepseek.keys.length > 0 ? (
                  <div className="text-sm text-gray-600">
                    {deepseek.keys.map((key, index) => (
                      <div key={index} className={key.is_placeholder ? 'text-red-500' : 'text-green-600'}>
                        {key.name}: {key.is_placeholder ? '占位符' : key.preview}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">未找到 DEEPSEEK_API_KEY 或 DEEPSEEK_KEY</div>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">手动配置DeepSeek API密钥</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API密钥 *
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    placeholder="请输入DeepSeek API密钥"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API基础URL
                </label>
                <input
                  type="text"
                  value={config.base_url}
                  onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  模型
                </label>
                <input
                  type="text"
                  value={DEEPSEEK_MODEL}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>

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
