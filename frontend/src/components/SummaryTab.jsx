import { Loader2 } from 'lucide-react'
import Markdown from 'react-markdown'
import { markdownComponents } from './markdownStyles.jsx'

export default function SummaryTab({ content, isLoading, onRetry }) {
  if (isLoading && !content) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-4" />
        <p>AI 正在分析视频内容，生成摘要...</p>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
        <p>本次没有解析到摘要内容。</p>
        <p className="mt-1 text-xs text-gray-600">大纲或转录可用时，通常是模型输出格式和摘要分段不匹配。</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 rounded-lg border border-purple-400/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-500/20 hover:text-purple-200"
          >
            重新生成总结
          </button>
        )}
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
