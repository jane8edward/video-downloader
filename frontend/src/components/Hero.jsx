import { useState } from 'react'
import { Search, Zap, ArrowRight, Loader2 } from 'lucide-react'

export default function Hero({ onParse, isLoading, error }) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (url.trim()) {
      onParse(url.trim())
    }
  }

  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-8">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-gray-300">支持 <span className="text-white font-semibold">1000+</span> 视频平台 · 免费使用</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
          <span className="text-white">万能视频</span>
          <br />
          <span className="gradient-text">下载器</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          粘贴链接，一键下载。支持 YouTube、B站、抖音、TikTok 等主流平台，
          <span className="text-gray-200">最高画质</span>，无需安装任何软件。
        </p>

        {/* Search Box */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto mb-6">
          <div className="relative flex items-center p-2 rounded-2xl glass-card animate-pulse-glow">
            <div className="flex items-center justify-center w-12 h-12 flex-shrink-0">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="粘贴视频链接到这里... (YouTube, B站, 抖音, TikTok...)"
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-base sm:text-lg px-2"
            />
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex items-center gap-2 px-6 sm:px-8 py-3 bg-gradient-brand rounded-xl text-white font-semibold text-base hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="hidden sm:inline">解析中</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">解析视频</span>
                  <span className="sm:hidden">解析</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto mb-4">
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-2 border border-red-500/20">
              {error}
            </p>
          </div>
        )}

        {/* Quick tips */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
          <span>试试:</span>
          {[
            { label: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { label: 'B站', url: 'https://www.bilibili.com/video/BV1xx411c7mD' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => { setUrl(item.url); onParse(item.url) }}
              className="px-3 py-1 rounded-full glass-card text-gray-400 hover:text-white hover:border-purple-500/50 transition-all cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
