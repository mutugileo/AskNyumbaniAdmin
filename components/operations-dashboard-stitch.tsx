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
    Hammer,
    Image as ImageIcon,
    LayoutDashboard,
    LogOut,
    MessageSquare,
    Route,
    ShieldCheck,
    Store,
    Users,
    Activity,
    TrendingUp,
    Clock,
    Sparkles,
    Home,
    Settings,
    Bell,
    User,
    HelpCircle,
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
    color: string
    gradient: string
}

const moduleConfig: ModuleConfig[] = [
    {
        id: 'property_listings',
        label: 'Property Listings',
        shortLabel: 'Listings',
        description: 'Review new property submissions before publishing.',
        icon: Building2,
        color: 'from-blue-500 to-cyan-500',
        gradient: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10',
    },
    {
        id: 'property_images',
        label: 'Property Images',
        shortLabel: 'Images',
        description: 'Approve, reject, and quality-check listing images.',
        icon: ImageIcon,
        color: 'from-purple-500 to-pink-500',
        gradient: 'bg-gradient-to-br from-purple-500/10 to-pink-500/10',
    },
    {
        id: 'relocation_ops',
        label: 'Relocation',
        shortLabel: 'Relocation',
        description: 'Moderate movers, pricing rules, templates, and add-ons.',
        icon: Route,
        color: 'from-emerald-500 to-teal-500',
        gradient: 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10',
    },
    {
        id: 'resale_ops',
        label: 'Resale',
        shortLabel: 'Resale',
        description: 'Control second-hand marketplace inventory.',
        icon: Store,
        color: 'from-orange-500 to-yellow-500',
        gradient: 'bg-gradient-to-br from-orange-500/10 to-yellow-500/10',
    },
    {
        id: 'construct_ops',
        label: 'Construction',
        shortLabel: 'Construction',
        description: 'Manage construction material catalog and sellers.',
        icon: Hammer,
        color: 'from-amber-500 to-orange-500',
        gradient: 'bg-gradient-to-br from-amber-500/10 to-orange-500/10',
    },
    {
        id: 'decor_ops',
        label: 'Decor',
        shortLabel: 'Decor',
        description: 'Moderate decor services, stores, and items.',
        icon: Brush,
        color: 'from-rose-500 to-pink-500',
        gradient: 'bg-gradient-to-br from-rose-500/10 to-pink-500/10',
    },
    {
        id: 'marketplace_offers',
        label: 'Offers & Negotiations',
        shortLabel: 'Offers',
        description: 'Track buyer-vendor negotiations and resolutions.',
        icon: MessageSquare,
        color: 'from-indigo-500 to-purple-500',
        gradient: 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10',
    },
    {
        id: 'identity_access',
        label: 'Users & Vendors',
        shortLabel: 'Access',
        description: 'Control account access, sessions, and identity status.',
        icon: Users,
        color: 'from-violet-500 to-fuchsia-500',
        gradient: 'bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10',
    },
]

type MainNavItem = {
    id: string
    label: string
    icon: ComponentType<{ className?: string }>
    badge?: number
}

const mainNavItems: MainNavItem[] = [
    {
        id: 'overview',
        label: 'Overview',
        icon: Home,
    },
    {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        badge: 5,
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
    },
    {
        id: 'profile',
        label: 'Profile',
        icon: User,
    },
    {
        id: 'help',
        label: 'Help',
        icon: HelpCircle,
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

export function OperationsDashboardStitch() {
    const [module, setModule] = useState<AdminModule>('property_listings')
    const [showBento, setShowBento] = useState(true)
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [activeNavItem, setActiveNavItem] = useState('overview')
    const { user, logout } = useAuth()
    const vendorPortalUrl = process.env.NEXT_PUBLIC_VENDOR_PORTAL_URL ?? 'http://localhost:3001'
    const activeModule = moduleConfig.find((item) => item.id === module) ?? moduleConfig[0]

    const bentoStats = useMemo(
        () => [
            {
                label: 'Total Operations',
                value: '847',
                delta: '+12%',
                trend: 'up',
                icon: Activity,
                color: 'text-blue-500'
            },
            {
                label: 'Pending Reviews',
                value: '23',
                delta: '-8%',
                trend: 'down',
                icon: Clock,
                color: 'text-amber-500'
            },
            {
                label: 'Active Modules',
                value: moduleConfig.length.toString(),
                delta: '+2',
                trend: 'up',
                icon: LayoutDashboard,
                color: 'text-emerald-500'
            },
            {
                label: 'Quality Score',
                value: '94%',
                delta: '+3%',
                trend: 'up',
                icon: TrendingUp,
                color: 'text-purple-500'
            },
        ],
        []
    )

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
        <div className="relative w-full">
            {/* Desktop: Left Module Navigation */}
            <aside className="fixed left-4 top-4 bottom-4 z-50 hidden w-64 lg:flex flex-col">
                <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-card/95 via-card/90 to-card/95 p-4 shadow-2xl backdrop-blur-xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-accent/5" />

                    {/* Sidebar Header: User Info */}
                    <div className="relative z-10 mb-6 flex items-center gap-3 border-b border-border/50 pb-4">
                        <div className="rounded-xl border border-primary/30 bg-primary/10 p-2">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="truncate font-bold tracking-tight">Hello, {user?.full_name?.split(' ')[0] ?? 'Admin'}</p>
                            <p className="text-xs text-muted-foreground">Admin Console</p>
                        </div>
                    </div>

                    {/* Module List */}
                    <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border/50 hover:scrollbar-thumb-border">
                        {moduleConfig.map((item) => {
                            const isActive = module === item.id
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setModule(item.id)}
                                    className={cn(
                                        "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200",
                                        isActive
                                            ? "border-primary/50 bg-gradient-to-r from-primary/10 to-transparent text-foreground shadow-sm"
                                            : "border-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                    )}
                                >
                                    <div className={cn(
                                        "rounded-lg p-1.5 transition-colors",
                                        isActive ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground group-hover:text-foreground"
                                    )}>
                                        <item.icon className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium">{item.label}</span>
                                    {isActive && (
                                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                                    )}
                                </button>
                            )
                        })}
                    </nav>

                    {/* Sidebar Footer: Actions & Info */}
                    <div className="relative z-10 mt-4 space-y-2 border-t border-border/50 pt-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-full justify-start rounded-lg border-white/20 bg-white/5 text-[10px] backdrop-blur-sm hover:bg-white/10"
                                onClick={() => setShowBento((prev) => !prev)}
                                title={showBento ? 'Hide Stats' : 'Show Stats'}
                            >
                                <LayoutDashboard className="mr-2 h-3 w-3" />
                                {showBento ? 'Hide' : 'Show'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-full justify-start rounded-lg border-white/20 bg-white/5 text-[10px] backdrop-blur-sm hover:bg-white/10"
                                onClick={handleExportSnapshot}
                            >
                                <Download className="mr-2 h-3 w-3" />
                                Export
                            </Button>
                        </div>

                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 w-full justify-start rounded-lg border-white/20 bg-white/5 text-[10px] backdrop-blur-sm hover:bg-white/10"
                        >
                            <Link href={vendorPortalUrl} target="_blank" rel="noreferrer">
                                <Store className="mr-2 h-3 w-3" />
                                Vendor Portal
                            </Link>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start rounded-lg text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={isLoggingOut}
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-3 w-3" />
                            {isLoggingOut ? 'Logging out...' : 'Logout'}
                        </Button>

                        <div className="mt-2 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 p-2 text-center text-[10px] text-muted-foreground">
                            <p className="opacity-70">v2.4.0 (Stable)</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Desktop: Side Navigation (Right) */}
            <aside className="fixed right-4 top-1/2 z-50 hidden -translate-y-1/2 lg:block">
                <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-card/95 via-card/90 to-card/95 p-2 shadow-2xl backdrop-blur-xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-accent/5" />
                    <nav className="relative z-10 flex flex-col gap-2">
                        {mainNavItems.map((item) => {
                            const isActive = activeNavItem === item.id
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveNavItem(item.id)}
                                    className={cn(
                                        "group relative flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all duration-300",
                                        isActive
                                            ? "bg-gradient-to-br from-primary/20 to-accent/20 text-primary shadow-lg"
                                            : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                    )}
                                    title={item.label}
                                >
                                    {item.badge && (
                                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                                            {item.badge}
                                        </div>
                                    )}
                                    <item.icon className="h-5 w-5" />
                                    <span className="text-[10px] font-medium">{item.label}</span>

                                    {/* Active indicator */}
                                    {isActive && (
                                        <div className="absolute -left-2 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-accent" />
                                    )}
                                </button>
                            )
                        })}
                    </nav>
                </div>
            </aside>

            {/* Mobile/Tablet: Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
                <div className="relative mx-4 mb-4 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-r from-card/95 via-card/90 to-card/95 p-2 shadow-2xl backdrop-blur-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5" />
                    <nav className="relative z-10 flex items-center justify-around gap-1">
                        {mainNavItems.map((item) => {
                            const isActive = activeNavItem === item.id
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveNavItem(item.id)}
                                    className={cn(
                                        "group relative flex flex-col items-center gap-1 rounded-xl p-2.5 transition-all duration-300 flex-1",
                                        isActive
                                            ? "bg-gradient-to-br from-primary/20 to-accent/20 text-primary shadow-lg"
                                            : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                    )}
                                >
                                    {item.badge && (
                                        <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                                            {item.badge}
                                        </div>
                                    )}
                                    <item.icon className={cn(
                                        "h-5 w-5 transition-transform",
                                        isActive && "scale-110"
                                    )} />
                                    <span className={cn(
                                        "text-[10px] font-medium transition-all",
                                        isActive ? "opacity-100" : "opacity-70"
                                    )}>
                                        {item.label}
                                    </span>

                                    {/* Active indicator */}
                                    {isActive && (
                                        <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-b-full bg-gradient-to-r from-primary to-accent" />
                                    )}
                                </button>
                            )
                        })}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            {/* Main Content */}
            <div className="space-y-6 p-4 pb-24 lg:ml-72 lg:mr-24 lg:p-6 min-h-screen">
                {/* Glassmorphic Header - Mobile Only (Hidden on Desktop) */}
                <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-6 shadow-2xl backdrop-blur-xl lg:hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
                    <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        {/* Brand & Greeting */}
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-primary to-accent opacity-20 blur-xl" />
                                <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 to-accent/20 p-3 shadow-lg backdrop-blur-sm">
                                    <ShieldCheck className="h-8 w-8 text-primary" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                                    Hello, {user?.full_name ?? 'Admin'}
                                </h1>
                                <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    Admin Console
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20"
                                onClick={() => setShowBento((prev) => !prev)}
                            >
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                {showBento ? 'Hide' : 'Show'} Overview
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20"
                                onClick={handleExportSnapshot}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="rounded-full border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20"
                            >
                                <Link href={vendorPortalUrl} target="_blank" rel="noreferrer">
                                    Vendor Portal
                                </Link>
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={isLoggingOut}
                                onClick={handleLogout}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                {isLoggingOut ? 'Logging out...' : 'Logout'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Bento Box Stats Grid */}
                {showBento && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom duration-500">
                        {bentoStats.map((stat, idx) => (
                            <Card
                                key={stat.label}
                                className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:from-primary/5 group-hover:to-accent/5 group-hover:opacity-100" />
                                <CardContent className="relative p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                            <p className="mt-2 text-2xl lg:text-3xl font-bold tracking-tight">{stat.value}</p>
                                            <div className={cn(
                                                "mt-2 flex items-center gap-1 text-xs font-medium",
                                                stat.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                            )}>
                                                <TrendingUp className={cn("h-3 w-3", stat.trend === 'down' && 'rotate-180')} />
                                                {stat.delta}
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "rounded-xl p-3 transition-colors duration-300",
                                            "bg-gradient-to-br from-muted/50 to-muted/30",
                                            "group-hover:from-primary/10 group-hover:to-accent/10"
                                        )}>
                                            <stat.icon className={cn("h-6 w-6", stat.color)} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}



                {/* Mobile: Module Grid (Visible only on small screens) */}
                <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
                    {moduleConfig.map((item, idx) => {
                        const isActive = module === item.id
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setModule(item.id)}
                                className={cn(
                                    "group relative overflow-hidden rounded-2xl border p-6 text-left transition-all duration-300",
                                    "hover:scale-[1.02] hover:shadow-xl",
                                    isActive
                                        ? 'border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 shadow-lg ring-2 ring-primary/20'
                                        : 'border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30'
                                )}
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                {/* Animated gradient background */}
                                <div className={cn(
                                    "absolute inset-0 opacity-0 transition-opacity duration-300",
                                    isActive && "opacity-100",
                                    `bg-gradient-to-br ${item.color.replace('from-', 'from-').replace('to-', 'to-')}/5`
                                )} />

                                {/* Content */}
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className={cn(
                                            "rounded-xl p-3 transition-all duration-300",
                                            isActive
                                                ? `bg-gradient-to-br ${item.color.replace('from-', 'from-').replace('to-', 'to-')}/20`
                                                : "bg-muted/50 group-hover:bg-muted"
                                        )}>
                                            <item.icon className={cn(
                                                "h-6 w-6 transition-colors",
                                                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                            )} />
                                        </div>
                                        {isActive && (
                                            <Badge variant="secondary" className="rounded-full bg-primary/20 text-primary">
                                                Active
                                            </Badge>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className={cn(
                                            "font-semibold transition-colors",
                                            isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
                                        )}>
                                            {item.label}
                                        </h3>
                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                            {item.description}
                                        </p>
                                    </div>
                                    <ChevronRight className={cn(
                                        "h-5 w-5 transition-all",
                                        isActive
                                            ? "text-primary translate-x-1"
                                            : "text-muted-foreground group-hover:translate-x-1 group-hover:text-foreground"
                                    )} />
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Active Module Workspace */}
                <Card className="border-border/50 bg-card/95 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom duration-700">
                    <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "rounded-xl p-3",
                                    activeModule.gradient
                                )}>
                                    <activeModule.icon className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">{activeModule.label}</CardTitle>
                                    <CardDescription className="mt-1">{activeModule.description}</CardDescription>
                                </div>
                            </div>
                            <Badge
                                variant="outline"
                                className="w-fit rounded-full border-primary/30 bg-primary/10 px-4 py-1.5 text-primary"
                            >
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Live Workspace
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6">
                        <div className="animate-in fade-in duration-500">
                            {renderModule(module)}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
