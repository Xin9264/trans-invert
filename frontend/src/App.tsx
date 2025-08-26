import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Practice from './pages/Practice';
import History from './pages/History';

function App() {
  // 简化版本：移除认证系统，直接显示主要功能
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="upload" element={<Upload />} />
          <Route path="practice/:id" element={<Practice />} />
          <Route path="history" element={<History />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
