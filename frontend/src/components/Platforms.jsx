export default function Platforms() {
  const platforms = [
    { name: 'YouTube', color: '#FF0000', icon: '▶' },
    { name: 'Bilibili', color: '#00A1D6', icon: 'B' },
    { name: '抖音', color: '#000000', icon: '♪' },
    { name: 'TikTok', color: '#010101', icon: '♪' },
    { name: 'Twitter/X', color: '#1DA1F2', icon: '𝕏' },
    { name: 'Instagram', color: '#E4405F', icon: '📷' },
    { name: 'Facebook', color: '#1877F2', icon: 'f' },
    { name: 'Vimeo', color: '#1AB7EA', icon: '▷' },
    { name: 'Twitch', color: '#9146FF', icon: '🎮' },
    { name: '快手', color: '#FF6600', icon: 'K' },
    { name: '小红书', color: '#FE2C55', icon: '📕' },
    { name: '微博', color: '#E6162D', icon: 'W' },
  ]

  return (
    <section className="py-20 px-4" id="platforms">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          支持 <span className="gradient-text">1000+</span> 视频平台
        </h2>
        <p className="text-gray-400 text-lg mb-12 max-w-xl mx-auto">
          覆盖全球主流视频平台，一个工具搞定所有下载需求
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {platforms.map((p) => (
            <div
              key={p.name}
              className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 hover:border-purple-500/30 hover:bg-white/[0.08] transition-all cursor-default group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold group-hover:scale-110 transition-transform"
                style={{ background: `${p.color}30`, borderColor: `${p.color}50`, borderWidth: 1 }}
              >
                {p.icon}
              </div>
              <span className="text-sm text-gray-300 font-medium">{p.name}</span>
            </div>
          ))}
        </div>

        <p className="text-gray-500 text-sm mt-8">
          以及 Dailymotion、SoundCloud、Nicovideo、Youku 等更多平台...
        </p>
      </div>
    </section>
  )
}
