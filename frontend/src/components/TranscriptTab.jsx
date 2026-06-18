import { ScrollText, Download } from 'lucide-react'

export default function TranscriptTab({ segments }) {
  if (!segments || segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <ScrollText className="w-10 h-10 mb-3 text-gray-600" />
        <p>暂无转录文本</p>
      </div>
    )
  }

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // HH:MM:SS,mmm format for SRT
  const formatSrtTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.round((seconds % 1) * 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
  }

  const triggerDownload = (content, filename, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob(['\ufeff' + content], { type: mime })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }

  const downloadSRT = () => {
    const srt = segments
      .map((seg, i) =>
        `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end || seg.start + 3)}\n${seg.text}\n`
      )
      .join('\n')
    triggerDownload(srt, `subtitle-${Date.now()}.srt`)
  }

  const downloadTXT = () => {
    const txt = segments.map((seg) => `[${formatTime(seg.start)}] ${seg.text}`).join('\n')
    triggerDownload(txt, `subtitle-${Date.now()}.txt`)
  }

  return (
    <div>
      {/* Download toolbar */}
      <div className="flex justify-end gap-2 mb-3">
        <button
          onClick={downloadSRT}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          下载 SRT
        </button>
        <button
          onClick={downloadTXT}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          下载 TXT
        </button>
      </div>

      {/* Transcript segments */}
      <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
        {segments.map((seg, idx) => (
          <div
            key={idx}
            className="flex gap-3 py-2 px-3 hover:bg-white/5 rounded-lg transition-colors group"
          >
            <span className="text-purple-400 text-xs font-mono whitespace-nowrap mt-0.5 opacity-70 group-hover:opacity-100">
              {formatTime(seg.start)}
            </span>
            <p className="text-gray-300 text-sm leading-relaxed">{seg.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
