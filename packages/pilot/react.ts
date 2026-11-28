import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { messages, type Dashboard, type Operations } from './index'

export function usePilot(client: SupabaseClient | null, requestId: () => string) {
  const [member, setMember] = useState<string | null | undefined>(client ? undefined : null)
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const refreshIndex = useRef(0)
  const retry = useRef(new Map<string, string>())

  useEffect(() => {
    if (!client) return
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setMember(session?.user.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [client])

  const refresh = useCallback(async () => {
    if (!client || !member) return
    const index = ++refreshIndex.current
    const { data: dashboard, error: failure } = await client.rpc('pilot_dashboard')
    if (index !== refreshIndex.current) return
    if (failure) setError(messages[failure.message] ?? 'Veriler yüklenemedi. Yeniden deneyin.')
    else {
      setData(dashboard as Dashboard)
      setError('')
    }
  }, [client, member])

  useEffect(() => {
    setData(null)
    setError('')
    retry.current.clear()
    if (!member) return
    void refresh()
    return () => { refreshIndex.current++ }
  }, [member, refresh])

  async function authenticate(email: string, token?: string) {
    if (!client || running.current) return false
    running.current = true
    setBusy(true)
    setError('')
    try {
      const address = email.trim().toLowerCase()
      const result = token
        ? await client.auth.verifyOtp({ email: address, token: token.trim(), type: 'email' })
        : await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } })
      if (result.error) {
        const { code, name } = result.error
        if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
          setError('Çok sık deneme yapıldı. Biraz bekleyip tekrar deneyin.')
        } else if (name === 'AuthRetryableFetchError') {
          setError('Bağlantı kurulamadı. Yeniden deneyin.')
        } else {
          setError(token ? 'Kod geçersiz veya süresi dolmuş.' : 'Kod gönderilemedi. Davetli e-postanızı kontrol edin.')
        }
        return false
      }
      return true
    } catch {
      setError('Bağlantı kurulamadı. Yeniden deneyin.')
      return false
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  async function act<K extends keyof Operations>(operation: K, payload: Operations[K]) {
    if (!client || !member || running.current) return false
    running.current = true
    setBusy(true)
    setError('')
    const key = JSON.stringify([operation, payload])
    try {
      const id = retry.current.get(key) ?? requestId()
      retry.current.set(key, id)
      const { error: failure } = await client.rpc('pilot_action', { operation, payload, request_id: id })
      if (failure) {
        const message = messages[failure.message]
          ?? (failure.code === '23505' ? messages.ALREADY_EXISTS : /^(22|23)/.test(failure.code ?? '') ? messages.INVALID_INPUT : null)
        if (message) retry.current.delete(key)
        setError(message ?? 'İşlem sonucu alınamadı. Aynı işlemi yeniden deneyin.')
        return false
      }
      retry.current.delete(key)
      await refresh()
      return true
    } catch {
      setError('İşlem sonucu alınamadı. Aynı işlemi yeniden deneyin.')
      return false
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  async function signOut() {
    if (running.current) return
    const result = await client?.auth.signOut({ scope: 'local' })
    if (result?.error) setError('Oturum kapatılamadı. Yeniden deneyin.')
  }

  return { member, data: data?.profile.id === member ? data : null, error, busy, authenticate, refresh, act, signOut }
}
