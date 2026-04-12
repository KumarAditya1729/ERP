'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthProvider({ children }: any) {
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        window.location.href = '/login'
      }
    })
  }, [])

  return children
}
