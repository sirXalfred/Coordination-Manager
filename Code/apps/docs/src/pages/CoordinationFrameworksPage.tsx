import { Link } from 'react-router-dom'

const FRAMEWORK_ROWS = [
  {
    style: 'Consensus (Anarchy)',
    decision: 'Decisions by consent; everyone participates; dissent and veto allowed',
    structure: 'Flat groups or federated networks with representatives',
    where: 'Small activist groups, cooperatives, communities',
  },
  {
    style: 'Sociocracy 3.0',
    decision: 'Consent-based decisions; pattern-based change; transparency and equivalence',
    structure: 'Circles/teams with defined domains; roles such as facilitator, logbook keeper, backlog owner',
    where: 'Agile teams, organizations seeking incremental change',
  },
  {
    style: 'Holacracy',
    decision: 'Distributed decision-making; governance process for role changes',
    structure: 'Nested circles; roles (Lead Link, Rep Link) coordinate across circles',
    where: 'Growing companies seeking clear roles and autonomy',
  },
  {
    style: 'Meritocracy / Do-ocracy',
    decision: 'Ideas judged by merit regardless of origin; self-allocation of tasks',
    structure: 'Informal; roles emerge based on what people do',
    where: 'Open-source projects, volunteer communities',
  },
  {
    style: 'Secret Societies',
    decision: 'Initiation rites; secrecy; progressive degrees',
    structure: 'Hierarchical; lodges or chapters; membership lists kept confidential',
    where: 'Fraternal orders, clubs requiring confidentiality',
  },
  {
    style: 'Centralized / Monarchical',
    decision: 'Decisions made by a single leader; petitions and proposals flow to the center',
    structure: 'Pyramid hierarchy; ministers or assistants handle specific domains',
    where: 'Military commands, traditional enterprises',
  },
]

const AI_FEATURES = [
  {
    style: 'Consensus-Oriented',
    features: [
      'Polls and asynchronous input before meetings',
      'Rotating facilitator suggestions',
      'Equity reminders for under-represented participants',
      'Space for objections and deliberation rounds',
    ],
  },
  {
    style: 'Sociocratic',
    features: [
      'Role-based invites (facilitator, secretary, logbook keeper)',
      'Meeting pattern templates (stand-up, coordination, governance)',
      'Shared logbook for decisions and actions',
      'Consent-based decision templates',
    ],
  },
  {
    style: 'Holacratic',
    features: [
      'Circle and role directory awareness',
      'Lead Link and Rep Link auto-invitation',
      'Governance agenda integration',
      'Role purpose and domain display in invites',
    ],
  },
  {
    style: 'Meritocratic / Do-ocratic',
    features: [
      'Contribution tracking and recognition',
      'Open event creation for any member',
      'Asynchronous coordination support',
      'Rotating roles based on contribution history',
    ],
  },
  {
    style: 'Confidential Groups',
    features: [
      'Hierarchical access control for meeting details',
      'Progressive disclosure of agenda items',
      'Recurring ceremony and ritual scheduling',
      'Pseudonymous participation support',
    ],
  },
  {
    style: 'Centralized',
    features: [
      'Central coordinator approval before invites',
      'Proposal and petition queue',
      'Broadcast scheduling from the coordinator',
      'Decision history and accountability log',
    ],
  },
]

const SOURCES = [
  { text: 'Consensus Decision Making -- The Anarchist Library', url: 'https://theanarchistlibrary.org/library/seeds-for-change-consensus-decision-making' },
  { text: 'What is Sociocracy 3.0?', url: 'https://sociocracy30.org/the-details/' },
  { text: 'Holacracy -- Reinventing Organizations Wiki', url: 'https://reinventingorganizationswiki.com/en/cases/holacracy/' },
  { text: 'The Operating System for Self-Management', url: 'https://www.holacracy.org/' },
  { text: 'Meritocracy 2.0 -- Opensource.com', url: 'https://opensource.com/open-organization/16/6/presenting-framework-meritocracy' },
  { text: 'Do-ocracy -- P2P Foundation', url: 'https://wiki.p2pfoundation.net/Do-ocracy' },
  { text: 'Secret society -- Britannica', url: 'https://www.britannica.com/topic/secret-society' },
  { text: 'Voltaire, "Internal Government" (1756)', url: 'https://revolution.chnm.org/d/253' },
]

export function CoordinationFrameworksPage() {
  return (
    <div className="prose-docs">
      <h1>Coordination Frameworks</h1>
      <p className="text-lg text-gray-400 mb-8">
        How different organizational styles influence scheduling, meeting formats,
        and the way Coordination Manager adapts to your team.
      </p>

      <h2>Why Coordination Styles Matter</h2>
      <p>
        Coordinating meetings is more than finding a time on a calendar -- it reflects
        how people prefer to work together. From the consensus-based practices of cooperatives
        to the structured rituals of hierarchical organizations, an AI-powered calendar can
        help identify a team's preferred coordination style and suggest meeting formats, role
        assignments, and communication practices that make coordination enjoyable rather than
        burdensome.
      </p>

      <h2>Frameworks at a Glance</h2>
      <div className="overflow-x-auto not-prose mb-8">
        <table className="w-full text-sm border border-surface-700">
          <thead>
            <tr className="bg-surface-800">
              <th className="text-left p-3 text-gray-300 font-semibold border-b border-surface-700">Style</th>
              <th className="text-left p-3 text-gray-300 font-semibold border-b border-surface-700">Decision-Making</th>
              <th className="text-left p-3 text-gray-300 font-semibold border-b border-surface-700">Structure</th>
              <th className="text-left p-3 text-gray-300 font-semibold border-b border-surface-700">Where It Works</th>
            </tr>
          </thead>
          <tbody>
            {FRAMEWORK_ROWS.map((row) => (
              <tr key={row.style} className="border-b border-surface-700/50 hover:bg-surface-800/30">
                <td className="p-3 text-gray-200 font-medium">{row.style}</td>
                <td className="p-3 text-gray-400">{row.decision}</td>
                <td className="p-3 text-gray-400">{row.structure}</td>
                <td className="p-3 text-gray-400">{row.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>How the Calendar AI Adapts</h2>
      <p>
        The Coordination Calendar AI acts as an intelligent assistant that adapts to
        the selected coordination style. Here is how it supports each approach:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 not-prose">
        {AI_FEATURES.map((group) => (
          <div
            key={group.style}
            className="border border-surface-700 rounded-lg p-4 bg-surface-800/50"
          >
            <h3 className="text-sm font-semibold text-gray-100 mb-3">{group.style}</h3>
            <ul className="space-y-1.5">
              {group.features.map((f) => (
                <li key={f} className="text-sm text-gray-400 flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">-</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2>Choosing a Style</h2>
      <ol>
        <li>
          <strong>Assess values and goals.</strong> Does the team prioritize autonomy, equality,
          rapid decision-making, inclusion, or confidentiality?
        </li>
        <li>
          <strong>Consider group size.</strong> Consensus works best in small groups; Holacracy
          and Sociocracy scale through nested structures; meritocratic models thrive where
          participants self-organize.
        </li>
        <li>
          <strong>Evaluate information sensitivity.</strong> If confidentiality is critical, adopt
          restricted invites and access levels. For transparent teams, use open record-keeping.
        </li>
        <li>
          <strong>Reflect on decision speed.</strong> Consensus builds buy-in but takes time.
          Holacracy balances speed and participation. Centralized models allow rapid decisions.
        </li>
        <li>
          <strong>Experiment and iterate.</strong> Practices can be combined. The AI can suggest
          experiments and gather feedback to refine the coordination style over time.
        </li>
      </ol>

      <h2>Onboarding with Coordination Styles</h2>
      <ol>
        <li>Identify the coordination style through a questionnaire or prompts</li>
        <li>Configure roles and permissions according to the selected framework</li>
        <li>Create recurring meeting patterns aligned with the framework</li>
        <li>Prepare invites with context (agenda, roles, decision process)</li>
        <li>Facilitate meetings with structure prompts and record decisions</li>
        <li>Periodically review whether the style still fits</li>
      </ol>

      <h2>Sources</h2>
      <ol className="not-prose space-y-1">
        {SOURCES.map((s, i) => (
          <li key={i} className="text-sm text-gray-400">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:text-brand-300 underline"
            >
              {s.text}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}
