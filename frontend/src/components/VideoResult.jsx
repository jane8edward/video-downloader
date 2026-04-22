import { useState } from 'react'
import { Download, Clock, Eye, User, ChevronDown, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function VideoResult({ videoInfo }) {
  const [selectedFormat, setSelectedFormat] = useState(
    videoInfo.quality_options?.[0]?.format_id || 'best'
  )
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState(null) // null | 'downloading' | 'done' | 'error'
  const [downloadError, setDownloadError] = useState('')
  const [showFormats, setShowFormats] = useState(false)

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--'
    const totalSeconds = Math.floor(seconds)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '未知'
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

      // SSE progress tracking
      const evtSource = new EventSource(`/api/progress/${task_id}`)
      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setProgress(data.progress || 0)

        if (data.status === 'done') {
          evtSource.close()
          setDownloadStatus('done')
          setDownloading(false)
          // Trigger file download
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
      setDownloadError(err.message)
      setDownloading(false)
    }
  }

  const selectedOption = videoInfo.quality_options?.find(q => q.format_id === selectedFormat)

  return (
    <section className="relative z-10 px-4 pb-16" id="result">
      <div className="max-w-3xl mx-auto">
        <div className="glass-card rounded-2xl">
          {/* Video Info */}
          <div className="flex flex-col sm:flex-row gap-4 p-5">
            {/* Thumbnail */}
            {videoInfo.thumbnail && (
              <div className="relative flex-shrink-0 w-full sm:w-64 aspect-video rounded-xl overflow-hidden bg-gray-800">
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

            {/* Meta */}
            <div className="flex-1 min-w-0">
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

          {/* Divider */}
          <div className="h-px bg-white/5 mx-5"></div>

          {/* Download Controls */}
          <div className="p-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Format Select */}
              <div className="relative flex-1">
                <button
                  onClick={() => setShowFormats(!showFormats)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:border-purple-500/50 transition-colors"
                >
                  <span className="text-sm">
                    {selectedOption?.label || '选择画质'}
                    {selectedOption?.filesize && (
                      <span className="text-gray-500 ml-2">
                        ({formatFileSize(selectedOption.filesize)})
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFormats ? 'rotate-180' : ''}`} />
                </button>

                {showFormats && (
                  <div className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl bg-[#1E1650] border border-white/10 shadow-xl z-50 max-h-60 overflow-y-auto">
                    {videoInfo.quality_options?.map((opt) => (
                      <button
                        key={opt.format_id}
                        onClick={() => { setSelectedFormat(opt.format_id); setShowFormats(false) }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                          selectedFormat === opt.format_id ? 'text-purple-400' : 'text-gray-300'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.filesize && (
                          <span className="text-gray-500 text-xs">{formatFileSize(opt.filesize)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-brand rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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
            </div>

            {/* Progress Bar */}
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

            {/* Error */}
            {downloadStatus === 'error' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-2 border border-red-500/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {downloadError}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
