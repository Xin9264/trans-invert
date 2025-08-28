import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Home, Upload, History, Settings, AlertTriangle } from 'lucide-react';
import { useAIStatus } from '../hooks/useAIStatus';
import AIConfigModal from './AIConfigModal';

const Layout: React.FC = () => {
  const [showAIConfig, setShowAIConfig] = useState(false);
  const { status, loading, error, refresh, isConfigured } = useAIStatus();

  const handleConfigured = () => {
    refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-primary-600">
                Trans Invert
              </Link>
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100 transition-colors"
                >
                  <Home size={18} />
                  <span>首页</span>
                </Link>
                <Link
                  to="/upload"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100 transition-colors"
                >
                  <Upload size={18} />
                  <span>上传文本</span>
                </Link>
                <Link
                  to="/history"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100 transition-colors"
                >
                  <History size={18} />
                  <span>练习历史</span>
                </Link>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAIConfig(true)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  !isConfigured
                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-100'
                }`}
                title="AI服务配置"
              >
                {!isConfigured ? (
                  <AlertTriangle size={18} className="text-red-500" />
                ) : (
                  <Settings size={18} />
                )}
                <span>AI配置</span>
              </button>
              
              <div className="text-sm text-gray-600">
                回译法语言练习平台
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* AI配置警告横幅 */}
      {!loading && !isConfigured && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={20} className="text-red-500" />
                <span className="text-red-800 font-medium">
                  AI服务未配置，部分功能可能无法正常使用
                </span>
              </div>
              <button
                onClick={() => setShowAIConfig(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                立即配置
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <AIConfigModal
        isOpen={showAIConfig}
        onClose={() => setShowAIConfig(false)}
        onConfigured={handleConfigured}
      />
    </div>
  );
};

export default Layout;
