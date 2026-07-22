import { useEffect, useState } from 'react'
import { CheckCircle, X } from 'lucide-react'
import { useAuth } from '../auth.jsx'

export default function CheckoutReturn() {
  const { refreshUser } = useAuth()
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    const sessionId = params.get('session_id')
    if (!checkout) return

    if (checkout === 'success') {
      setMessage('支付完成，正在同步会员状态。如果刚支付完还没显示 VIP，请稍等几秒刷新。')
      fetch('/api/billing/sync-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .catch(() => {})
        .finally(() => {
          refreshUser().catch(() => {})
        })
    } else if (checkout === 'cancel') {
      setMessage('支付已取消，你可以随时重新选择会员套餐。')
    }

    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }, [refreshUser])

  if (!message) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-white/10 bg-[#151027]/95 p-4 shadow-2xl shadow-purple-950/40 backdrop-blur">
      <div className="flex items-start gap-3">
        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-400" />
        <p className="flex-1 text-sm leading-6 text-gray-200">{message}</p>
        <button onClick={() => setMessage('')} className="rounded-lg p-1 text-gray-500 hover:bg-white/5 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
