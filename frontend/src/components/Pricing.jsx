import { Check, Crown, Sparkles, Star } from 'lucide-react'

export default function Pricing() {
  const plans = [
    {
      name: '免费版',
      price: '0',
      period: '永久免费',
      desc: '满足基础下载需求',
      features: [
        '每日 3 次下载',
        '最高 720P 画质',
        '单个视频下载',
        '基础平台支持',
      ],
      cta: '立即使用',
      highlight: false,
      icon: Star,
    },
    {
      name: '专业版',
      price: '29.9',
      period: '/月',
      desc: '高效下载，不受限制',
      badge: '最受欢迎',
      features: [
        '无限次下载',
        '最高 4K 画质',
        '批量下载',
        '全平台支持',
        '优先下载通道',
        '视频转 MP3',
      ],
      cta: '立即开通',
      highlight: true,
      icon: Crown,
    },
    {
      name: '年度会员',
      price: '199',
      period: '/年',
      desc: '最优惠的选择',
      badge: '省 44%',
      features: [
        '专业版全部功能',
        '字幕下载',
        '视频 AI 总结',
        '字幕翻译',
        '专属客服',
        'API 接口调用',
      ],
      cta: '立即开通',
      highlight: false,
      icon: Sparkles,
    },
  ]

  return (
    <section className="py-20 px-4" id="pricing">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            选择适合你的 <span className="gradient-text">套餐</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            免费即可体验，升级解锁全部能力
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 transition-all ${
                plan.highlight
                  ? 'bg-gradient-to-b from-purple-500/20 to-blue-500/10 border-2 border-purple-500/50 shadow-xl shadow-purple-500/10 scale-[1.03]'
                  : 'glass-card hover:border-purple-500/20'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-brand rounded-full text-xs font-semibold text-white">
                  {plan.badge}
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <plan.icon className={`w-5 h-5 ${plan.highlight ? 'text-purple-400' : 'text-gray-400'}`} />
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              </div>

              <div className="mb-2">
                <span className="text-4xl font-extrabold text-white">
                  {plan.price === '0' ? '免费' : `¥${plan.price}`}
                </span>
                {plan.price !== '0' && (
                  <span className="text-gray-400 text-sm ml-1">{plan.period}</span>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-6">{plan.desc}</p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? 'text-purple-400' : 'text-gray-500'}`} />
                    <span className="text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.highlight
                    ? 'bg-gradient-brand text-white hover:shadow-lg hover:shadow-purple-500/30'
                    : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Trust */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            安全支付 · 随时取消 · 7天无理由退款
          </p>
        </div>
      </div>
    </section>
  )
}
