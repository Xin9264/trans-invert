import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器处理统一的API响应格式
api.interceptors.response.use(
  (response) => {
    // 如果是统一的API响应格式，直接返回data字段
    if (response.data && typeof response.data.success === 'boolean') {
      return response.data;
    }
    return response.data;
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
    const response = await api.post('/api/texts/upload', request);
    return response;
  },

  // 获取文本分析结果
  getAnalysis: async (textId: string): Promise<APIResponse<TextAnalysis>> => {
    const response = await api.get(`/api/texts/${textId}/analysis`);
    return response;
  },

  // 获取文本信息
  getById: async (textId: string, includeContent: boolean = false): Promise<APIResponse<any>> => {
    const response = await api.get(`/api/texts/${textId}?include_content=${includeContent}`);
    return response;
  },

  // 获取所有文本列表
  getAll: async (): Promise<APIResponse<any[]>> => {
    const response = await api.get('/api/texts/');
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
    const response = await api.post('/api/texts/materials/import', data);
    return response;
  },

  // 删除练习材料
  deleteMaterial: async (textId: string): Promise<APIResponse<any>> => {
    const response = await api.delete(`/api/texts/${textId}`);
    return response;
  }
};

export const practiceAPI = {
  // 提交练习答案
  submit: async (request: PracticeSubmitRequest): Promise<APIResponse<PracticeEvaluation>> => {
    const response = await api.post('/api/texts/practice/submit', request);
    return response;
  },

  // 获取练习历史
  getHistory: async (): Promise<APIResponse<PracticeHistoryRecord[]>> => {
    const response = await api.get('/api/texts/practice/history');
    return response;
  },

  // 获取特定文本的练习历史
  getTextHistory: async (textId: string): Promise<APIResponse<PracticeHistoryRecord[]>> => {
    const response = await api.get(`/api/texts/${textId}/practice/history`);
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
    const response = await api.post('/api/texts/practice/history/import', { data });
    return response;
  },

  // 流式提交练习答案
  submitStream: async (
    request: PracticeSubmitRequest,
    onProgress: (progress: number, content?: string) => void,
    onComplete: (result: PracticeEvaluation) => void,
    onError: (error: string) => void
  ): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/texts/practice/submit-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'progress') {
                onProgress(parsed.progress, parsed.content);
              } else if (parsed.type === 'complete') {
                onComplete(parsed.result);
                return;
              } else if (parsed.type === 'error') {
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
      console.error('流式请求失败:', error);
      onError(error instanceof Error ? error.message : '未知错误');
    }
  }
};

export const healthAPI = {
  // 健康检查
  check: async (): Promise<APIResponse<any>> => {
    const response = await api.get('/health');
    return response;
  }
};

export default api;