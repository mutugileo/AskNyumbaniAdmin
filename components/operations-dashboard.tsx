'use client'

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AccessControlDashboard } from '@/components/access-control-dashboard'
import { ConstructionControlDashboard } from '@/components/construction-control-dashboard'
import { DecorControlDashboard } from '@/components/decor-control-dashboard'
import { ImageReviewDashboard } from '@/components/image-review-dashboard'
import { MarketplaceOffersDashboard } from '@/components/marketplace-offers-dashboard'
import { PropertySubmissionDashboard } from '@/components/property-submission-dashboard'
import { RelocationModerationDashboard } from '@/components/relocation-moderation-dashboard'
import { ResaleControlDashboard } from '@/components/resale-control-dashboard'
import { cn } from '@/lib/utils'
import {
  Brush,
  Building2,
  ChevronRight,
  Download,
  ExternalLink,
  Hammer,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  Route,
  Shield,
  Store,
  Users,
} from 'lucide-react'

const modules = [
  'property_listings',
  'property_images',
  'relocation_ops',
  'resale_ops',
  'construct_ops',
  'decor_ops',
  'marketplace_offers',
  'identity_access',
] as const

type AdminModule = (typeof modules)[number]

type ModuleConfig = {
  id: AdminModule
  label: string
  shortLabel: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const moduleConfig: ModuleConfig[] = [
  {
    id: 'property_listings',
    label: 'Property Listings',
    shortLabel: 'Listings',
    description: 'Review new property submissions before publishing.',
    icon: Building2,
  },
  {
    id: 'property_images',
    label: 'Property Images',
    shortLabel: 'Images',
    description: 'Approve, reject, and quality-check listing images.',
    icon: ImageIcon,
  },
  {
    id: 'relocation_ops',
    label: 'Relocation',
    shortLabel: 'Relocation',
    description: 'Moderate movers, pricing rules, templates, and add-ons.',
    icon: Route,
  },
  {
    id: 'resale_ops',
    label: 'Resale',
    shortLabel: 'Resale',
    description: 'Control second-hand marketplace inventory.',
    icon: Store,
  },
  {
    id: 'construct_ops',
    label: 'Construction',
    shortLabel: 'Construction',
    description: 'Manage construction material catalog and sellers.',
    icon: Hammer,
  },
  {
    id: 'decor_ops',
    label: 'Decor',
    shortLabel: 'Decor',
    description: 'Moderate decor services, stores, and items.',
    icon: Brush,
  },
  {
    id: 'marketplace_offers',
    label: 'Offers & Negotiations',
    shortLabel: 'Offers',
    description: 'Track buyer-vendor negotiations and resolutions.',
    icon: MessageSquare,
  },
  {
    id: 'identity_access',
    label: 'Users & Vendors',
    shortLabel: 'Access',
    description: 'Control account access, sessions, and identity status.',
    icon: Users,
  },
]

function renderModule(module: AdminModule) {
  if (module === 'property_listings') return <PropertySubmissionDashboard />
  if (module === 'property_images') return <ImageReviewDashboard />
  if (module === 'relocation_ops') return <RelocationModerationDashboard />
  if (module === 'resale_ops') return <ResaleControlDashboard />
  if (module === 'construct_ops') return <ConstructionControlDashboard />
  if (module === 'decor_ops') return <DecorControlDashboard />
  if (module === 'identity_access') return <AccessControlDashboard />
  return <MarketplaceOffersDashboard />
}

export function OperationsDashboard() {
  const [module, setModule] = useState<AdminModule>('property_listings')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { user, logout } = useAuth()

  // Default to expanded sidebar on md+, closed drawer on mobile.
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    setSidebarOpen(mql.matches)
  }, [])

  const handleModuleChange = (next: AdminModule) => {
    setModule(next)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false)
    }
  }
  const vendorPortalUrl = process.env.NEXT_PUBLIC_VENDOR_PORTAL_URL ?? 'http://localhost:3001'
  const activeModule = moduleConfig.find((item) => item.id === module) ?? moduleConfig[0]

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleExportSnapshot = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      admin: user?.full_name ?? 'Unknown',
      activeModule: activeModule.label,
      availableModules: moduleConfig.map((item) => item.label),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `admin-snapshot-${Date.now()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile scrim */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ====== SIDEBAR ====== */}
      <aside
        className={cn(
          'admin-sidebar grain-overlay fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[0.06] transition-transform duration-300 md:static md:transition-all',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          sidebarOpen ? 'md:w-[260px]' : 'md:w-[68px]',
          !sidebarOpen && 'md:overflow-visible'
        )}
      >
        {/* Brand */}
        <div className="relative z-10 flex h-16 items-center gap-3 border-b border-white/[0.06] px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Shield className="h-4.5 w-4.5 text-primary" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">AskNyumbani</p>
              <p className="truncate text-[11px] text-white/40 tracking-wide uppercase">Admin</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 overflow-y-auto px-3 py-4">
          <div className="stagger-children space-y-0.5">
            {moduleConfig.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleModuleChange(item.id)}
                className={cn(
                  'nav-item',
                  module === item.id ? 'nav-item--active' : 'nav-item--inactive'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    {module === item.id && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                  </>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Sidebar footer */}
        <div className="relative z-10 border-t border-white/[0.06] p-3 space-y-1.5">
          {sidebarOpen && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-white/50 hover:text-white hover:bg-white/[0.06] text-xs"
            >
              <Link href={vendorPortalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Vendor Portal
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10 text-xs"
            disabled={isLoggingOut}
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && (isLoggingOut ? 'Logging out...' : 'Logout')}
          </Button>
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">{activeModule.label}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{activeModule.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportSnapshot}
              className="hidden gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>

            <div className="hidden h-6 w-px bg-border sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(user?.full_name ?? 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium leading-tight">{user?.full_name ?? 'Admin'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Module content */}
        <div className="page-enter p-4 sm:p-6">
          {renderModule(module)}
        </div>
      </main>
    </div>
  )
}
