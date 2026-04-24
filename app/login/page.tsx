'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/auth-context'
import { PinForm } from '@/components/auth/pin-form'
import { Shield, Building2, CheckCircle2, Eye, Users } from 'lucide-react'

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
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-sm text-muted-foreground font-medium">Authenticating...</span>
        </div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <main className="min-h-screen bg-background grain-overlay">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 20% 20%, hsl(36 100% 50% / 0.06), transparent 70%), radial-gradient(ellipse 40% 40% at 80% 80%, hsl(36 100% 50% / 0.04), transparent 60%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Top brand mark */}
        <div className="mb-10 flex items-center gap-3 page-enter">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">AskNyumbani</p>
            <p className="text-xs text-muted-foreground tracking-wide uppercase">Operations Console</p>
          </div>
        </div>

        {/* Login card */}
        <div className="w-full max-w-[420px] page-enter" style={{ animationDelay: '0.1s' }}>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5 corner-accent">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Admin Login</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your 4-digit PIN to access moderation tools.
              </p>
            </div>

            <PinForm onSuccess={() => router.push('/')} />

            <div className="mt-6 text-xs text-muted-foreground/70 leading-relaxed">
              By continuing, you accept internal security and moderation policy terms.
            </div>
          </div>
        </div>

        {/* Feature pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-2 page-enter" style={{ animationDelay: '0.2s' }}>
          {[
            { icon: Eye, label: 'Real-time moderation' },
            { icon: CheckCircle2, label: 'Approval workflows' },
            { icon: Building2, label: 'Property oversight' },
            { icon: Users, label: 'Vendor management' },
          ].map((item) => (
            <div
              key={item.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground"
            >
              <item.icon className="h-3 w-3 text-primary/70" />
              {item.label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-muted-foreground/60 page-enter" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-center gap-3">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <span className="text-border">|</span>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="mt-2">Codzure Solutions Limited</p>
        </footer>
      </div>
    </main>
  )
}
