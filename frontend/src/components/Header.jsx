import { Video, Sparkles } from 'lucide-react'

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">SaveAny</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-300 hover:text-white transition-colors">功能特性</a>
            <a href="#platforms" className="text-sm text-gray-300 hover:text-white transition-colors">支持平台</a>
            <a href="#pricing" className="text-sm text-gray-300 hover:text-white transition-colors">会员套餐</a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
              登录
            </button>
            <button className="flex items-center gap-1.5 px-5 py-2 bg-gradient-brand rounded-full text-sm font-medium text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all">
              <Sparkles className="w-4 h-4" />
              开通会员
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
