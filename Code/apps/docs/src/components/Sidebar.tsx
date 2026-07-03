import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  Boxes,
  Rocket,
  Key,
  ClipboardCheck,
  Calendar,
  CalendarSearch,
  Users,
  Megaphone,
  MessageSquare,
  MessageCircle,
  Code2,
  Map,
  GraduationCap,
  Sparkles,
  Video,
  Network,
  Scale,
  ShieldCheck,
  Shield,
  FileText,
  Video as VideoIcon,
  Lock,
} from 'lucide-react'
import { markdownRoutesBySection } from '../markdown-manifest'

interface SidebarProps {
  onNavigate: () => void
  onAiSearchClick: () => void
  aiPanelOpen: boolean
}

interface NavSection {
  title: string
  items: { label: string; path: string; icon: React.ReactNode; external?: boolean }[]
}

const sections: NavSection[] = [
  {
    title: 'General',
    items: [
      { label: 'Overview', path: '/overview', icon: <BookOpen className="w-4 h-4" /> },
      { label: 'Architecture', path: '/architecture', icon: <Boxes className="w-4 h-4" /> },
      { label: 'Getting Started', path: '/getting-started', icon: <Rocket className="w-4 h-4" /> },
      { label: 'Authentication', path: '/authentication', icon: <Key className="w-4 h-4" /> },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { label: 'Calendars', path: '/api/calendars', icon: <Calendar className="w-4 h-4" /> },
      { label: 'Calendar Sources', path: '/api/calendar-sources', icon: <CalendarSearch className="w-4 h-4" /> },
      { label: 'Meetings', path: '/api/meetings', icon: <Users className="w-4 h-4" /> },
      { label: 'Announcements', path: '/api/announcements', icon: <Megaphone className="w-4 h-4" /> },
      { label: 'Discord', path: '/api/discord', icon: <MessageCircle className="w-4 h-4" /> },
      { label: 'Feedback', path: '/api/feedback', icon: <MessageSquare className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Guides',
    items: [
      { label: 'Examples', path: '/examples', icon: <Code2 className="w-4 h-4" /> },
      { label: 'Roadmap', path: '/roadmap', icon: <Map className="w-4 h-4" /> },
      { label: 'Workshops', path: '/workshops', icon: <GraduationCap className="w-4 h-4" /> },
      { label: 'Zoom Integration', path: '/zoom', icon: <Video className="w-4 h-4" /> },
      { label: 'Zoom Review', path: '/zoom-review', icon: <ClipboardCheck className="w-4 h-4" /> },
      { label: 'Coordination Frameworks', path: '/coordination-frameworks', icon: <Network className="w-4 h-4" /> },
    ],
  },
  {
    title: 'Legal',
    items: markdownRoutesBySection.Legal.map((route) => {
      let icon: React.ReactNode = <FileText className="w-4 h-4" />
      if (route.path === '/legal/privacy-policy') icon = <ShieldCheck className="w-4 h-4" />
      if (route.path === '/legal/terms-of-service') icon = <Scale className="w-4 h-4" />
      if (route.path === '/legal/security-policy') icon = <Shield className="w-4 h-4" />
      if (route.path === '/legal/trademark-policy') icon = <Scale className="w-4 h-4" />

      return {
        label: route.title,
        path: route.path,
        icon,
      }
    }),
  },
  {
    title: 'Proposals',
    items: markdownRoutesBySection.Proposals.map((route) => ({
      label: route.title,
      path: route.path,
      icon: route.path.includes('video-meeting') ? <VideoIcon className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
    })),
  },
]

export function Sidebar({ onNavigate, onAiSearchClick, aiPanelOpen }: SidebarProps) {
  return (
    <nav className="h-full overflow-y-auto py-6 px-4 space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-3">
            {section.title}
          </h3>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.path}>
                {item.external ? (
                  <a
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-gray-400 hover:text-gray-200 hover:bg-surface-800"
                  >
                    {item.icon}
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? 'bg-brand-600/20 text-brand-300 font-medium'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
                      }`
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* AI Search button */}
      <div className="px-3">
        <button
          onClick={() => { onAiSearchClick(); onNavigate(); }}
          className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors ${
            aiPanelOpen
              ? 'bg-brand-600/20 text-brand-300 font-medium'
              : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Search
        </button>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-surface-700 px-3">
        <p className="text-xs text-gray-500">
          Coordination Manager v1.0
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Built for the SingularityNET ecosystem
        </p>
      </div>
    </nav>
  )
}
