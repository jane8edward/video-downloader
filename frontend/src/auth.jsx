import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

async function readJsonOrThrow(res, fallback) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || fallback)
  }
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const refreshUser = useCallback(async () => {
    const data = await readJsonOrThrow(await fetch('/api/auth/me'), '获取用户状态失败')
    setUser(data.user || null)
    return data.user || null
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setIsAuthLoading(false))
  }, [refreshUser])

  const login = useCallback(async (email, password) => {
    const data = await readJsonOrThrow(
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
      '登录失败'
    )
    setUser(data.user)
    setAuthModalOpen(false)
    return data.user
  }, [])

  const register = useCallback(async (email, password) => {
    const data = await readJsonOrThrow(
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
      '注册失败'
    )
    setUser(data.user)
    setAuthModalOpen(false)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthLoading,
      authModalOpen,
      setAuthModalOpen,
      refreshUser,
      login,
      register,
      logout,
    }),
    [user, isAuthLoading, authModalOpen, refreshUser, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

