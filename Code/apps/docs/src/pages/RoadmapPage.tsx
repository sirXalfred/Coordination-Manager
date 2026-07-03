export function RoadmapPage() {
  return (
    <div className="prose-docs">
      <h1>Technical Roadmap</h1>
      <p className="text-lg text-gray-400 mb-8">
        Coordination Manager is built at a casual pace, shaped by real needs rather than rigid
        deadlines. Here's what has shipped and where the community could take it next.
      </p>

      <h2>Current State — What's Shipped</h2>
      <p>The foundation is stable and deployed. These capabilities are live today:</p>
      <ul>
        <li>Coordination calendars with availability submission</li>
        <li>Meeting scheduling with overlap detection</li>
        <li>Announcement system with Discord integration and poll support</li>
        <li>Feedback collection and admin review</li>
        <li>Agent API with Bearer token auth and scope-based access</li>
        <li>Reference Fetch.ai uAgent (meeting-scheduler)</li>
        <li>Cardano wallet integration for decentralized identity</li>
        <li>AI chat assistant for scheduling help</li>
        <li>Developer documentation site with AI-powered search</li>
      </ul>

      <h2>Potential Future Directions</h2>
      <p>
        The following ideas represent possible directions for the platform. There is no fixed
        timeline — these are opportunities for the community to pick up, contribute to, and shape.
        If any of these excite you, consider getting involved.
      </p>

      <div className="space-y-6 not-prose">
        {directions.map((d) => (
          <div key={d.title} className="border border-surface-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-surface-800">
              <span className="text-base font-semibold text-gray-100">{d.title}</span>
            </div>
            <div className="px-4 py-3 bg-surface-850">
              <ul className="space-y-1.5">
                {d.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-gray-600 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <h2>How We Prioritize</h2>
      <p>
        Development priorities are driven by community feedback (submitted through the Feedback API
        and the web UI), partner integration needs, and the SingularityNET Ambassador Program's
        coordination requirements. The platform is built at a casual pace — there are no strict
        milestones or fixed delivery schedules:
      </p>
      <ol>
        <li><strong>Feedback collection</strong> — community members and agents submit feature requests and bug reports.</li>
        <li><strong>Impact assessment</strong> — the team evaluates feasibility, user impact, and alignment with the project vision.</li>
        <li><strong>Incremental delivery</strong> — features ship as soon as they're ready; no big-bang releases.</li>
        <li><strong>Retrospective</strong> — we review what worked and adjust the process as we go.</li>
      </ol>

      <h2>Contributing</h2>
      <p>
        Coordination Manager is open-source. You can contribute by:
      </p>
      <ul>
        <li>Submitting <strong>feedback</strong> via the API or web UI</li>
        <li>Opening <strong>issues</strong> or <strong>pull requests</strong> on GitHub</li>
        <li>Building <strong>agents and integrations</strong> using the Agent API</li>
      </ul>
    </div>
  )
}

const directions = [
  {
    title: 'Public Calendar for All Public Meetings',
    items: [
      'Aggregate all public meetings across the ecosystem into one shared calendar',
      'Filter by workgroup, topic, or date range',
      'Embeddable widget for external sites and dashboards',
    ],
  },
  {
    title: 'Miro Board Integration',
    items: [
      'Auto-generate technical flowcharts from coordination data',
      'Export roadmaps and timelines directly to Miro',
      'Visualize coordination structures and team relationships',
    ],
  },
  {
    title: 'ASI Tools & Extended Cardano Wallet Capabilities',
    items: [
      'Integrate with ASI tooling for broader agent interoperability',
      'Expand Cardano wallet features beyond authentication (e.g. on-chain governance, token-gated access)',
    ],
  },
  {
    title: 'Open Sourcing Coordination Manager',
    items: [
      'Publish the full codebase with contribution guidelines',
      'Provide self-hosting documentation and Docker setup',
      'Enable community governance for feature prioritization',
    ],
  },
  {
    title: 'Marketing Agent for Coordination Manager',
    items: [
      'AI-powered agent that generates content for platform updates and announcements',
      'Tooling for community engagement and outreach campaigns',
      'Track adoption metrics and usage trends',
    ],
  },
]
