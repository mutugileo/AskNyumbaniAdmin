'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/auth-context'
import { PinForm } from '@/components/auth/pin-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

export default function LoginPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <main className="app-shell min-h-screen">
      <section className="relative z-10 container mx-auto px-6 py-14">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-border/70 bg-card/75 p-10 shadow-[0_12px_28px_-18px_hsl(var(--foreground)/0.35)] backdrop-blur-xl">
            <div className="mb-8 inline-flex rounded-2xl border border-primary/25 bg-primary/10 p-3">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-foreground">AskNyumbani Operations Console</h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Moderate vendor submissions, approve marketplace listings, and control what appears in the consumer app.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">Real-time moderation queue</div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">Approval-led publishing flow</div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">Vendor integration oversight</div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">Audit-ready activity history</div>
            </div>
          </div>

          <Card className="border-border/70 bg-card/90 shadow-[0_10px_24px_-16px_hsl(var(--foreground)/0.35)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-3xl">Admin Login</CardTitle>
              <CardDescription>Enter your 4-digit PIN to access moderation tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PinForm onSuccess={() => router.push('/')} />
              <div className="text-xs text-muted-foreground">
                By continuing, you accept internal security and moderation policy terms.
              </div>
            </CardContent>
          </Card>
        </div>

        <footer className="mt-10 text-center text-sm text-muted-foreground space-y-2">
          <div className="flex justify-center items-center gap-3 flex-wrap">
            <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors hover:underline">
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors hover:underline">
              Terms of Service
            </Link>
          </div>
          <p>© 2026 Codzure Solutions Limited. All rights reserved.</p>
        </footer>
      </section>
    </main>
  )
}
