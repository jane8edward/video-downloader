import { HelpCircle } from 'lucide-react'
import { SEO_FAQS } from '../seo/metadata'

export default function FAQ() {
  return (
    <section className="py-20 px-4" id="faq">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            万能视频下载器常见问题
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            面向视频保存、学习整理和内容创作素材下载的核心使用场景
          </p>
        </div>

        <div className="space-y-4">
          {SEO_FAQS.map((item) => (
            <article key={item.question} className="glass-card rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.answer}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
