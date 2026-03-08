'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  FilePlus, 
  FileText, 
  CheckCircle, 
  BarChart3,
  Users,
  ClipboardList
} from 'lucide-react'
import { cn } from '@/lib/utils'

const memberLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/submit-claim', label: 'Submit Claim', icon: FilePlus },
  { href: '/claims', label: 'My Claims', icon: FileText },
  { href: '/benefit-check', label: 'Check Benefits', icon: CheckCircle },
]

const assessorLinks = [
  { href: '/assessor-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/review', label: 'Review Claims', icon: ClipboardList },
]

const adminLinks = [
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/users', label: 'Users', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()

  const links = memberLinks

  return (
    <aside className="w-64 bg-laya-slate min-h-screen p-4">
      <div className="space-y-4">
        <div className="text-white font-bold text-xl px-4 py-2">Menu</div>
        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                  isActive 
                    ? 'bg-laya-teal text-white' 
                    : 'text-gray-300 hover:bg-laya-mid hover:text-white'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
