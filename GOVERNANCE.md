# Project Governance

*Coordination Manager*
*Version 1.0 -- 2026-06-07*

This document describes how decisions are made in the Coordination Manager open-source project. It is intentionally lightweight, reflecting the project's current stage. It will evolve as the community grows.

---

## 1. Mission

Coordination Manager is an open infrastructure for sovereign, transparent group coordination -- starting with shared availability scheduling, governance workflows, and Discord integration. Our priorities, in order:

1. **Trustworthy infrastructure** for facilitators and coordinators.
2. **Auditable, open source** so anyone can verify and learn from how it works.
3. **Sustainable maintenance** by Voltaire Swarm OÜ and contributors.

We are not optimising for maximum adoption at any cost. We aim for the right adopters: people who want to design and run their own coordination workflows.

---

## 2. Roles

### 2.1 Users

Anyone who uses Coordination Manager -- hosted at <https://coordinationmanager.com> or self-hosted. Users participate by filing issues, joining discussions, and giving feedback.

### 2.2 Contributors

Anyone who has had a pull request merged, an issue triaged, documentation improved, or made any other accepted contribution. Contributors must follow the [Code of Conduct](CODE_OF_CONDUCT.md) and sign the [CLA](CLA.md) for code contributions.

### 2.3 Maintainers

Maintainers have commit access and review responsibility for the codebase or a defined area (frontend, API, Discord, docs, etc.). They:

- Review pull requests in their area.
- Help shape the roadmap.
- Are accountable for the quality of merged code in their area.

Becoming a maintainer is by invitation, based on sustained, high-quality contribution and demonstrated alignment with the project's mission. There is no fixed application process; the existing maintainer team proposes new maintainers when the time is right.

### 2.4 Steward

Voltaire Swarm OÜ is the project Steward. The Steward:

- Holds the trademarks ("Coordination Manager", "Voltaire Swarm").
- Operates the hosted instance at <https://coordinationmanager.com>.
- Holds the Contributor License Agreement and may make relicensing decisions consistent with the CLA.
- Has final say on disputes that cannot be resolved by maintainers.

The Steward role is currently held by the project's founder. In time, governance can transfer to a foundation or other neutral body if the community grows to a scale that warrants it.

---

## 3. Decision-Making

### 3.1 Default: lazy consensus

Day-to-day changes are merged when a maintainer in the relevant area approves them and no other maintainer objects within a reasonable time (typically 72 hours for non-urgent changes, immediately for security fixes).

### 3.2 Substantive changes

Substantive changes -- new major features, breaking API changes, dependency additions with security implications, governance changes -- are proposed in a GitHub Discussion or RFC-style issue. They need:

- A clear written proposal (problem, options, recommended approach, trade-offs).
- A public comment period of at least 7 days.
- Explicit "approve" from at least one maintainer in each affected area.
- No unresolved objections from any maintainer.

### 3.3 Disagreements

If maintainers cannot reach consensus, the Steward decides. Steward decisions are documented in the relevant issue or PR with a brief rationale.

---

## 4. Roadmap

The roadmap lives publicly on GitHub (Projects board and milestone tags). It reflects the Steward's near-term priorities but is open to contributor proposals at any time.

Items move on the roadmap when:

- A contributor commits to implementing them, or
- A maintainer prioritises them based on user demand, security, or strategic fit.

---

## 5. Communications

- **Day-to-day:** GitHub Issues, Pull Requests, Discussions.
- **Security:** see [SECURITY.md](SECURITY.md).
- **Conduct concerns:** conduct@coordinationmanager.com.
- **General contact / trademark / legal:** tevo@coordinationmanager.com / legal@coordinationmanager.com.

All technical decisions are made on GitHub in the open. Private channels are used only for security disclosures, conduct issues, and legal matters.

---

## 6. Funding and Sustainability

Coordination Manager is currently funded by Voltaire Swarm OÜ and support provided by SingularityNET Ambassador Program. There is no payment requirement for users or contributors.

Our sustainability approach follows a Commercial Open Source Software (COSS) model: the core remains open source, while optional commercial services may be offered for organisations that need operational guarantees.

### 6.1 Why this model benefits customers

- Transparency and scalability: customers can inspect the code, validate behavior, and scale on their own infrastructure when needed.
- No vendor lock-in: support and customization can be sourced separately from multiple providers.
- License continuity supports business continuity: continued use is not blocked by a single vendor relationship.
- Hiring flexibility: organisations can hire developers who already understand open technologies and project internals.

The Steward may, in the future, offer:

- A paid hosted tier or token-based usage limits beyond the free quota;
- Paid enterprise terms (for example: support SLAs, compliance assurances, or custom contractual commitments) for organisations that need them;
- Paid support or custom-development services.

Any such offerings will not restrict the MIT-licensed core. The decision to introduce them is documented publicly.

---

## 7. Changes to This Document

Changes to this governance document are themselves substantive changes (Section 3.2) and follow that process.
