import { useState } from 'react'
import { Check, Crown, Loader2, Sparkles, Star } from 'lucide-react'
import { useAuth } from '../auth.jsx'

const DEFAULT_HIGHLIGHT_PLAN = 'monthly'

const plans = [
  {
    id: 'free',
    name: '免费版',
    price: '0',
    period: '永久免费',
    desc: '下载功能完整开放，适合日常保存视频。',
    features: [
      '不限下载次数',
      '不限下载清晰度',
      '支持 1000+ 平台',
      '实时下载进度',
      '不含 AI 总结和 AI 对话',
    ],
    cta: '立即使用',
    badge: '',
    icon: Star,
  },
  {
    id: 'monthly',
    name: '月度会员',
    price: '9.9',
    period: '/30 天',
    desc: '一次性购买 30 天 AI 权益，不自动续费。',
    badge: '推荐入门',
    features: [
      '包含免费版全部能力',
      'AI 视频总结',
      '章节大纲生成',
      '思维导图生成',
      '基于视频内容 AI 对话',
    ],
    cta: '购买 30 天会员',
    icon: Crown,
  },
  {
    id: 'yearly',
    name: '年度会员',
    price: '68',
    period: '/365 天',
    desc: '一次性购买 365 天 AI 权益，到期后可再续费。',
    badge: '省 43%',
    features: [
      '包含月度会员全部能力',
      '全年 AI 总结权益',
      '全年 AI 对话权益',
      '后续会员功能优先开放',
      '不自动扣款，到期再手动续费',
    ],
    cta: '购买年度会员',
    icon: Sparkles,
  },
]

export default function Pricing() {
  const { user, setAuthModalOpen, refreshUser } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState('')
  const [hoveredPlan, setHoveredPlan] = useState('')
  const [error, setError] = useState('')

  const activePlan = hoveredPlan || DEFAULT_HIGHLIGHT_PLAN

  const handleCheckout = async (planId) => {
    setError('')

    if (planId === 'free') {
      window.location.hash = '#'
      return
    }

    if (!user) {
      setAuthModalOpen(true)
      return
    }

    setLoadingPlan(planId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || '创建支付失败')
      window.location.href = data.url
    } catch (err) {
      setError(err.message || '创建支付失败')
      refreshUser().catch(() => {})
    } finally {
      setLoadingPlan('')
    }
  }

  return (
    <section className="px-4 py-20" id="pricing">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            选择适合你的 <span className="gradient-text">会员套餐</span>
          </h2>
          <p className="mx-auto max-w-xl text-lg text-gray-400">
            下载永久免费；会员一次性购买，不自动续费，只解锁 AI 总结、章节大纲、思维导图和 AI 对话。
          </p>
        </div>

        <div className="grid items-start gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isLoading = loadingPlan === plan.id
            const isActive = activePlan === plan.id

            return (
              <div
                key={plan.id}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan('')}
                className={`relative rounded-2xl p-6 transition-all duration-200 ${
                  isActive
                    ? 'scale-[1.03] border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/20 to-blue-500/10 shadow-xl shadow-purple-500/10'
                    : 'glass-card hover:border-purple-500/20'
                }`}
              >
                {plan.badge && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold text-white transition-opacity ${
                      isActive ? 'bg-gradient-brand opacity-100' : 'bg-white/10 opacity-70'
                    }`}
                  >
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4 flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                </div>

                <div className="mb-2">
                  <span className="text-4xl font-extrabold text-white">
                    {plan.price === '0' ? '免费' : `¥${plan.price}`}
                  </span>
                  {plan.price !== '0' && <span className="ml-1 text-sm text-gray-400">{plan.period}</span>}
                </div>
                <p className="mb-6 min-h-[44px] text-sm text-gray-400">{plan.desc}</p>

                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-purple-400' : 'text-gray-500'}`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={Boolean(loadingPlan)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive
                      ? 'bg-gradient-brand text-white hover:shadow-lg hover:shadow-purple-500/30'
                      : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mx-auto mt-8 max-w-xl rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Stripe 安全支付 · 一次性付款 · Webhook 自动开通会员 · 下载功能免费开放
          </p>
        </div>
      </div>
    </section>
  )
}

