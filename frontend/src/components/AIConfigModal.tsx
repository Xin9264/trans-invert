import React, { useState, useEffect } from 'react';
import { aiAPI, AIStatus } from '../utils/api';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose, onConfigured }) => {
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<any>({});
  const [showNewConfig, setShowNewConfig] = useState(false);

  const providerConfigs = {
    deepseek: {
      name: 'DeepSeek',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      description: 'DeepSeek AI 提供商 - 高性价比的AI模型'
    },
    volcano: {
      name: '火山引擎',
      defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: 'doubao-1-5-pro-32k-250115',
      description: '字节跳动旗下的火山引擎AI服务'
    },
    openai: {
      name: 'OpenAI',
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4.1',
      description: 'OpenAI官方API服务'
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAIStatus();
      loadConfiguredProviders();
      // 设置默认值
      const config = providerConfigs[provider as keyof typeof providerConfigs];
      setBaseUrl(config.defaultBaseUrl);
      setModel(config.defaultModel);
    }
  }, [isOpen, provider]);

  const loadAIStatus = async () => {
    try {
      const response = await aiAPI.getStatus();
      if (response.success && response.data) {
        setStatus(response.data);
        // 不自动设置提供商，让用户可以自由选择
        // setProvider(response.data.provider);
      }
    } catch (error) {
      console.error('获取AI状态失败:', error);
    }
  };

  const loadConfiguredProviders = async () => {
    try {
      const response = await aiAPI.getProviders();
      if (response.success && response.data) {
        setConfiguredProviders(response.data);
      }
    } catch (error) {
      console.error('获取已配置提供商失败:', error);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const config = providerConfigs[newProvider as keyof typeof providerConfigs];
    setBaseUrl(config.defaultBaseUrl);
    setModel(config.defaultModel);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('请输入API密钥');
      return;
    }

    setLoading(true);
    try {
      const response = await aiAPI.configure({
        provider,
        api_key: apiKey,
        base_url: baseUrl,
        model
      });

      if (response.success) {
        alert('AI服务配置成功！');
        // 立即刷新状态
        await loadAIStatus();
        onConfigured();
        onClose();
      } else {
        alert(`配置失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('配置AI服务失败:', error);
      alert('配置失败，请检查网络连接或API密钥是否正确');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setApiKey('');
    setProvider('deepseek');
    const config = providerConfigs.deepseek;
    setBaseUrl(config.defaultBaseUrl);
    setModel(config.defaultModel);
    setShowNewConfig(true);
  };

  const handleSwitchProvider = async (providerName: string) => {
    setLoading(true);
    try {
      const response = await aiAPI.switchProvider(providerName);
      if (response.success) {
        alert(`已切换到 ${providerName}！`);
        await loadAIStatus();
        onConfigured();
        onClose();
      } else {
        alert(`切换失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('切换提供商失败:', error);
      alert('切换失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">AI服务配置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {status && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-800">
                  当前状态: {status.configured ? '已配置' : '未配置'} 
                  {status.configured && ` (${status.provider} - ${status.model})`}
                </p>
                {status.configured && (
                  <p className="text-xs text-blue-600 mt-1">
                    API密钥: {status.api_key_preview}
                  </p>
                )}
              </div>
              {status.configured && (
                <button
                  onClick={handleReset}
                  className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                >
                  重新配置
                </button>
              )}
            </div>
          </div>
        )}

        {/* 已配置的提供商 */}
        {Object.keys(configuredProviders).length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">已配置的AI提供商</h3>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(configuredProviders).map(([providerKey, providerData]: [string, any]) => (
                <div key={providerKey} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{providerConfigs[providerKey as keyof typeof providerConfigs]?.name || providerKey}</span>
                      {status?.provider === providerKey && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">当前使用</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{providerData.model}</p>
                    <p className="text-xs text-gray-500">{providerData.api_key_preview}</p>
                  </div>
                  <button
                    onClick={() => handleSwitchProvider(providerKey)}
                    disabled={loading || status?.provider === providerKey}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status?.provider === providerKey ? '使用中' : '切换'}
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowNewConfig(!showNewConfig)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showNewConfig ? '隐藏新配置' : '+ 添加新的AI提供商'}
              </button>
            </div>
          </div>
        )}

        {/* 新配置表单 */}
        {(Object.keys(configuredProviders).length === 0 || showNewConfig) && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI提供商
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(providerConfigs).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {providerConfigs[provider as keyof typeof providerConfigs].description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API密钥 *
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入API密钥"
              autoComplete="off"
              data-form-type="other"
              name="api-key-input"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API基础URL
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="API基础URL"
                disabled={!isEditingUrl}
                className={`flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!isEditingUrl ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              />
              <button
                type="button"
                onClick={() => setIsEditingUrl(!isEditingUrl)}
                className="px-3 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                {isEditingUrl ? '锁定' : '编辑'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              模型名称
            </label>
            <input
              type="text"
              value={model}
              readOnly
              placeholder="模型名称"
              className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              模型名称由选择的提供商自动设定
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-sm text-green-800">
              💡 提示：
            </p>
            <ul className="text-xs text-green-700 mt-1 ml-4 list-disc">
              <li>配置将立即生效，无需重启服务</li>
              <li>可以随时切换不同的AI提供商</li>
              <li>新配置会覆盖环境变量中的设置</li>
            </ul>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : '保存配置'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
            >
              取消
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default AIConfigModal;