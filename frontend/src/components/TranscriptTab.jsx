import { ScrollText } from 'lucide-react'

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

  return (
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
  )
}
