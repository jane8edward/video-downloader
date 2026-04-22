import { Download, Smartphone, Shield, Zap, Globe, Film } from 'lucide-react'

export default function Features() {
  const features = [
    {
      icon: Download,
      title: '最高画质下载',
      desc: '支持 4K、1080P 等多种清晰度，自动选择最佳画质',
      color: 'from-purple-500 to-indigo-500',
    },
    {
      icon: Globe,
      title: '1000+ 平台支持',
      desc: 'YouTube、B站、抖音、TikTok、Twitter 等全球主流平台',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Smartphone,
      title: '手机也能用',
      desc: '响应式设计，随时随地在手机浏览器上使用，无需安装 App',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      icon: Zap,
      title: '极速解析',
      desc: '秒级获取视频信息，高速下载通道，不限速不等待',
      color: 'from-orange-500 to-amber-500',
    },
    {
      icon: Film,
      title: '音视频分离',
      desc: '支持仅下载音频（MP3），满足听歌、配音等多种需求',
      color: 'from-pink-500 to-rose-500',
    },
    {
      icon: Shield,
      title: '安全可靠',
      desc: '无需登录、无需安装插件，基于开源项目，安全透明',
      color: 'from-violet-500 to-purple-500',
    },
  ]

  return (
    <section className="py-20 px-4" id="features">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            为什么选择 <span className="gradient-text">SaveAny</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            功能强大、简单易用，满足你的一切视频下载需求
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass-card rounded-2xl p-6 hover:border-purple-500/30 hover:bg-white/[0.06] transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
