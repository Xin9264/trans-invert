import axios from 'axios';

// 本地自用：始终走相对路径，由 Vite 代理转发到 http://localhost:8000
const API_BASE_URL = '';
export const DEEPSEEK_PROVIDER = 'deepseek';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const DEEPSEEK_MODEL = 'deepseek-v4-pro';

// 本地存储管理
export const localStorageManager = {
  // API配置相关
  getAIConfig: (): AIConfigData | null => {
    const config = localStorage.getItem('ai_config');
    if (!config) return null;
    const parsed = JSON.parse(config);
    if (parsed.provider && parsed.provider !== DEEPSEEK_PROVIDER) {
      return null;
    }
    return {
      provider: DEEPSEEK_PROVIDER,
      api_key: parsed.api_key || '',
      base_url: parsed.base_url || DEEPSEEK_BASE_URL,
      model: DEEPSEEK_MODEL
    };
  },
  
  setAIConfig: (config: AIConfigData): void => {
    localStorage.setItem('ai_config', JSON.stringify({
      provider: DEEPSEEK_PROVIDER,
      api_key: config.api_key,
      base_url: config.base_url || DEEPSEEK_BASE_URL,
      model: DEEPSEEK_MODEL
    }));
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
      // 将用户的DeepSeek配置添加到请求头
      config.headers['X-AI-Provider'] = DEEPSEEK_PROVIDER;
      config.headers['X-AI-Key'] = aiConfig.api_key;
      if (aiConfig.base_url) {
        config.headers['X-AI-Base-URL'] = aiConfig.base_url;
      }
      config.headers['X-AI-Model'] = DEEPSEEK_MODEL;
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
  practice_type?: string;
  topic?: string;
  folder_id?: string;
}

export interface DifficultWord {
  word: string;
  meaning: string;
}

export interface ContrastiveNote {
  point: string;
  en_example: string;
  zh_in_translation: string;
  hint: string;
}

export interface AlignedSegment {
  en: string;
  zh: string;
}

export interface TextAnalysis {
  text_id: string;
  translation: string;
  difficult_words: DifficultWord[];
  difficulty: number;
  key_points: string[];
  word_count: number;
  contrastive_notes?: ContrastiveNote[];
  aligned_segments?: AlignedSegment[];
}

export interface PracticeSubmitRequest {
  text_id: string;
  user_input: string;
  // 句段对齐模式：传给后端，让 evaluate 只针对单句
  segment_en?: string;
  segment_zh?: string;
  segment_index?: number;
  segment_total?: number;
}

export type CorrectionSeverity = 'minor' | 'major' | 'critical';
export type CorrectionSource =
  | 'L1_transfer'
  | 'overgeneralization'
  | 'intralingual'
  | 'performance_slip';

export interface Correction {
  original: string;
  suggestion: string;
  reason: string;
  category: string;          // grammar.* / lexis.* / discourse.* / mechanics.*
  severity: CorrectionSeverity;
  source: CorrectionSource;
}

export interface PracticeEvaluation {
  score: number;
  corrections: Correction[];
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
    corrections: Correction[];
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

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  children?: Folder[];
  child_count?: number;
}

export const folderAPI = {
  // 获取所有文件夹
  getAll: async (): Promise<APIResponse<Folder[]>> => {
    const response = await api.get('/api/folders/') as APIResponse<Folder[]>;
    return response;
  },

  // 获取文件夹树形结构
  getTree: async (): Promise<APIResponse<Folder[]>> => {
    const response = await api.get('/api/folders/tree/all') as APIResponse<Folder[]>;
    return response;
  },

  // 获取单个文件夹信息
  getById: async (folderId: string): Promise<APIResponse<Folder>> => {
    const response = await api.get(`/api/folders/${folderId}`) as APIResponse<Folder>;
    return response;
  },

  // 创建文件夹
  create: async (folderData: { name: string; parent_id?: string }): Promise<APIResponse<Folder>> => {
    const response = await api.post('/api/folders/', folderData) as APIResponse<Folder>;
    return response;
  },

  // 更新文件夹
  update: async (folderId: string, folderData: { name?: string; parent_id?: string }): Promise<APIResponse<Folder>> => {
    const response = await api.put(`/api/folders/${folderId}`, folderData) as APIResponse<Folder>;
    return response;
  },

  // 删除文件夹
  delete: async (folderId: string, force: boolean = false): Promise<APIResponse<any>> => {
    const response = await api.delete(`/api/folders/${folderId}?force=${force}`) as APIResponse<any>;
    return response;
  }
};

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

  // 获取所有文本列表（支持按文件夹筛选）
  getAll: async (folderId?: string): Promise<APIResponse<any[]>> => {
    const url = folderId ? `/api/texts/?folder_id=${folderId}` : '/api/texts/';
    const response = await api.get(url) as APIResponse<any[]>;
    return response;
  },

  // 移动文本到文件夹
  moveToFolder: async (textId: string, folderId?: string): Promise<APIResponse<any>> => {
    const response = await api.post(`/api/texts/${textId}/move`, { folder_id: folderId }) as APIResponse<any>;
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
  },

  // 流式上传：实时返回分析进度
  uploadStream: async (
    request: TextUploadRequest,
    onProgress: (progress: number, fullContent: string) => void,
    onComplete: (textId: string) => void,
    onError: (error: string) => void,
    onInit?: (textId: string, wordCount: number) => void
  ): Promise<void> => {
    try {
      const aiConfig = localStorageManager.getAIConfig();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (aiConfig) {
        headers['X-AI-Provider'] = DEEPSEEK_PROVIDER;
        headers['X-AI-Key'] = aiConfig.api_key;
        if (aiConfig.base_url) headers['X-AI-Base-URL'] = aiConfig.base_url;
        headers['X-AI-Model'] = DEEPSEEK_MODEL;
      }

      const response = await fetch(`${API_BASE_URL}/api/texts/upload-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data.trim() === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'init') {
              onInit?.(parsed.text_id, parsed.word_count);
              onProgress(parsed.progress || 0, '');
            } else if (parsed.type === 'progress') {
              onProgress(parsed.progress || 0, parsed.full_content || '');
            } else if (parsed.type === 'complete') {
              onProgress(100, parsed.full_content || '');
              onComplete(parsed.text_id);
              return;
            } else if (parsed.type === 'error') {
              onError(parsed.error || '分析失败');
              return;
            }
          } catch (parseErr) {
            console.warn('解析流式数据失败:', parseErr, data);
          }
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : '未知错误');
    }
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
      // 获取用户的DeepSeek配置
      const aiConfig = localStorageManager.getAIConfig();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 添加DeepSeek配置到请求头
      if (aiConfig) {
        headers['X-AI-Provider'] = DEEPSEEK_PROVIDER;
        headers['X-AI-Key'] = aiConfig.api_key;
        if (aiConfig.base_url) {
          headers['X-AI-Base-URL'] = aiConfig.base_url;
        }
        headers['X-AI-Model'] = DEEPSEEK_MODEL;
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
          provider: DEEPSEEK_PROVIDER,
          model: DEEPSEEK_MODEL,
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

  // 配置DeepSeek（保存到浏览器本地存储）
  configure: async (config: AIConfigData): Promise<APIResponse<any>> => {
    try {
      // 验证配置
      if (!config.api_key) {
        return {
          success: false,
          message: 'DeepSeek API密钥不能为空'
        };
      }

      // 保存到本地存储
      localStorageManager.setAIConfig({
        provider: DEEPSEEK_PROVIDER,
        api_key: config.api_key,
        base_url: config.base_url || DEEPSEEK_BASE_URL,
        model: DEEPSEEK_MODEL
      });
      
      return {
        success: true,
        message: 'DeepSeek配置已保存到浏览器本地存储'
      };
    } catch (error) {
      return {
        success: false,
        message: '保存配置失败: ' + (error instanceof Error ? error.message : '未知错误')
      };
    }
  },

  // 获取浏览器中已配置的DeepSeek信息
  getProviders: async (): Promise<APIResponse<any>> => {
    const config = localStorageManager.getAIConfig();
    if (config) {
      return {
        success: true,
      data: {
          [DEEPSEEK_PROVIDER]: {
            provider: DEEPSEEK_PROVIDER,
            model: DEEPSEEK_MODEL,
            base_url: config.base_url || DEEPSEEK_BASE_URL,
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

  // 兼容旧调用：当前版本只支持DeepSeek
  switchProvider: async (provider: string): Promise<APIResponse<any>> => {
    const config = localStorageManager.getAIConfig();
    if (config && provider === DEEPSEEK_PROVIDER) {
      return {
        success: true,
        message: '已使用 DeepSeek'
      };
    } else {
      return {
        success: false,
        message: 'DeepSeek配置不存在'
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

// 复习相关接口
export interface ReviewStats {
  total_practiced: number;
  need_review: number;
  mastered: number;
  focus_areas: string[];
  recent_errors: any[];
}

export interface DueReviewItem {
  id: string;
  timestamp: string;
  text_title: string;
  score: number;
  review_count: number;
  last_reviewed: string | null;
  next_review_at: string | null;
  overdue_days: number;
  error_categories: string[];
  overall_feedback: string;
}

export interface DueReviewsResponse {
  due: DueReviewItem[];
  total: number;
}

export interface ReviewMaterial {
  text_id: string;
  review_article: string;
  analysis_summary: {
    total_records: number;
    focus_areas: string[];
    recent_errors: any[];
  };
}

export const reviewAPI = {
  // 获取复习统计
  getStats: async (): Promise<APIResponse<ReviewStats>> => {
    const response = await api.get('/api/review/stats') as APIResponse<ReviewStats>;
    return response;
  },

  // 生成复习材料
  generate: async (): Promise<APIResponse<ReviewMaterial>> => {
    const response = await api.post('/api/review/generate') as APIResponse<ReviewMaterial>;
    return response;
  },

  // 到期复习列表
  getDue: async (limit = 20): Promise<APIResponse<DueReviewsResponse>> => {
    const response = await api.get(`/api/review/due?limit=${limit}`) as APIResponse<DueReviewsResponse>;
    return response;
  },

  // 标记复习完成
  markReviewed: async (textId: string): Promise<APIResponse<any>> => {
    const response = await api.post(`/api/review/mark/${textId}`) as APIResponse<any>;
    return response;
  }
};

export default api;
