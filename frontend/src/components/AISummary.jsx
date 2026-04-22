import { useState, useRef, useCallback } from 'react'
import {
  Brain,
  Loader2,
  AlertCircle,
  FileText,
  List,
  ScrollText,
  GitBranch,
  MessageSquare,
  ChevronUp,
} from 'lucide-react'
import SummaryTab from './SummaryTab'
import OutlineTab from './OutlineTab'
import TranscriptTab from './TranscriptTab'
import MindMapTab from './MindMapTab'
import AIChatTab from './AIChatTab'

const TABS = [
  { id: 'summary', label: '摘要', icon: FileText },
  { id: 'outline', label: '大纲', icon: List },
  { id: 'transcript', label: '转录', icon: ScrollText },
  { id: 'mindmap', label: '思维导图', icon: GitBranch },
  { id: 'chat', label: 'AI 对话', icon: MessageSquare },
]

/**
 * Parse the LLM response text into three sections:
 * SUMMARY, OUTLINE, MINDMAP — delimited by ===SECTION=== markers.
 */
function parseResponse(text) {
  const sections = { summary: '', outline: '', mindmap: '' }

  const summaryMatch = text.match(/===SUMMARY===([\s\S]*?)(?====OUTLINE===|$)/)
  const outlineMatch = text.match(/===OUTLINE===([\s\S]*?)(?====MINDMAP===|$)/)
  const mindmapMatch = text.match(/===MINDMAP===([\s\S]*?)$/)

  if (summaryMatch) sections.summary = summaryMatch[1].trim()
  if (outlineMatch) sections.outline = outlineMatch[1].trim()
  if (mindmapMatch) {
    let mm = mindmapMatch[1].trim()
    // Strip markdown code fences if LLM wraps them
    mm = mm.replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```\s*$/, '')
    sections.mindmap = mm.trim()
  }

  return sections
}

export default function AISummary({ videoInfo }) {
  const [showPanel, setShowPanel] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [subtitleData, setSubtitleData] = useState(null)
  const [summaryContent, setSummaryContent] = useState('')
  const [outlineContent, setOutlineContent] = useState('')
  const [mindmapContent, setMindmapContent] = useState('')
  const [error, setError] = useState('')
  const [hasSummarized, setHasSummarized] = useState(false)
  const fullResponseRef = useRef('')

  const handleStartSummary = useCallback(async () => {
    // If already summarized, just toggle the panel
    if (hasSummarized) {
      setShowPanel(true)
      return
    }

    setShowPanel(true)
    setError('')
    setIsExtracting(true)
    fullResponseRef.current = ''
    setSummaryContent('')
    setOutlineContent('')
    setMindmapContent('')

    try {
      // ── Step 1: Extract subtitles ──
      const subRes = await fetch('/api/subtitle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoInfo.webpage_url }),
      })

      if (!subRes.ok) {
        const errData = await subRes.json()
        throw new Error(errData.detail || '字幕提取失败')
      }

      const subData = await subRes.json()
      setSubtitleData(subData)
      setIsExtracting(false)

      if (!subData.has_subtitle) {
        setError('该视频暂无可用字幕，无法生成 AI 总结。后续版本将支持语音转文字。')
        return
      }

      // ── Step 2: Generate AI summary (SSE streaming) ──
      setIsSummarizing(true)

      const sumRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoInfo.title || '',
          transcript: subData.full_text || '',
          duration: Math.round(videoInfo.duration || 0),
        }),
      })

      if (!sumRes.ok) {
        const errData = await sumRes.json()
        const detail = errData.detail
        const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || d).join('; ') : 'AI 总结失败'
        throw new Error(msg)
      }

      const reader = sumRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const data = JSON.parse(part.slice(6))
              if (data.error) {
                throw new Error(data.error)
              }
              if (data.content) {
                fullResponseRef.current += data.content
                const sections = parseResponse(fullResponseRef.current)
                setSummaryContent(sections.summary)
                setOutlineContent(sections.outline)
                setMindmapContent(sections.mindmap)
              }
            } catch (e) {
              // Ignore JSON parse errors from partial chunks
              if (e.message && !e.message.includes('JSON')) {
                throw e
              }
            }
          }
        }
      }

      setIsSummarizing(false)
      setHasSummarized(true)
    } catch (err) {
      setError(err.message || '操作失败，请稍后重试')
      setIsExtracting(false)
      setIsSummarizing(false)
    }
  }, [videoInfo, hasSummarized])

  if (!videoInfo) return null

  return (
    <section className="relative px-4 pb-8">
      <div className="max-w-3xl mx-auto">
        {/* ── Trigger Button ── */}
        {!showPanel && (
          <button
            onClick={handleStartSummary}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl glass-card hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group cursor-pointer"
          >
            <Brain className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
            <span className="text-lg font-semibold gradient-text">
              AI 智能总结
            </span>
          </button>
        )}

        {/* ── AI Panel ── */}
        {showPanel && (
          <div className="glass-card rounded-2xl overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-semibold text-white">
                  AI 智能总结
                </span>
                {subtitleData && (
                  <span className="text-xs text-gray-500 ml-2">
                    字幕来源: {subtitleData.source === 'platform' ? '平台字幕' : '自动生成'} ({subtitleData.language})
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Tab Content */}
            <div className="p-5 min-h-[300px]">
              {/* Loading: extracting subtitles */}
              {isExtracting && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-4" />
                  <p className="text-sm">正在提取视频字幕...</p>
                  <p className="text-xs text-gray-500 mt-1">
                    这可能需要几秒钟
                  </p>
                </div>
              )}

              {/* Error */}
              {error && !isExtracting && (
                <div className="flex items-start gap-3 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="whitespace-pre-line">{error}</p>
                    <button
                      onClick={() => {
                        setError('')
                        setHasSummarized(false)
                        setShowPanel(false)
                      }}
                      className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline"
                    >
                      重试
                    </button>
                  </div>
                </div>
              )}

              {/* Tab content (only show if not extracting and no error) */}
              {!isExtracting && !error && (
                <>
                  {activeTab === 'summary' && (
                    <SummaryTab
                      content={summaryContent}
                      isLoading={isSummarizing}
                    />
                  )}
                  {activeTab === 'outline' && (
                    <OutlineTab
                      content={outlineContent}
                      isLoading={isSummarizing}
                    />
                  )}
                  {activeTab === 'transcript' && (
                    <TranscriptTab segments={subtitleData?.segments || []} />
                  )}
                  {activeTab === 'mindmap' && (
                    <MindMapTab markdown={mindmapContent} />
                  )}
                  {activeTab === 'chat' && (
                    <AIChatTab
                      videoInfo={videoInfo}
                      transcript={subtitleData?.full_text || ''}
                      summary={summaryContent}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
