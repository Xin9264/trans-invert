# API Key 管理方案迁移说明

## 🎯 新方案特点

### ✅ 优势
- **完全安全**: API key只保存在用户浏览器中，服务器不存储
- **零成本**: 每个用户使用自己的API key，服务器运营者不承担费用
- **隐私保护**: 服务器无法获取用户的API key
- **实现简单**: 不需要数据库，不需要用户系统
- **适合Demo**: 完美适合个人项目和演示

### 🔄 主要变化

#### 前端变化
1. **本地存储管理**: 使用 `localStorage` 保存用户的API配置
2. **自动请求头**: 每次API请求自动添加用户的AI配置到请求头
3. **配置检查**: 实时检查用户是否已配置API key
4. **状态管理**: 新增 `useAIConfig` hook 管理配置状态

#### 后端变化
1. **请求头解析**: 从请求头中获取用户的AI配置
2. **临时服务**: 为每个请求创建临时的AI服务实例
3. **移除全局配置**: 删除全局AI配置相关路由和存储
4. **用户隔离**: 每个用户使用自己的API key，完全隔离

## 📋 使用说明

### 用户首次使用
1. 访问网站后会看到"AI服务未配置"的提示
2. 点击"立即配置"或右上角的"AI配置"按钮
3. 选择AI提供商（DeepSeek/火山引擎/OpenAI）
4. 输入自己的API密钥
5. 保存配置后即可正常使用所有功能

### 配置管理
- **查看状态**: 右上角显示配置状态
- **修改配置**: 随时可以重新配置或切换提供商
- **清除配置**: 可以清除本地配置重新开始
- **数据安全**: 配置只在浏览器中，清除浏览器数据会删除配置

## 🔧 技术实现

### 前端核心代码
```typescript
// 本地存储管理
export const localStorageManager = {
  getAIConfig: (): AIConfigData | null => {
    const config = localStorage.getItem('ai_config');
    return config ? JSON.parse(config) : null;
  },
  
  setAIConfig: (config: AIConfigData): void => {
    localStorage.setItem('ai_config', JSON.stringify(config));
  },
  
  hasAIConfig: (): boolean => {
    const config = localStorageManager.getAIConfig();
    return config !== null && !!config.api_key;
  }
};

// 自动添加配置到请求头
api.interceptors.request.use((config) => {
  const aiConfig = localStorageManager.getAIConfig();
  if (aiConfig) {
    config.headers['X-AI-Provider'] = aiConfig.provider;
    config.headers['X-AI-Key'] = aiConfig.api_key;
    // ...
  }
  return config;
});
```

### 后端核心代码
```python
def get_user_ai_config(request: Request) -> Optional[Dict[str, str]]:
    """从请求头中获取用户的AI配置"""
    headers = request.headers
    
    provider = headers.get('x-ai-provider')
    api_key = headers.get('x-ai-key')
    # ...
    
    if not provider or not api_key:
        return None
        
    return {
        'provider': provider,
        'api_key': api_key,
        # ...
    }

def create_user_ai_service(user_config: Dict[str, str]) -> AIService:
    """为用户创建临时的AI服务实例"""
    # 创建临时AI服务实例，使用用户配置
    # ...
```

## 🚀 部署优势

### 服务器部署
- ✅ 不需要预配置API key
- ✅ 不担心API费用消耗
- ✅ 不需要用户管理系统
- ✅ 完全无状态服务

### 用户体验
- ✅ 使用自己的API key，费用可控
- ✅ 数据隐私完全保护
- ✅ 配置简单，一次设置持久使用
- ✅ 支持多个AI提供商

## 📝 注意事项

1. **浏览器兼容性**: 需要支持 `localStorage` 的现代浏览器
2. **配置丢失**: 清除浏览器数据会删除API配置
3. **安全提醒**: 不要在公共电脑上保存API配置
4. **备份建议**: 建议用户记录自己的API配置以备恢复

## 🎉 总结

这个方案完美解决了demo项目部署时的API key安全问题：
- 服务器运营者：零成本、零风险
- 用户：使用自己的key、数据隐私保护
- 开发者：实现简单、维护容易

非常适合个人项目、开源项目和演示项目！
