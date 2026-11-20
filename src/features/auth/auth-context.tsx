import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { INVALIDATION_KEYS } from '@/lib/query-keys'
import type { AuthSession, Profile } from '@/types'

interface AuthContextValue {
  session: AuthSession | null
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(null)
  const [loading, setLoading] = React.useState(true)
  const queryClient = useQueryClient()

  const applyPendingInvite = React.useCallback(
    async (next: AuthSession | null) => {
      if (!next || next.profile.role !== 'student') return
      const code = localStorage.getItem('vector.pendingInvite')
      if (!code) return
      localStorage.removeItem('vector.pendingInvite')
      try {
        await api.students.acceptInvitation(code)
        INVALIDATION_KEYS.forEach((key) => {
          void queryClient.invalidateQueries({ queryKey: key })
        })
        const refreshed = await api.auth.getSession()
        setSession(refreshed)
      } catch {
        // Код мог истечь или быть использован — пользователь введёт его на /app/join.
      }
    },
    [queryClient],
  )

  React.useEffect(() => {
    let active = true
    api.auth
      .getSession()
      .then((next) => {
        if (active) {
          setSession(next)
          void applyPendingInvite(next)
        }
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const unsubscribe = api.auth.onAuthStateChange((next) => {
      if (!active) return
      setSession(next)
      void applyPendingInvite(next)
      if (!next) queryClient.clear()
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [applyPendingInvite, queryClient])

  const refresh = React.useCallback(async () => {
    const next = await api.auth.getSession()
    setSession(next)
  }, [])

  const signOut = React.useCallback(async () => {
    await api.auth.signOut()
    setSession(null)
    queryClient.clear()
  }, [queryClient])

  const value = React.useMemo(
    () => ({ session, profile: session?.profile ?? null, loading, refresh, signOut }),
    [session, loading, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return context
}

export function homePath(role: Profile['role']) {
  return role === 'curator' ? '/app/overview' : '/app/home'
}
