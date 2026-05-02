import React, { useEffect, useState } from 'react';
import {
  aiAPI,
  AIStatus,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  DEEPSEEK_PROVIDER,
  localStorageManager
} from '../utils/api';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose, onConfigured }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEEPSEEK_BASE_URL);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    loadAIStatus();
    const savedConfig = localStorageManager.getAIConfig();
    if (savedConfig) {
      setApiKey(savedConfig.api_key);
      setBaseUrl(savedConfig.base_url || DEEPSEEK_BASE_URL);
    } else {
      setApiKey('');
      setBaseUrl(DEEPSEEK_BASE_URL);
    }
  }, [isOpen]);

  const loadAIStatus = async () => {
    try {
      const response = await aiAPI.getStatus();
      if (response.success && response.data) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('获取DeepSeek状态失败:', error);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('请输入DeepSeek API密钥');
      return;
    }

    setLoading(true);
    try {
      const response = await aiAPI.configure({
        provider: DEEPSEEK_PROVIDER,
        api_key: apiKey.trim(),
        base_url: baseUrl || DEEPSEEK_BASE_URL,
        model: DEEPSEEK_MODEL
      });

      if (response.success) {
        alert('DeepSeek配置成功');
        await loadAIStatus();
        onConfigured();
        onClose();
      } else {
        alert(`配置失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('配置DeepSeek失败:', error);
      alert('配置失败，请检查网络连接或API密钥是否正确');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    localStorageManager.removeAIConfig();
    setApiKey('');
    setBaseUrl(DEEPSEEK_BASE_URL);
    loadAIStatus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">DeepSeek 配置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            x
          </button>
        </div>

        {status && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-800">
                  当前状态: {status.configured ? '已配置' : '未配置'}
                  {status.configured && ` (${status.model})`}
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

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              服务
            </label>
            <input
              type="text"
              value="DeepSeek"
              readOnly
              className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API密钥 *
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入DeepSeek API密钥"
              autoComplete="off"
              data-form-type="other"
              name="deepseek-api-key-input"
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
              模型
            </label>
            <input
              type="text"
              value={DEEPSEEK_MODEL}
              readOnly
              className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
            />
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3">
            <ul className="text-xs text-green-700 ml-4 list-disc">
              <li>API密钥仅保存在您的浏览器中</li>
              <li>模型固定为 DeepSeek V4 Pro</li>
              <li>配置保存后立即生效</li>
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
      </div>
    </div>
  );
};

export default AIConfigModal;
