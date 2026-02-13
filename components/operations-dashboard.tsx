'use client'

import { useMemo, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Filter,
  Hammer,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Route,
  ShieldCheck,
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
  const [showInsights, setShowInsights] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { user, logout } = useAuth()
  const vendorPortalUrl = process.env.NEXT_PUBLIC_VENDOR_PORTAL_URL ?? 'http://localhost:3001'
  const activeModule = moduleConfig.find((item) => item.id === module) ?? moduleConfig[0]

  const overviewStats = useMemo(
    () => [
      { label: 'Active Modules', value: moduleConfig.length.toString(), delta: '+2 this quarter' },
      { label: 'Approval Lanes', value: '5', delta: 'Listings, images, catalogs' },
      { label: 'Vendor Touchpoints', value: '3', delta: 'Portal, offers, relocation' },
      { label: 'Current Focus', value: activeModule.shortLabel, delta: 'Selected module' },
    ],
    [activeModule.shortLabel]
  )

  const sourceMix = [
    { label: 'Vendor Submissions', value: 62 },
    { label: 'Admin Entries', value: 24 },
    { label: 'Partner Inputs', value: 14 },
  ]

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
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="rounded-3xl border border-border/70 bg-card/95 p-3 shadow-[0_22px_52px_-34px_hsl(var(--foreground)/0.55)] sm:p-4 lg:p-5">
        <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-border/70 bg-muted/25 p-4">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">AskNyumbani</p>
                <p className="text-xs text-muted-foreground">Admin Console</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {moduleConfig.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModule(item.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                    module === item.id
                      ? 'border-primary/35 bg-primary/10 text-primary'
                      : 'border-transparent bg-transparent text-foreground/80 hover:border-border/70 hover:bg-background'
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </button>
              ))}
            </nav>

            <div className="mt-6 space-y-2">
              <Button asChild variant="outline" className="w-full justify-start rounded-xl">
                <Link href={vendorPortalUrl} target="_blank" rel="noreferrer">
                  Open Vendor Portal
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start rounded-xl text-destructive hover:text-destructive"
                disabled={isLoggingOut}
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Button>
            </div>
          </aside>

          <section className="space-y-4">
            <Card className="border-border/70 bg-card shadow-[0_10px_26px_-20px_hsl(var(--foreground)/0.4)]">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Hello, {user?.full_name ?? 'Admin'}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Moderate user submissions and publish quality content to the app.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setShowInsights((prev) => !prev)}
                    >
                      <Filter className="mr-2 h-4 w-4" />
                      {showInsights ? 'Hide Insights' : 'Show Insights'}
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={handleExportSnapshot}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {overviewStats.map((stat) => (
                    <Card key={stat.label} className="border-border/75 bg-background/80 shadow-none">
                      <CardContent className="space-y-1 p-4">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">{stat.delta}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {showInsights && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
                <Card className="border-border/75 bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Module Workspace</CardTitle>
                        <CardDescription>Current control lane and supporting workflows.</CardDescription>
                      </div>
                      <Badge variant="secondary" className="rounded-md">
                        {activeModule.shortLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2.5">
                      {moduleConfig.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'rounded-xl border px-3 py-2.5',
                            item.id === module ? 'border-primary/35 bg-primary/10' : 'border-border/70 bg-background/70'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{item.label}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <p className="text-sm font-medium">Throughput Trend</p>
                      <p className="mb-3 text-xs text-muted-foreground">Moderation completions by week</p>
                      <svg viewBox="0 0 260 120" className="h-28 w-full">
                        <polyline
                          points="10,95 48,72 86,68 124,60 162,44 200,50 238,28"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="text-primary"
                        />
                        <line x1="10" y1="95" x2="238" y2="95" stroke="currentColor" strokeOpacity="0.2" />
                      </svg>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>May</span>
                        <span>Jun</span>
                        <span>Jul</span>
                        <span>Aug</span>
                        <span>Sep</span>
                        <span>Oct</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-border/75 bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Submission Sources</CardTitle>
                      <CardDescription>Where approved data enters operations.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {sourceMix.map((source) => (
                        <div key={source.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span>{source.label}</span>
                            <span className="font-medium">{source.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-foreground/75"
                              style={{ width: `${source.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-border/75 bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Recent Activity</CardTitle>
                      <CardDescription>Latest moderation operations.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <ActivityItem label="Property listing approved" value="KES 14,800" timestamp="2 min ago" />
                      <ActivityItem label="Resale item rejected (quality)" value="KES 0" timestamp="8 min ago" />
                      <ActivityItem label="Decor package published" value="KES 9,200" timestamp="15 min ago" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <Card className="border-border/75 bg-card/95 shadow-[0_18px_30px_-24px_hsl(var(--foreground)/0.5)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{activeModule.label}</CardTitle>
                    <CardDescription>{activeModule.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-lg">
                    <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                    Live Workspace
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>{renderModule(module)}</CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}

function ActivityItem({ label, value, timestamp }: { label: string; value: string; timestamp: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        </div>
        <span className="text-right font-medium">{value}</span>
      </div>
    </div>
  )
}
