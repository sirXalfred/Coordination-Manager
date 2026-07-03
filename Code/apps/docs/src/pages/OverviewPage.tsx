import { Callout } from '../components/Callout'
import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, Bot, Megaphone, Shield, FileText, Scale, ShieldCheck } from 'lucide-react'

export function OverviewPage() {
  return (
    <div className="prose-docs">
      <h1>Coordination Manager</h1>
      <p className="text-lg text-gray-400 mb-8">
        An open-source platform for collaborative scheduling, meeting coordination, and
        community announcements — with an API that AI agents can use to interact with
        the Coordination Manager tool.
      </p>

      <Callout variant="tip" title="Agent API available">
        Coordination Manager provides an Agent API so that AI agents and automation workflows
        can read calendars, submit availability, draft meetings, read Google Calendar events,
        and prepare announcements — with human-in-the-loop before executive decision-making.
      </Callout>

      <h2>What is Coordination Manager?</h2>
      <p>
        Coordination Manager is a web-based platform designed to streamline event coordination for
        distributed teams and communities. Originally built for the SingularityNET Ambassador Program,
        it automates notifications, integrates with Google Calendar and Discord, and provides an
        accessible interface for event management.
      </p>

      <h2>Key Capabilities</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 not-prose">
        {features.map((f) => (
          <div
            key={f.title}
            className="border border-surface-700 rounded-lg p-4 bg-surface-800/50 hover:border-brand-600/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              {f.icon}
              <h3 className="text-sm font-semibold text-gray-100">{f.title}</h3>
            </div>
            <p className="text-sm text-gray-400">{f.description}</p>
          </div>
        ))}
      </div>

      <h2>Who is this for?</h2>
      <ul>
        <li>
          <strong>Agent developers</strong> — use the Agent API to read coordination data and
          draft meeting or announcement content from your own agent or workflow.
        </li>
        <li>
          <strong>Community managers</strong> — coordinate availability across time zones
          and push announcements to Discord channels.
        </li>
        <li>
          <strong>Platform integrators</strong> — read availability data via REST and build
          custom dashboards or embed calendars in your app.
        </li>
      </ul>

      <h2>Quick Links</h2>
      <div className="flex flex-col gap-2 not-prose">
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="flex items-center justify-between px-4 py-3 border border-surface-700 rounded-lg
                       hover:border-brand-600/50 hover:bg-surface-800/50 transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-gray-200 group-hover:text-white">{link.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{link.sublabel}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
          </Link>
        ))}
      </div>

      <h2>Legal & Governance</h2>
      <p>
        These documents define how the project is governed, how user data is handled,
        and the terms that protect both contributors and operators.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 not-prose">
        {legalLinks.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-start justify-between gap-3 px-4 py-3 border border-surface-700 rounded-lg
                       hover:border-brand-600/50 hover:bg-surface-800/50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <span className="text-brand-400 mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-200 group-hover:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.sublabel}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors mt-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}

const features = [
  {
    icon: <Calendar className="w-5 h-5 text-brand-400" />,
    title: 'Coordination Calendars',
    description: 'Create shared calendars where participants submit their availability. The tool surfaces the data so users can make the best scheduling decisions.',
  },
  {
    icon: <Bot className="w-5 h-5 text-purple-400" />,
    title: 'Agent API',
    description: 'REST API with Bearer token auth and scoped permissions. AI agents can read calendars, submit availability, draft meetings, read Google Calendar events, and prepare announcements.',
  },
  {
    icon: <Megaphone className="w-5 h-5 text-amber-400" />,
    title: 'Announcement System',
    description: 'Draft and schedule announcements with poll support. Distribute to Discord channels with rich embeds.',
  },
  {
    icon: <Shield className="w-5 h-5 text-red-400" />,
    title: 'Human-in-the-Loop',
    description: 'Agents help draft the information needed for coordination, but executive decisions stay with humans.',
  },
]

const quickLinks = [
  { path: '/getting-started', label: 'Getting Started', sublabel: 'Set up your API key and make your first request in 5 minutes' },
  { path: '/api/calendars', label: 'Calendars & Availability', sublabel: 'Create calendars, submit availability, read participants' },
  { path: '/api/calendar-sources', label: 'Calendar Sources', sublabel: 'Read events from integrated Google Calendars (read-only)' },
  { path: '/api/meetings', label: 'Meetings', sublabel: 'Create meeting drafts and list scheduled meetings' },
  { path: '/api/announcements', label: 'Announcements', sublabel: 'Draft announcement templates with optional poll support' },
  { path: '/api/discord', label: 'Discord', sublabel: 'List servers, channels, and DM-eligible members' },
  { path: '/api/feedback', label: 'Feedback', sublabel: 'Submit and list feedback' },
  { path: '/examples', label: 'Code Examples', sublabel: 'Python, cURL, and JavaScript examples for common workflows' },
]

const legalLinks = [
  {
    path: '/legal/privacy-policy',
    label: 'Privacy Policy',
    sublabel: 'What data is collected, why, and how it is protected.',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  {
    path: '/legal/terms-of-service',
    label: 'Terms of Service',
    sublabel: 'Usage terms, platform boundaries, and responsibilities.',
    icon: <Scale className="w-4 h-4" />,
  },
  {
    path: '/legal/security-policy',
    label: 'Security Policy',
    sublabel: 'Security reporting process and vulnerability handling.',
    icon: <Shield className="w-4 h-4" />,
  },
  {
    path: '/legal/code-of-conduct',
    label: 'Code of Conduct',
    sublabel: 'Community standards for contributors and participants.',
    icon: <FileText className="w-4 h-4" />,
  },
]
