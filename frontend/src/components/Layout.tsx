import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Home, Upload, History, Settings, AlertTriangle, FileText, Brain } from 'lucide-react';
import { useAIStatus } from '../hooks/useAIStatus';
import AIConfigModal from './AIConfigModal';

const Layout: React.FC = () => {
  const [showAIConfig, setShowAIConfig] = useState(false);
  const { loading, refresh, isConfigured } = useAIStatus();

  const handleConfigured = () => {
    refresh();
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <nav className="shadow-soft border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold font-heading bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Trans Invert
              </Link>
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 hover:shadow-soft hover:bg-primary hover:text-primary-foreground"
                  style={{ 
                    color: 'var(--foreground)'
                  }}
                >
                  <Home size={18} />
                  <span>首页</span>
                </Link>
                <Link
                  to="/upload"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 hover:shadow-soft hover:bg-primary hover:text-primary-foreground"
                  style={{ 
                    color: 'var(--foreground)'
                  }}
                >
                  <Upload size={18} />
                  <span>上传文本</span>
                </Link>
                <Link
                  to="/essay"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 hover:shadow-soft hover:bg-primary hover:text-primary-foreground"
                  style={{ 
                    color: 'var(--foreground)'
                  }}
                >
                  <FileText size={18} />
                  <span>作文练习</span>
                </Link>
                <Link
                  to="/review"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 hover:shadow-soft hover:bg-primary hover:text-primary-foreground"
                  style={{ 
                    color: 'var(--foreground)'
                  }}
                >
                  <Brain size={18} />
                  <span>智能复习</span>
                </Link>
                <Link
                  to="/history"
                  className="flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 hover:shadow-soft hover:bg-primary hover:text-primary-foreground"
                  style={{ 
                    color: 'var(--foreground)'
                  }}
                >
                  <History size={18} />
                  <span>练习历史</span>
                </Link>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAIConfig(true)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 hover:shadow-soft ${
                  !isConfigured
                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                    : 'hover:bg-primary hover:text-primary-foreground'
                }`}
                style={{
                  color: !isConfigured ? 'var(--destructive)' : 'var(--foreground)'
                }}
                title="AI服务配置"
              >
                {!isConfigured ? (
                  <AlertTriangle size={18} style={{ color: 'var(--destructive)' }} />
                ) : (
                  <Settings size={18} />
                )}
                <span>AI配置</span>
              </button>
              
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                回译法语言练习平台
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* AI配置警告横幅 */}
      {!loading && !isConfigured && (
        <div className="border-b" style={{ backgroundColor: 'var(--destructive)', borderColor: 'var(--border)', color: 'var(--destructive-foreground)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={20} style={{ color: 'var(--destructive-foreground)' }} />
                <span className="font-medium">
                  AI服务未配置，部分功能可能无法正常使用
                </span>
              </div>
              <button
                onClick={() => setShowAIConfig(true)}
                className="px-4 py-2 rounded-md transition-all duration-200 shadow-soft hover:shadow-glow hover:brightness-90"
                style={{ 
                  backgroundColor: 'var(--destructive-foreground)', 
                  color: 'var(--destructive)'
                }}
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
