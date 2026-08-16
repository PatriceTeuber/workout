import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** `undefined` while the stored session is still being restored, `null` when
 *  signed out. The distinction matters: without it the login screen flashes on
 *  every cold start. */
type State = Session | null | undefined

const SessionContext = createContext<State>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<State>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext value={session}>{children}</SessionContext>
}

export function useSession(): State {
  return use(SessionContext)
}
