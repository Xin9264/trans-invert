"""模板渲染服务"""
import os
from typing import Dict, Any
from jinja2 import Environment, FileSystemLoader, select_autoescape

class TemplateService:
    """使用Jinja2管理AI提示词模板"""
    
    def __init__(self):
        # 获取模板目录路径
        template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
        
        # 创建Jinja2环境
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )
    
    def render_analyze_text_prompt(self, text_content: str) -> str:
        """渲染文本分析提示词"""
        template = self.env.get_template('analyze_text.j2')
        return template.render(text_content=text_content)
    
    def render_evaluate_answer_prompt(
        self, 
        original_text: str, 
        translation: str, 
        user_input: str
    ) -> str:
        """渲染答案评估提示词"""
        template = self.env.get_template('evaluate_answer.j2')
        return template.render(
            original_text=original_text,
            translation=translation,
            user_input=user_input
        )

    def render_generate_review_article_prompt(
        self,
        analysis_data: Dict[str, Any],
        history_stats: Dict[str, Any]
    ) -> str:
        """渲染复习文章生成提示词"""
        template = self.env.get_template('generate_review_article.j2')
        return template.render(
            analysis_data=analysis_data,
            history_stats=history_stats
        )
    
    def render_template(self, template_name: str, **kwargs: Any) -> str:
        """通用模板渲染方法"""
        template = self.env.get_template(template_name)
        return template.render(**kwargs)

# 创建全局模板服务实例
template_service = TemplateService()
