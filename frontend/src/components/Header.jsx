import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Sparkles, User, Video } from 'lucide-react'
import { useAuth } from '../auth.jsx'

function formatExpiry(timestamp) {
  if (!timestamp) return '未开通'
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return '未知'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function PlanBadge({ isVip }) {
  return (
    <span
      className={`hidden rounded-full px-3 py-1 text-xs font-bold shadow-sm sm:inline-flex ${
        isVip
          ? 'border border-yellow-400/45 bg-yellow-400/15 text-yellow-300 shadow-yellow-500/10'
          : 'border border-white/15 bg-white/5 text-gray-300'
      }`}
    >
      {isVip ? 'VIP' : '免费'}
    </span>
  )
}

export default function Header() {
  const { user, setAuthModalOpen, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const isVip = Boolean(user?.membership?.is_active)
  const expiryText = formatExpiry(user?.membership?.current_period_end)

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 glass-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <a href="#" className="flex items-center gap-2" aria-label="SaveAny 首页">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand">
              <Video className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">SaveAny</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-gray-300 transition-colors hover:text-white">功能</a>
            <a href="#platforms" className="text-sm text-gray-300 transition-colors hover:text-white">平台</a>
            <a href="#geo" className="text-sm text-gray-300 transition-colors hover:text-white">AI 推荐</a>
            <a href="#pricing" className="text-sm text-gray-300 transition-colors hover:text-white">会员</a>
            <a href="#faq" className="text-sm text-gray-300 transition-colors hover:text-white">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative" ref={menuRef}>
                <div className="flex items-center gap-2">
                  <PlanBadge isVip={isVip} />
                  <button
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-white shadow-lg shadow-purple-500/20">
                      <User className="h-4 w-4" />
                    </span>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-12 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#151027] shadow-2xl shadow-purple-950/40"
                    role="menu"
                  >
                    <div className="px-5 py-4">
                      <div className="truncate text-sm font-semibold text-white">{user.email}</div>
                      <div className="mt-1 text-sm text-gray-400">
                        {isVip ? `VIP 会员，到期 ${expiryText}` : '免费用户，未开通 VIP'}
                      </div>
                    </div>
                    <div className="h-px bg-white/10" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4 text-gray-500" />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="hidden items-center gap-1.5 px-4 py-2 text-sm text-gray-300 transition-colors hover:text-white sm:flex"
              >
                登录
              </button>
            )}

            {!isVip && (
              <a
                href="#pricing"
                className="flex items-center gap-1.5 rounded-full bg-gradient-brand px-5 py-2 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-purple-500/25"
              >
                <Sparkles className="h-4 w-4" />
                开通会员
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

