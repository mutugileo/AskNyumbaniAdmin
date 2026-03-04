'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/auth-context'
import { OperationsDashboard } from '@/components/operations-dashboard'

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary/30 border-t-primary"></div>
          <span className="text-muted-foreground text-base font-medium">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <main className="app-shell min-h-screen">
      <div className="relative z-10 mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <OperationsDashboard />
      </div>
    </main>
  )
}
