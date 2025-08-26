import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Home, Upload, History } from 'lucide-react';

const Layout: React.FC = () => {
  // 简化版本：移除用户认证相关功能

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
              <div className="text-sm text-gray-600">
                回译法语言练习平台
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
