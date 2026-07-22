import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Brain,
  ChevronUp,
  Crown,
  FileText,
  GitBranch,
  List,
  Loader2,
  MessageSquare,
  ScrollText,
} from 'lucide-react'
import { useAuth } from '../auth.jsx'
import AIChatTab from './AIChatTab'
import MindMapTab from './MindMapTab'
import OutlineTab from './OutlineTab'
import SummaryTab from './SummaryTab'
import TranscriptTab from './TranscriptTab'
import { isSectionMarkerLine, sanitizeAiMarkdown } from './aiTextSanitizer.js'

const TABS = [
  { id: 'summary', label: '摘要', icon: FileText },
  { id: 'outline', label: '大纲', icon: List },
  { id: 'transcript', label: '转录', icon: ScrollText },
  { id: 'mindmap', label: '思维导图', icon: GitBranch },
  { id: 'chat', label: 'AI 对话', icon: MessageSquare },
]

const SECTION_MARKER_RE = /^\s*(?:#{1,6}\s*)?(?:={2,}\s*)?(SUMMARY|OUTLINE|MINDMAP|摘要|大纲|章节大纲|思维导图)(?:\s*={2,})?\s*$/i
const SECTION_TOKEN_RE = /={2,}\s*(SUMMARY|OUTLINE|MINDMAP|摘要|大纲|章节大纲|思维导图)\s*={2,}|#{1,6}\s*(SUMMARY|OUTLINE|MINDMAP|摘要|大纲|章节大纲|思维导图)\b/gi

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
  return mindmap
    .trim()
    .replace(/^```(?:markdown|md)?\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}

function parseResponse(text) {
  const sections = parseResponseByLines(text)
  const markers = []
  for (const match of text.matchAll(SECTION_TOKEN_RE)) {
    const rawName = match[1] || match[2] || ''
    const id = normalizeSectionName(rawName)
    if (id) markers.push({ id, index: match.index, end: match.index + match[0].length })
  }

  markers.forEach((marker, index) => {
    const next = markers[index + 1]
    const value = text.slice(marker.end, next ? next.index : text.length).trim()
    if (value) sections[marker.id] = value
  })

  const summaryMatch = text.match(/===\s*SUMMARY\s*===([\s\S]*?)(?====\s*(?:OUTLINE|MINDMAP)\s*===|$)/i)
  const outlineMatch = text.match(/===\s*OUTLINE\s*===([\s\S]*?)(?====\s*MINDMAP\s*===|$)/i)
  const mindmapMatch = text.match(/===\s*MINDMAP\s*===([\s\S]*?)$/i)

  if (!sections.summary && summaryMatch) sections.summary = summaryMatch[1].trim()
  if (!sections.outline && outlineMatch) sections.outline = outlineMatch[1].trim()
  if (mindmapMatch) sections.mindmap = mindmapMatch[1].trim()
  if (sections.mindmap) sections.mindmap = stripMindmapFences(sections.mindmap)
  return sections
}

function normalizeMarkdown(text) {
  return sanitizeAiMarkdown(text)
}

function buildSummaryFallback(text) {
  const lines = text.split(/\r?\n/)
  const firstContent = []
  for (const line of lines) {
    if (isSectionMarkerLine(line) && /OUTLINE|MINDMAP|大纲|章节大纲|思维导图/i.test(line)) break
    firstContent.push(line)
  }
  const beforeOutline = firstContent.join('\n') || text
  const beforeMindmap = beforeOutline.split(/={2,}\s*(?:OUTLINE|MINDMAP|大纲|章节大纲|思维导图)\s*={2,}/i)[0] || beforeOutline
  return normalizeMarkdown(beforeMindmap)
}

function canUserUseSummary(candidate) {
  if (!candidate) return false
  if (candidate.membership?.is_active) return true
  return (candidate.ai_quota?.summary?.remaining ?? 0) > 0
}

export default function AISummary({ videoInfo, autoStart = false }) {
  const { user, setAuthModalOpen, refreshUser } = useAuth()
  const isVip = Boolean(user?.membership?.is_active)
  const summaryQuota = user?.ai_quota?.summary
  const summaryRemaining = summaryQuota?.remaining ?? 0
  const canUseSummary = Boolean(user && (isVip || summaryRemaining > 0))
  const canUseChat = isVip

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
  const inFlightUrlRef = useRef('')

  const resetSummaryState = useCallback(() => {
    fullResponseRef.current = ''
    inFlightUrlRef.current = ''
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
    const currentUrl = videoInfo?.webpage_url || ''
    if (inFlightUrlRef.current === currentUrl && !force) {
      setShowPanel(true)
      return
    }

    if (!user) {
      setShowPanel(true)
      setError('')
      setAuthModalOpen(true)
      return
    }

    if (hasSummarized && !force) {
      setShowPanel(true)
      return
    }
    if ((isExtracting || isSummarizing) && !force) {
      setShowPanel(true)
      return
    }

    setShowPanel(true)
    inFlightUrlRef.current = currentUrl
    setError('')
    setIsExtracting(true)
    fullResponseRef.current = ''
    setSummaryContent('')
    setOutlineContent('')
    setMindmapContent('')

    try {
      const latestUser = await refreshUser().catch(() => user)
      if (!canUserUseSummary(latestUser)) {
        setIsExtracting(false)
        inFlightUrlRef.current = ''
        return
      }

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
        setError('该视频暂无可用字幕，暂时无法生成 AI 总结。')
        return
      }

      setIsSummarizing(true)
      const sumRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoInfo.title || '',
          transcript: subData.full_text || '',
          duration: Math.round(videoInfo.duration || 0),
          resource_key: videoInfo.webpage_url || videoInfo.title || '',
        }),
      })

      if (!sumRes.ok) {
        const errData = await sumRes.json()
        refreshUser().catch(() => {})
        const detail = errData.detail
        const msg = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || d).join('; ')
            : 'AI 总结失败'
        if (sumRes.status === 401) setAuthModalOpen(true)
        throw new Error(msg)
      }

      refreshUser().catch(() => {})

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
          if (!part.startsWith('data: ')) continue
          try {
            const data = JSON.parse(part.slice(6))
            if (data.error) throw new Error(data.error)
            if (data.content) {
              fullResponseRef.current += data.content
              const sections = parseResponse(fullResponseRef.current)
              setSummaryContent(normalizeMarkdown(sections.summary))
              setOutlineContent(normalizeMarkdown(sections.outline))
              setMindmapContent(sections.mindmap)
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e
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
      inFlightUrlRef.current = ''
      refreshUser().catch(() => {})
    } catch (err) {
      setError(err.message || '操作失败，请稍后重试')
      setIsExtracting(false)
      setIsSummarizing(false)
      inFlightUrlRef.current = ''
      refreshUser().catch(() => {})
    }
  }, [
    canUseSummary,
    hasSummarized,
    isExtracting,
    isSummarizing,
    refreshUser,
    setAuthModalOpen,
    user,
    videoInfo,
  ])

  useEffect(() => {
    if (!videoInfo?.webpage_url) return
    startedUrlRef.current = ''
    setShowPanel(autoStart)
    resetSummaryState()
  }, [autoStart, resetSummaryState, videoInfo?.webpage_url])

  useEffect(() => {
    const url = videoInfo?.webpage_url
    if (!autoStart || !canUseSummary || !url || startedUrlRef.current === url) return
    startedUrlRef.current = url
    handleStartSummary({ force: true })
  }, [autoStart, canUseSummary, handleStartSummary, videoInfo?.webpage_url])

  if (!videoInfo) return null

  const quotaHint = isVip
    ? 'VIP 不限次数'
    : user
      ? `今日免费剩余 ${summaryRemaining}/3 次`
      : '登录后每日免费 3 次'

  return (
    <div className="min-w-0 h-full min-h-0">
      {!showPanel && (
        <button
          onClick={handleStartSummary}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl glass-card hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group cursor-pointer"
        >
          <Brain className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
          <span className="text-lg font-semibold gradient-text">AI 智能总结</span>
        </button>
      )}

      {showPanel && (
        <div className="glass-card rounded-2xl overflow-hidden h-full min-h-0 flex flex-col">
          <div className="flex flex-col gap-3 px-5 py-3 border-b border-white/5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-semibold text-white">AI 智能总结</span>
              <span className="text-xs text-gray-500">{quotaHint}</span>
              {subtitleData && (
                <span className="text-xs text-gray-500">
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

          <div className="p-5 overflow-y-auto flex-1 min-h-0">
            {!canUseSummary && (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
                  <Crown className="h-7 w-7" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {user ? '今日免费 AI 总结次数已用完' : '登录后可免费使用 AI 总结'}
                </h3>
                <p className="mb-6 max-w-sm text-sm leading-6 text-gray-400">
                  {user
                    ? '免费用户每天可生成 3 次 AI 总结。开通会员后不限次数，并可使用 AI 对话。'
                    : '免费用户每天可生成 3 次 AI 总结；开通会员后不限次数，并可使用 AI 对话。'}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {!user && (
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      登录 / 注册
                    </button>
                  )}
                  <a
                    href="#pricing"
                    className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-purple-500/30"
                  >
                    查看会员套餐
                  </a>
                </div>
              </div>
            )}

            {canUseSummary && isExtracting && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-4" />
                <p className="text-sm">正在提取视频字幕...</p>
                <p className="text-xs text-gray-500 mt-1">这可能需要几秒钟</p>
              </div>
            )}

            {canUseSummary && error && !isExtracting && (
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

            {canUseSummary && !isExtracting && !error && (
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
                  <OutlineTab content={outlineContent} isLoading={isSummarizing} />
                )}
                {activeTab === 'transcript' && (
                  <TranscriptTab segments={subtitleData?.segments || []} />
                )}
                {activeTab === 'mindmap' && (
                  <MindMapTab markdown={mindmapContent} />
                )}
                {activeTab === 'chat' && (
                  canUseChat ? (
                    <AIChatTab
                      videoInfo={videoInfo}
                      transcript={subtitleData?.full_text || ''}
                      summary={summaryContent}
                    />
                  ) : (
                    <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                      <Crown className="mb-4 h-10 w-10 text-yellow-300" />
                      <h3 className="mb-2 text-lg font-semibold text-white">AI 对话是会员功能</h3>
                      <p className="mb-6 max-w-sm text-sm leading-6 text-gray-400">
                        免费用户每天可用 3 次 AI 总结；开通会员后可使用视频 AI 对话。
                      </p>
                      <a
                        href="#pricing"
                        className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-purple-500/30"
                      >
                        查看会员套餐
                      </a>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
