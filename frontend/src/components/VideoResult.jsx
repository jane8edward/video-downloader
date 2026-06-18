import { useState } from 'react'
import { Download, Clock, Eye, User, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function VideoResult({ videoInfo }) {
  const qualityOptions = videoInfo.quality_options?.length
    ? videoInfo.quality_options
    : [{ label: '最佳画质 (自动)', format_id: 'best', ext: 'mp4', resolution: 'best' }]

  const [selectedFormat, setSelectedFormat] = useState(
    qualityOptions[0]?.format_id || 'best'
  )
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState(null)
  const [downloadError, setDownloadError] = useState('')

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const totalSeconds = Math.floor(seconds)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const formatViews = (count) => {
    if (!count) return ''
    if (count > 100000000) return `${(count / 100000000).toFixed(1)}亿`
    if (count > 10000) return `${(count / 10000).toFixed(1)}万`
    return count.toLocaleString()
  }

  const handleDownload = async () => {
    setDownloading(true)
    setProgress(0)
    setDownloadStatus('downloading')
    setDownloadError('')

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.webpage_url,
          format_id: selectedFormat,
        }),
      })

      const { task_id } = await res.json()

      const evtSource = new EventSource(`/api/progress/${task_id}`)
      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setProgress(data.progress || 0)

        if (data.status === 'done') {
          evtSource.close()
          setDownloadStatus('done')
          setDownloading(false)
          window.open(`/api/file/${task_id}`, '_blank')
        } else if (data.status === 'error') {
          evtSource.close()
          setDownloadStatus('error')
          setDownloadError(data.error || '下载失败')
          setDownloading(false)
        }
      }

      evtSource.onerror = () => {
        evtSource.close()
        setDownloadStatus('error')
        setDownloadError('连接中断')
        setDownloading(false)
      }
    } catch (err) {
      setDownloadStatus('error')
      setDownloadError(err.message || '下载失败')
      setDownloading(false)
    }
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden h-full min-h-0 flex flex-col">
      <div className="flex flex-col gap-4 p-5 pb-4">
        {videoInfo.thumbnail && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-800">
            <img
              src={`/api/thumbnail?url=${encodeURIComponent(videoInfo.thumbnail)}`}
              alt={videoInfo.title}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white font-medium">
              {formatDuration(videoInfo.duration)}
            </div>
          </div>
        )}

        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white line-clamp-2 mb-3">
            {videoInfo.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
            {videoInfo.uploader && (
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {videoInfo.uploader}
              </span>
            )}
            {videoInfo.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(videoInfo.duration)}
              </span>
            )}
            {videoInfo.view_count && (
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {formatViews(videoInfo.view_count)} 次播放
              </span>
            )}
          </div>
          {videoInfo.extractor && (
            <span className="inline-block mt-3 px-2.5 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {videoInfo.extractor}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/5 mx-5"></div>

      <div className="p-5 flex-1 flex flex-col min-h-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-white">选择画质</span>
          <span className="text-xs text-gray-500">{qualityOptions.length} 个可选格式</span>
        </div>

        <div className="space-y-2 overflow-y-auto pr-1 xl:max-h-[220px]">
          {qualityOptions.map((opt) => {
            const isSelected = selectedFormat === opt.format_id
            const detail = [
              opt.resolution,
              opt.ext,
              opt.filesize ? formatFileSize(opt.filesize) : '',
            ].filter(Boolean).join(' · ')

            return (
              <button
                key={opt.format_id}
                onClick={() => setSelectedFormat(opt.format_id)}
                className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  isSelected
                    ? 'border-purple-400/70 bg-purple-500/15 text-white shadow-sm shadow-purple-500/10'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:border-purple-400/40 hover:bg-white/10'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{opt.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {detail || '自动选择最佳格式'}
                  </span>
                </span>
                <span
                  className={`h-4 w-4 flex-shrink-0 rounded-full border ${
                    isSelected
                      ? 'border-purple-300 bg-purple-400 shadow-[0_0_0_3px_rgba(168,85,247,0.18)]'
                      : 'border-white/20'
                  }`}
                />
              </button>
            )
          })}
        </div>

        <div className="mt-auto pt-4">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-brand rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                下载中 {progress > 0 ? `${progress}%` : ''}
              </>
            ) : downloadStatus === 'done' ? (
              <>
                <CheckCircle className="w-5 h-5" />
                下载完成
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                开始下载
              </>
            )}
          </button>

          {downloading && (
            <div className="mt-4">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-brand rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">正在下载并转码，请耐心等待...</p>
            </div>
          )}

          {downloadStatus === 'error' && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-2 border border-red-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {downloadError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
