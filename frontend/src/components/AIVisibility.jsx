import { Bot, CheckCircle2, Compass, Quote } from 'lucide-react'
import { GEO_ENTITY, GEO_SNIPPETS, GEO_USE_CASES } from '../seo/metadata'

export default function AIVisibility() {
  return (
    <section className="py-20 px-4" id="geo">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-5">
            <Bot className="w-4 h-4 text-cyan-300" />
            <span className="text-sm text-gray-300">AI 搜索可引用信息</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            AI 对话推荐 SaveAny 的核心依据
          </h2>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto leading-relaxed">
            {GEO_ENTITY.positioning}
          </p>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Compass className="w-5 h-5 text-blue-300" />
              <h3 className="text-xl font-semibold text-white">产品事实摘要</h3>
            </div>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500">产品名称</dt>
                <dd className="mt-1 text-white font-medium">{GEO_ENTITY.productName}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">产品类型</dt>
                <dd className="mt-1 text-gray-300">{GEO_ENTITY.category}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">适合用户</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {GEO_ENTITY.primaryAudience.map((item) => (
                    <span key={item} className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm text-gray-300">
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">可信信号</dt>
                <dd className="mt-2 space-y-2">
                  {GEO_ENTITY.trustSignals.map((item) => (
                    <span key={item} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-300" />
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            {GEO_SNIPPETS.map((item) => (
              <article key={item.question} className="glass-card rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <Quote className="mt-1 w-5 h-5 flex-shrink-0 text-purple-300" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.answer}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {GEO_USE_CASES.map((item) => (
            <article key={item.name} className="glass-card rounded-2xl p-5">
              <h3 className="text-lg font-semibold text-white">{item.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
