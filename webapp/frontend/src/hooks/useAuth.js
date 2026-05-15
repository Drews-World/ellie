import { useEffect } from 'react'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { setAuthToken } from '../lib/api'

export function useAuth() {
  const { getToken, isSignedIn, userId } = useClerkAuth()

  useEffect(() => {
    if (!isSignedIn) return
    const sync = async () => {
      const token = await getToken()
      setAuthToken(token)
    }
    sync()
    const id = setInterval(sync, 55_000)
    return () => clearInterval(id)
  }, [isSignedIn, getToken])

  return { isSignedIn, userId }
}
