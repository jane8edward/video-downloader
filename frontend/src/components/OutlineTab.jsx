import { Loader2 } from 'lucide-react'
import Markdown from 'react-markdown'
import { markdownComponents } from './markdownStyles.jsx'

export default function OutlineTab({ content, isLoading }) {
  if (isLoading && !content) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-4" />
        <p>AI 正在生成章节大纲...</p>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>等待 AI 分析完成后展示章节大纲</p>
      </div>
    )
  }

  return (
    <div className="ai-markdown">
      <Markdown components={markdownComponents}>{content}</Markdown>
      {isLoading && (
        <span className="inline-block w-2 h-5 bg-purple-400 animate-pulse ml-1 align-middle rounded-sm" />
      )}
    </div>
  )
}
