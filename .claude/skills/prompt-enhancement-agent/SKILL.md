---
name: prompt-enhancement-agent
description: Reason about a new user prompt across iterations and scaffold it into intent, As-Is/To-Be, dependencies, tests, and ready-to-run next steps
---

# prompt-enhancement-agent

## Purpose

Intercepts a new user message, decomposes intent across 3+ reasoning iterations,
maps the request onto the real codebase, surfaces cross-page dependencies, and
returns a verbose, well-formatted scaffolding response. The user can then agree to
a proposed plan and hand the implementation off to the right skill. Non-feature
work is routed to a faster quick-command path that skips this analysis.

## When to Use

- A new session starts and the user writes a feature/change request
- The message has multiple sentences, a URL, or mixed intents
- The user references a page, component, or visual behaviour to change
- Skip this skill (use quick-command mode) for: questions, single-line fixes,
  deploys, env/config edits, or any task scoped to one known file

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| User message | The raw prompt text | yes |
| Page URL | A coordinationmanager.com or localhost link in the prompt | no |
| Prior context | Earlier turns in the session | no |

## Workflow

1. **Classify intent** (see `references/classifier.md`):
   - Score feature vs maintenance vs meta/question
   - If feature score >= 0.6: run full scaffolding (steps 2-8)
   - Else: offer quick-command mode and stop

2. **Iteration 1 - Surface parse**:
   - Split the message by sentence and newline; treat each as a unit
   - Tag each unit: URL/context, experience/goal, location, As-Is critique,
     To-Be spec, constraint, or question
   - Extract raw entities (pages, sections, components, data types)

3. **Iteration 2 - Contextual linking**:
   - Resolve the URL to a real page file (e.g. time-management -> the page component)
   - Map each named section/feature to actual files via grep/glob
   - Note existing patterns that already do something similar

4. **Iteration 3 - Dependency mapping** (run at least 3 passes total because
   sentences are often out of order; each pass adds context from the others):
   - Find every page/component that reuses an affected component
   - Surface hidden assumptions and edge cases
   - Propose 1-2 alternative implementations
   - Flag backward-compatibility and test gaps

5. **Build As-Is and To-Be snapshots** from real file contents, not guesses
   (current location, behaviour, schema, styling vs proposed changes + file list).

6. **Analyse tests**: grep existing test files for coverage of the touched
   components; list what exists and what is missing (unit, integration, e2e, a11y).

7. **Render the scaffolding response** using `references/output-template.md`.
   Use formatting to clearly separate: (a) what the user said, (b) what the agent
   inferred, and (c) decisions the user must make.

8. **Offer next steps** as explicit choices: Agree & Auto-Start, Customize,
   Quick Fix Mode, Different Approach. On agreement, route to the owning skill(s).

## Routing Targets

| Change type | Route to skill |
|-------------|----------------|
| UI / components / pages | react-frontend |
| API endpoints / middleware | express-api |
| Schema / migrations / RLS | supabase-database |
| Calendar / availability / meetings | coordination-calendar |
| FAB / side panels | side-panel-design |
| Auth flows | authentication-system |
| Discord bot / guardian | discord-integration |
| Any new or changed tests | testing-strategy |

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Scaffolding response | Markdown sections (verbose) | Chat reply |
| Clarification questions | 1-3 focused items | Chat reply |
| Implementation plan | Stepwise checklist with estimates | Chat reply |
| Handoff | Invocation of the routed skill(s) | Follow-up turn |

## Constraints

- Verbose by default; use headings, blockquotes, and labels to separate user
  words from agent inference from required decisions
- Always quote the user's own sentences back when reflecting intent
- Run at least 3 reasoning iterations before rendering As-Is/To-Be
- Never invent files or features; verify with grep/glob/view first
- Always list affected pages with clickable localhost URLs when a component is shared
- Ask 1-3 clarification questions max; do not block on them if Quick Fix is chosen
- ASCII-safe characters only; no smart quotes or em dashes
- Do not run this analysis for slash commands or single-file fixes

## Self-Validation

### Trigger Indicators
- [ ] New feature/change request with multiple sentences or a page URL
- [ ] Message references a section, component, or visual behaviour

### Completion Markers
- [ ] Intent reflected back using the user's own quoted sentences
- [ ] As-Is and To-Be built from verified file contents
- [ ] Cross-page dependencies listed with localhost URLs
- [ ] Test gaps identified and next-step choices offered

### Quality Signals
- [ ] At least 3 reasoning iterations performed
- [ ] User words, agent inference, and required decisions visually separated
- [ ] 1-3 clarification questions, each genuinely decision-changing
- [ ] Correct owning skill selected for handoff

### Lint Checks
- [ ] YAML frontmatter has exactly 2 `---` markers
- [ ] All required sections present
- [ ] No non-ASCII characters
- [ ] No absolute paths
