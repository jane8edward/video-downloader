"""
AI 服务模块 - DeepSeek API 调用封装
提供视频摘要生成、AI对话等能力，使用 SSE 流式输出
"""

import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"

client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url=DEEPSEEK_BASE_URL,
)

# ──────────────────── Prompt Templates ────────────────────

SUMMARY_SYSTEM_PROMPT = """你是一位专业的视频内容分析专家。请根据用户提供的视频转录文本，生成以下三部分内容。

## 任务要求

### 1. 视频摘要
用 200-300 字概括视频的核心内容，提炼关键信息和主要观点。要求语言精炼，逻辑清晰。

### 2. 章节大纲
按视频时间线将内容分成多个章节，每个章节包含：
- **时间范围**（如 00:00 - 02:30）
- **章节标题**（简短有力）
- **核心要点**（2-3 句话概括该段内容）

请使用 Markdown 格式输出，示例：
### 00:00 - 02:30 开场介绍
视频开头介绍了本期的主题...

### 02:30 - 08:00 核心概念
详细讲解了...

### 3. 思维导图
生成 Markdown 格式的思维导图大纲，用标题和无序列表表示层级关系，用于 markmap 可视化渲染。
要求：层级清晰（2-4层），每个分支 2-5 个要点，总节点数 15-40 个。

## 输出格式要求
请严格按照以下格式输出，使用分隔符区分三部分：

===SUMMARY===
（视频摘要内容）

===OUTLINE===
（章节大纲，Markdown格式）

===MINDMAP===
（思维导图 Markdown 内容，不要包含代码块标记）
"""

CHAT_SYSTEM_PROMPT_TEMPLATE = """你是一位智能AI视频助手。以下是视频「{title}」的相关信息：

【视频摘要】
{summary}

【完整转录文本】
{transcript}

---
请基于以上视频内容回答用户的问题。要求：
1. 回答要简洁、准确、有条理
2. 如果问题与视频内容相关，请引用具体内容作答
3. 如果问题超出视频内容范围，请诚实说明，并尽可能给出有帮助的回答
4. 使用 Markdown 格式组织回答"""


# ──────────────────── API Functions ────────────────────

async def generate_summary_stream(title: str, transcript: str, duration: int = 0):
    """Generate video summary using DeepSeek with async streaming.

    Yields: str chunks of the LLM response
    """
    duration_info = ""
    if duration:
        minutes = duration // 60
        seconds = duration % 60
        duration_info = f"（视频时长：{minutes}分{seconds}秒）"

    user_content = f"视频标题：{title}{duration_info}\n\n转录文本：\n{transcript}"

    # Truncate to avoid exceeding context limit
    max_chars = 60000
    if len(user_content) > max_chars:
        user_content = user_content[:max_chars] + "\n\n...(文本过长已截断)"

    stream = await client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        stream=True,
        temperature=0.3,
        max_tokens=4096,
    )

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def chat_stream(title: str, transcript: str, summary: str, messages: list):
    """AI chat about video content with async streaming.

    Args:
        title: video title
        transcript: full transcript text
        summary: video summary (can be empty)
        messages: list of {"role": str, "content": str}

    Yields: str chunks of the LLM response
    """
    system_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
        title=title,
        summary=summary or "（暂无摘要）",
        transcript=transcript[:30000] if len(transcript) > 30000 else transcript,
    )

    api_messages = [{"role": "system", "content": system_prompt}]
    # Keep last 10 messages to limit context
    for msg in messages[-10:]:
        api_messages.append({"role": msg["role"], "content": msg["content"]})

    stream = await client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        messages=api_messages,
        stream=True,
        temperature=0.7,
        max_tokens=2048,
    )

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
