import axios from 'axios';

// 在生产环境中使用相对路径，开发环境使用完整URL
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 
  ((import.meta as any).env?.MODE === 'production' ? '' : 'http://localhost:8000');

// 本地存储管理
export const localStorageManager = {
  // API配置相关
  getAIConfig: (): AIConfigData | null => {
    const config = localStorage.getItem('ai_config');
    return config ? JSON.parse(config) : null;
  },
  
  setAIConfig: (config: AIConfigData): void => {
    localStorage.setItem('ai_config', JSON.stringify(config));
  },
  
  removeAIConfig: (): void => {
    localStorage.removeItem('ai_config');
  },
  
  // 检查是否已配置API
  hasAIConfig: (): boolean => {
    const config = localStorageManager.getAIConfig();
    return config !== null && !!config.api_key;
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动添加用户的API配置到请求头
api.interceptors.request.use(
  (config) => {
    const aiConfig = localStorageManager.getAIConfig();
    if (aiConfig) {
      // 将用户的AI配置添加到请求头
      config.headers['X-AI-Provider'] = aiConfig.provider;
      config.headers['X-AI-Key'] = aiConfig.api_key;
      if (aiConfig.base_url) {
        config.headers['X-AI-Base-URL'] = aiConfig.base_url;
      }
      if (aiConfig.model) {
        config.headers['X-AI-Model'] = aiConfig.model;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器处理统一的API响应格式
api.interceptors.response.use(
  (response) => {
    // 如果是统一的API响应格式，直接返回data字段
    if (response.data && typeof response.data.success === 'boolean') {
      return response.data;
    }
    // 如果不是统一格式，包装成统一格式
    return {
      success: true,
      data: response.data
    };
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface TextUploadRequest {
  content: string;
  title?: string;
}

export interface DifficultWord {
  word: string;
  meaning: string;
}

export interface TextAnalysis {
  text_id: string;
  translation: string;
  difficult_words: DifficultWord[];
  difficulty: number;
  key_points: string[];
  word_count: number;
}

export interface PracticeSubmitRequest {
  text_id: string;
  user_input: string;
}

export interface PracticeEvaluation {
  score: number;
  corrections: Array<{
    original: string;
    suggestion: string;
    reason: string;
  }>;
  overall_feedback: string;
  is_acceptable: boolean;
}

export interface PracticeHistoryRecord {
  id: string;
  timestamp: string;
  text_title: string;
  text_content: string;
  chinese_translation: string;
  user_input: string;
  ai_evaluation: {
    score: number;
    corrections: Array<{
      original: string;
      suggestion: string;
      reason: string;
    }>;
    overall_feedback: string;
    is_acceptable: boolean;
  };
  score: number;
}

export interface PracticeHistoryExport {
  export_version: string;
  export_time: string;
  total_records: number;
  records: PracticeHistoryRecord[];
}

export const textAPI = {
  // 上传文本
  upload: async (request: TextUploadRequest): Promise<APIResponse<{ text_id: string; word_count: number }>> => {
    const response = await api.post('/api/texts/upload', request) as APIResponse<{ text_id: string; word_count: number }>;
    return response;
  },

  // 获取文本分析结果
  getAnalysis: async (textId: string): Promise<APIResponse<TextAnalysis>> => {
    const response = await api.get(`/api/texts/${textId}/analysis`) as APIResponse<TextAnalysis>;
    return response;
  },

  // 获取文本信息
  getById: async (textId: string, includeContent: boolean = false): Promise<APIResponse<any>> => {
    const response = await api.get(`/api/texts/${textId}?include_content=${includeContent}`) as APIResponse<any>;
    return response;
  },

  // 获取所有文本列表
  getAll: async (): Promise<APIResponse<any[]>> => {
    const response = await api.get('/api/texts/') as APIResponse<any[]>;
    return response;
  },

  // 导出练习材料
  exportMaterials: async (): Promise<Blob> => {
    const response = await api.get('/api/texts/materials/export', {
      responseType: 'blob'
    });
    return response as unknown as Blob;
  },

  // 导入练习材料
  importMaterials: async (data: any): Promise<APIResponse<any>> => {
    const response = await api.post('/api/texts/materials/import', data) as APIResponse<any>;
    return response;
  },

  // 删除练习材料
  deleteMaterial: async (textId: string): Promise<APIResponse<any>> => {
    const response = await api.delete(`/api/texts/${textId}`) as APIResponse<any>;
    return response;
  }
};

export const practiceAPI = {
  // 提交练习答案
  submit: async (request: PracticeSubmitRequest): Promise<APIResponse<PracticeEvaluation>> => {
    const response = await api.post('/api/texts/practice/submit', request) as APIResponse<PracticeEvaluation>;
    return response;
  },

  // 获取练习历史
  getHistory: async (): Promise<APIResponse<PracticeHistoryRecord[]>> => {
    const response = await api.get('/api/texts/practice/history') as APIResponse<PracticeHistoryRecord[]>;
    return response;
  },

  // 获取特定文本的练习历史
  getTextHistory: async (textId: string): Promise<APIResponse<PracticeHistoryRecord[]>> => {
    const response = await api.get(`/api/texts/${textId}/practice/history`) as APIResponse<PracticeHistoryRecord[]>;
    return response;
  },

  // 导出练习历史
  exportHistory: async (): Promise<Blob> => {
    const response = await api.get('/api/texts/practice/history/export', {
      responseType: 'blob'
    });
    return response as unknown as Blob;
  },

  // 导入练习历史
  importHistory: async (data: PracticeHistoryExport): Promise<APIResponse<any>> => {
    const response = await api.post('/api/texts/practice/history/import', { data }) as APIResponse<any>;
    return response;
  },

  // 流式提交练习答案
  submitStream: async (
    request: PracticeSubmitRequest,
    onProgress: (progress: number, content?: string) => void,
    onComplete: (result: PracticeEvaluation) => void,
    onError: (error: string) => void
  ): Promise<void> => {
    let lastProgress = 0;
    let lastProgressTime = Date.now();
    let stuckCheckTimer: number | null = null;

    const cleanupTimer = () => {
      if (stuckCheckTimer) {
        clearTimeout(stuckCheckTimer);
        stuckCheckTimer = null;
      }
    };

    try {
      // 获取用户的AI配置
      const aiConfig = localStorageManager.getAIConfig();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 添加AI配置到请求头
      if (aiConfig) {
        headers['X-AI-Provider'] = aiConfig.provider;
        headers['X-AI-Key'] = aiConfig.api_key;
        if (aiConfig.base_url) {
          headers['X-AI-Base-URL'] = aiConfig.base_url;
        }
        if (aiConfig.model) {
          headers['X-AI-Model'] = aiConfig.model;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/texts/practice/submit-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // 移除 'data: ' 前缀
            
            if (data.trim() === '[DONE]') {
              cleanupTimer();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'progress') {
                const currentProgress = parsed.progress || 0;
                const currentTime = Date.now();
                
                // 检测进度是否卡住 - 进度大于90%且超过15秒没有变化
                if (currentProgress >= 90 && currentProgress === lastProgress) {
                  if (currentTime - lastProgressTime > 15000) {
                    cleanupTimer();
                    onError('AI评估进度卡住，请重试');
                    return;
                  }
                } else {
                  // 进度有变化，更新记录
                  lastProgress = currentProgress;
                  lastProgressTime = currentTime;
                }
                
                // 设置卡住检测定时器
                if (currentProgress >= 90 && !stuckCheckTimer) {
                  stuckCheckTimer = setTimeout(() => {
                    console.warn('检测到进度可能卡住，触发超时');
                    onError('AI评估响应超时，请重试');
                  }, 20000); // 20秒超时
                }
                
                onProgress(currentProgress, parsed.content);
              } else if (parsed.type === 'complete') {
                cleanupTimer();
                onComplete(parsed.result);
                return;
              } else if (parsed.type === 'error') {
                cleanupTimer();
                onError(parsed.error);
                return;
              }
            } catch (e) {
              console.warn('解析流式数据失败:', e, data);
            }
          }
        }
      }
    } catch (error) {
      cleanupTimer();
      console.error('流式请求失败:', error);
      onError(error instanceof Error ? error.message : '未知错误');
    }
  }
};

export const healthAPI = {
  // 健康检查
  check: async (): Promise<APIResponse<any>> => {
    const response = await api.get('/health') as APIResponse<any>;
    return response;
  }
};

export interface AIStatus {
  configured: boolean;
  provider: string;
  model: string;
  api_key_preview: string;
}

export interface AIConfigData {
  provider: string;
  api_key: string;
  base_url?: string;
  model?: string;
}

export const aiAPI = {
  // 获取当前浏览器中的AI配置状态
  getStatus: async (): Promise<APIResponse<AIStatus>> => {
    const config = localStorageManager.getAIConfig();
    if (config) {
      return {
        success: true,
        data: {
          configured: true,
          provider: config.provider,
          model: config.model || '',
          api_key_preview: '***已在浏览器中配置***'
        }
      };
    } else {
      return {
        success: true,
        data: {
          configured: false,
          provider: '',
          model: '',
          api_key_preview: '未配置'
        }
      };
    }
  },

  // 配置AI服务（保存到浏览器本地存储）
  configure: async (config: AIConfigData): Promise<APIResponse<any>> => {
    try {
      // 验证配置
      if (!config.provider || !config.api_key) {
        return {
          success: false,
          message: '提供商和API密钥不能为空'
        };
      }

      // 保存到本地存储
      localStorageManager.setAIConfig(config);
      
      return {
        success: true,
        message: 'AI配置已保存到浏览器本地存储'
      };
    } catch (error) {
      return {
        success: false,
        message: '保存配置失败: ' + (error instanceof Error ? error.message : '未知错误')
      };
    }
  },

  // 获取浏览器中已配置的提供商
  getProviders: async (): Promise<APIResponse<any>> => {
    const config = localStorageManager.getAIConfig();
    if (config) {
      return {
        success: true,
        data: {
          [config.provider]: {
            provider: config.provider,
            model: config.model || '',
            base_url: config.base_url || '',
            api_key_configured: true,
            api_key_preview: '***浏览器本地存储***'
          }
        }
      };
    } else {
      return {
        success: true,
        data: {}
      };
    }
  },

  // 切换提供商（从本地存储中的配置）
  switchProvider: async (provider: string): Promise<APIResponse<any>> => {
    const config = localStorageManager.getAIConfig();
    if (config && config.provider === provider) {
      return {
        success: true,
        message: `已使用 ${provider} 提供商`
      };
    } else {
      return {
        success: false,
        message: '提供商配置不存在'
      };
    }
  },

  // 清除本地AI配置
  clearConfig: async (): Promise<APIResponse<any>> => {
    try {
      localStorageManager.removeAIConfig();
      return {
        success: true,
        message: '已清除本地AI配置'
      };
    } catch (error) {
      return {
        success: false,
        message: '清除配置失败'
      };
    }
  }
};

export default api;