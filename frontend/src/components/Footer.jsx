import { Video, Heart } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">SaveAny</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">使用条款</a>
            <a href="#" className="hover:text-gray-300 transition-colors">隐私政策</a>
            <a href="#" className="hover:text-gray-300 transition-colors">联系我们</a>
          </div>

          <p className="flex items-center gap-1 text-sm text-gray-500">
            Made with <Heart className="w-4 h-4 text-red-500" /> by SaveAny
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-600">
            本工具仅供个人学习使用，请尊重视频版权，切勿用于商业用途。
          </p>
        </div>
      </div>
    </footer>
  )
}
