import { useState } from 'react'
import { Loader2, Lock, Mail, X } from 'lucide-react'
import { useAuth } from '../auth.jsx'

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!authModalOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
    } catch (err) {
      setError(err.message || '操作失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setError('')
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151027] p-6 shadow-2xl shadow-purple-950/40">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'login' ? '登录 SaveAny' : '注册 SaveAny'}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {mode === 'login'
                ? '登录后即可使用你的会员权益。'
                : '注册后每天可免费使用 3 次 AI 总结。'}
            </p>
          </div>
          <button
            onClick={() => setAuthModalOpen(false)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">邮箱</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
              <Mail className="h-4 w-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 flex-1 bg-transparent text-white outline-none placeholder:text-gray-600"
                placeholder="you@example.com"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">密码</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
              <Lock className="h-4 w-4 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 flex-1 bg-transparent text-white outline-none placeholder:text-gray-600"
                placeholder="至少 8 位"
                minLength={8}
                required
              />
            </div>
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand font-semibold text-white transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <button
          onClick={switchMode}
          className="mt-5 w-full text-center text-sm text-purple-300 hover:text-purple-200"
        >
          {mode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}
        </button>
      </div>
    </div>
  )
}

