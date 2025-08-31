## 新功能：智能复习模式

### 功能概述

基于用户的练习历史数据，通过AI分析生成个性化的复习材料，形成闭环学习体验。

### 核心思路

```
今日复习页面 → 点击复习按键 → 复习模型读取practice_history.json → 
输出英文文章 → 分析模型生成中文翻译 → 变成新的练习材料 → 正常回译流程
```

### 技术实现方案

#### 1. 数据结构扩展

```python
# 在 practice_history.json 中为每条记录添加复习次数字段
class PracticeHistoryRecord:
    # 现有字段...
    review_count: int = 0  # 新增：复习次数
    last_reviewed: Optional[str] = None  # 新增：最后复习时间
    error_patterns: List[str] = []  # 新增：错误模式标记
```

#### 2. 复习分析AI模型

**后端API端点**: `/api/review/generate`

**复习分析Prompt（优化版）**:
```text
你是一名专业的英语学习顾问。请分析用户的英文回译练习记录，生成一篇个性化的复习文章。

## 输入数据
你将收到用户的练习历史JSON数据，包含：
- 原文、中文翻译、用户回译
- AI评估结果和错误修正
- 复习次数和时间戳

## 输出要求
1. **文章长度**: 严格控制在100-150词
2. **内容重点**: 
   - 总结用户的核心语法问题（时态、语法结构、固定搭配）
   - 分析高频错误模式而非逐一罗列
   - 重点关注复习次数少的材料中的错误
3. **优先级策略**:
   - 复习次数≤2的材料：高优先级
   - 近期错误（7天内）：中等优先级  
   - 复习次数≥5的材料：低优先级
4. **语言风格**: 
   - 使用鼓励性但专业的学术语气
   - 提供具体的改进建议
   - 避免技术术语，注重实用性

## 文章结构
新概念课文风格，聚焦用户错误的语法点、不要太多生僻词。

只输出英文文章内容，无需其他解释。
```

#### 3. 后端实现

```python
# backend/app/routers/review.py
from typing import Dict, Any, List
import json
from datetime import datetime, timedelta
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/review", tags=["review"])

@router.post("/generate", response_model=APIResponse)
async def generate_review_material(http_request: Request):
    """生成个性化复习材料"""
    try:
        # 获取用户AI配置
        user_config = get_user_ai_config(http_request)
        if not user_config:
            raise HTTPException(status_code=400, detail="请先配置AI服务")
        
        # 加载练习历史
        history_data = data_persistence.load_practice_history()
        
        # 分析用户错误模式
        analysis_data = analyze_user_patterns(history_data)
        
        # 生成复习文章
        user_ai_service = create_user_ai_service(user_config)
        review_article = await user_ai_service.generate_review_article(analysis_data)
        
        # 分析生成的文章获得中文翻译
        article_analysis = await user_ai_service.analyze_text(review_article)
        
        # 创建新的练习材料
        text_id = str(uuid.uuid4())
        texts_storage[text_id] = {
            "id": text_id,
            "title": f"复习材料_{datetime.now().strftime('%m%d')}",
            "content": review_article,
            "word_count": len(review_article.split()),
            "created_at": datetime.now().isoformat(),
            "practice_type": "review",
            "source": "ai_generated_review"
        }
        
        # 保存分析结果
        analyses_storage[text_id] = {
            "text_id": text_id,
            "translation": article_analysis["translation"],
            "difficult_words": article_analysis["difficult_words"],
            "difficulty": 4,  # 复习材料默认中等偏上难度
            "key_points": ["复习重点", "错误总结", "学习建议"],
            "word_count": len(review_article.split())
        }
        
        save_data()
        
        return APIResponse(
            success=True,
            data={
                "text_id": text_id,
                "review_article": review_article,
                "analysis_summary": analysis_data
            },
            message="复习材料生成成功"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成复习材料失败: {str(e)}")

def analyze_user_patterns(history_data: List[PracticeHistoryRecord]) -> Dict[str, Any]:
    """分析用户的错误模式"""
    # 按复习次数分组
    low_review = [r for r in history_data if getattr(r, 'review_count', 0) <= 2]
    medium_review = [r for r in history_data if 3 <= getattr(r, 'review_count', 0) <= 5]
    
    # 提取错误模式
    grammar_errors = []
    vocabulary_errors = []
    structure_errors = []
    
    for record in low_review[-10:]:  # 只分析最近10条低复习记录
        if hasattr(record, 'ai_evaluation') and record.ai_evaluation:
            corrections = record.ai_evaluation.get('corrections', [])
            for correction in corrections:
                # 分类错误类型
                reason = correction.get('reason', '').lower()
                if any(word in reason for word in ['grammar', 'tense', '语法', '时态']):
                    grammar_errors.append(correction)
                elif any(word in reason for word in ['vocabulary', 'word', '词汇', '单词']):
                    vocabulary_errors.append(correction)
                elif any(word in reason for word in ['structure', 'sentence', '结构', '句子']):
                    structure_errors.append(correction)
    
    return {
        "total_records": len(history_data),
        "low_review_count": len(low_review),
        "grammar_error_count": len(grammar_errors),
        "vocabulary_error_count": len(vocabulary_errors),
        "structure_error_count": len(structure_errors),
        "recent_errors": grammar_errors + vocabulary_errors + structure_errors,
        "focus_areas": determine_focus_areas(grammar_errors, vocabulary_errors, structure_errors)
    }

def determine_focus_areas(grammar_errors, vocabulary_errors, structure_errors) -> List[str]:
    """确定重点复习领域"""
    areas = []
    if len(grammar_errors) >= 3:
        areas.append("语法和时态运用")
    if len(vocabulary_errors) >= 3:
        areas.append("词汇选择和搭配")
    if len(structure_errors) >= 3:
        areas.append("句子结构组织")
    
    return areas if areas else ["基础语言表达"]
```

#### 4. 前端实现

```typescript
// frontend/src/pages/Review.tsx
const Review: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewMaterial, setReviewMaterial] = useState<any>(null);
  
  const generateReviewMaterial = async () => {
    setIsGenerating(true);
    try {
      const response = await reviewAPI.generate();
      if (response.success) {
        setReviewMaterial(response.data);
        // 跳转到新生成的练习材料
        navigate(`/practice/${response.data.text_id}`);
      }
    } catch (error) {
      alert('生成复习材料失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">智能复习</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">个性化复习材料</h2>
        <p className="text-gray-600 mb-4">
          基于您的练习历史，AI将生成专门针对您常见错误的复习文章
        </p>
        
        <button
          onClick={generateReviewMaterial}
          disabled={isGenerating}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? '正在生成复习材料...' : '生成今日复习'}
        </button>
      </div>
      
      <ReviewStats />
    </div>
  );
};

// 复习统计组件
const ReviewStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    // 加载复习统计数据
    loadReviewStats();
  }, []);
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">复习统计</h3>
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPracticed}</div>
            <div className="text-sm text-gray-600">已练习材料</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.needReview}</div>
            <div className="text-sm text-gray-600">需要复习</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
            <div className="text-sm text-gray-600">已掌握</div>
          </div>
        </div>
      )}
    </div>
  );
};
```

#### 5. API接口扩展

```typescript
// frontend/src/utils/api.ts
export const reviewAPI = {
  // 生成复习材料
  generate: async (): Promise<APIResponse<any>> => {
    const response = await api.post('/api/review/generate');
    return response;
  },
  
  // 获取复习统计
  getStats: async (): Promise<APIResponse<any>> => {
    const response = await api.get('/api/review/stats');
    return response;
  },
  
  // 标记复习完成
  markReviewed: async (textId: string): Promise<APIResponse<any>> => {
    const response = await api.post(`/api/review/mark/${textId}`);
    return response;
  }
};
```

### 实施步骤

#### 第1步：数据结构更新（1天）
1. 扩展 `PracticeHistoryRecord` 模型
2. 更新数据持久化逻辑
3. 添加复习次数字段的向后兼容性

#### 第2步：复习分析引擎（2天）
1. 实现用户错误模式分析
2. 开发复习材料生成AI模型
3. 集成文章分析流程

#### 第3步：前端复习界面（2天）
1. 创建复习页面组件
2. 实现复习统计展示
3. 添加生成复习材料的交互

#### 第4步：API集成和测试（1天）
1. 完善后端API接口
2. 前后端联调测试
3. 优化复习文章质量

### 预期效果

- ✅ **个性化学习**: 基于用户实际错误生成针对性复习材料
- ✅ **闭环学习**: 练习→分析→复习→再练习的完整循环
- ✅ **智能优先级**: 自动识别需要重点复习的薄弱环节
- ✅ **进度追踪**: 可视化复习进度和掌握程度
- ✅ **自适应难度**: 复习材料难度根据用户水平动态调整

这个功能将Trans Invert从单纯的练习平台升级为智能化的个性化学习系统。