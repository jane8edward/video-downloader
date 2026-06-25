import { useState, useRef, useCallback, useEffect } from 'react'
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

const SECTION_MARKER_RE = /^\s*(?:#{1,6}\s*)?(?:={2,}\s*)?(SUMMARY|OUTLINE|MINDMAP|摘要|大纲|章节大纲|思维导图)(?:\s*={2,})?\s*$/i

function normalizeSectionName(name) {
  const upper = name.toUpperCase()
  if (upper === 'SUMMARY' || name === '摘要') return 'summary'
  if (upper === 'OUTLINE' || name === '大纲' || name === '章节大纲') return 'outline'
  if (upper === 'MINDMAP' || name === '思维导图') return 'mindmap'
  return ''
}

function parseResponseByLines(text) {
  const sections = { summary: '', outline: '', mindmap: '' }
  let current = ''

  text.split(/\r?\n/).forEach((line) => {
    const marker = line.match(SECTION_MARKER_RE)
    if (marker) {
      current = normalizeSectionName(marker[1])
      return
    }

    if (current) {
      sections[current] += `${line}\n`
    }
  })

  Object.keys(sections).forEach((key) => {
    sections[key] = sections[key].trim()
  })

  return sections
}

function stripMindmapFences(mindmap) {
  let mm = mindmap.trim()
  mm = mm.replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```\s*$/, '')
  return mm.trim()
}

function parseResponse(text) {
  const sections = parseResponseByLines(text)

  const summaryMatch = text.match(/===\s*SUMMARY\s*===([\s\S]*?)(?====\s*OUTLINE\s*===|===\s*MINDMAP\s*===|$)/i)
  const outlineMatch = text.match(/===\s*OUTLINE\s*===([\s\S]*?)(?====\s*MINDMAP\s*===|$)/i)
  const mindmapMatch = text.match(/===\s*MINDMAP\s*===([\s\S]*?)$/i)

  if (!sections.summary && summaryMatch) sections.summary = summaryMatch[1].trim()
  if (!sections.outline && outlineMatch) sections.outline = outlineMatch[1].trim()
  if (mindmapMatch) {
    sections.mindmap = mindmapMatch[1].trim()
  }

  if (sections.mindmap) {
    sections.mindmap = stripMindmapFences(sections.mindmap)
  }

  return sections
}

function buildSummaryFallback(text) {
  const beforeOutline = text.split(/^\s*(?:#{1,6}\s*)?(?:={2,}\s*)?(?:OUTLINE|大纲|章节大纲)(?:\s*={2,})?\s*$/im)[0] || text
  const beforeMindmap = beforeOutline.split(/^\s*(?:#{1,6}\s*)?(?:={2,}\s*)?(?:MINDMAP|思维导图)(?:\s*={2,})?\s*$/im)[0] || beforeOutline

  return normalizeMarkdown(beforeMindmap)
}

function normalizeMarkdown(text) {
  return text
    .replace(/^\s*(?:#{1,6}\s*)?={2,}\s*(SUMMARY|OUTLINE|MINDMAP|摘要|大纲|章节大纲|思维导图)\s*={2,}\s*$/gim, '')
    .replace(/^#{1,6}\s*SUMMARY\s*$/gim, '')
    .replace(/^#{1,6}\s*OUTLINE\s*$/gim, '')
    .replace(/^#{1,6}\s*MINDMAP\s*$/gim, '')
    .replace(/^#{1,6}\s*(摘要|大纲|章节大纲|思维导图)\s*$/gim, '')
    .replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function AISummary({ videoInfo, autoStart = false }) {
  const [showPanel, setShowPanel] = useState(autoStart)
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
  const startedUrlRef = useRef('')

  const resetSummaryState = useCallback(() => {
    fullResponseRef.current = ''
    setActiveTab('summary')
    setIsExtracting(false)
    setIsSummarizing(false)
    setSubtitleData(null)
    setSummaryContent('')
    setOutlineContent('')
    setMindmapContent('')
    setError('')
    setHasSummarized(false)
  }, [])

  const handleStartSummary = useCallback(async ({ force = false } = {}) => {
    // If already summarized, just toggle the panel
    if (hasSummarized && !force) {
      setShowPanel(true)
      return
    }
    if ((isExtracting || isSummarizing) && !force) {
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
                setSummaryContent(normalizeMarkdown(sections.summary))
                setOutlineContent(normalizeMarkdown(sections.outline))
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

      const finalSections = parseResponse(fullResponseRef.current)
      const finalSummary = normalizeMarkdown(finalSections.summary) || buildSummaryFallback(fullResponseRef.current)
      const finalOutline = normalizeMarkdown(finalSections.outline)
      const finalMindmap = finalSections.mindmap

      setSummaryContent(finalSummary)
      if (finalOutline) setOutlineContent(finalOutline)
      if (finalMindmap) setMindmapContent(finalMindmap)
      setIsSummarizing(false)
      setHasSummarized(true)
    } catch (err) {
      setError(err.message || '操作失败，请稍后重试')
      setIsExtracting(false)
      setIsSummarizing(false)
    }
  }, [videoInfo, hasSummarized, isExtracting, isSummarizing])

  useEffect(() => {
    if (!videoInfo?.webpage_url) return

    startedUrlRef.current = ''
    setShowPanel(autoStart)
    resetSummaryState()
  }, [videoInfo?.webpage_url, autoStart, resetSummaryState])

  useEffect(() => {
    const url = videoInfo?.webpage_url
    if (!autoStart || !url || startedUrlRef.current === url) return

    startedUrlRef.current = url
    handleStartSummary({ force: true })
  }, [autoStart, videoInfo?.webpage_url, handleStartSummary])

  if (!videoInfo) return null

  return (
    <div className="min-w-0 h-full min-h-0">
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
          <div className="glass-card rounded-2xl overflow-hidden h-full min-h-0 flex flex-col">
            {/* Panel Header */}
            <div className="flex flex-col gap-3 px-5 py-3 border-b border-white/5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
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
              {!autoStart && (
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              )}
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
            <div className="p-5 overflow-y-auto flex-1 min-h-0">
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
                        startedUrlRef.current = videoInfo?.webpage_url || ''
                        resetSummaryState()
                        handleStartSummary({ force: true })
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
                      onRetry={() => {
                        startedUrlRef.current = videoInfo?.webpage_url || ''
                        resetSummaryState()
                        handleStartSummary({ force: true })
                      }}
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
  )
}
