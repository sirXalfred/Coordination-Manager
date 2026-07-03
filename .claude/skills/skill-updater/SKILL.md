---
name: skill-updater
description: Route new instructions and research to the right skill integration path
---

# skill-updater

## Purpose

Accepts new instructions, research material, or user-defined requirements and determines the best integration path: update an existing skill's body, add reference material, or create a new skill.

## When to Use

- User provides new instructions or guidelines to incorporate
- User shares research material relevant to an existing skill
- User asks to update, extend, or add content to a specific skill
- User describes a new workflow that may need its own skill
- After adding a new library, tool, or pattern to the project

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| New content | User-provided instructions, research, or examples | yes |
| Target skill name | User specifies, or "auto" to let the agent decide | no |
| Integration hint | "update", "reference", or "new skill" | no |

## Workflow

1. **Classify the incoming content**:
   - Grep for directive keywords (always, never, must, when..then); if >= 2: instructions
   - Grep for workflow indicators (step, workflow, inputs, outputs); if >= 3: pattern
   - If neither: reference material; if both: mixed (split by heading)

2. **Find the target skill** (with conflict detection):
   - If user specified: check `.claude/skills/{name}/SKILL.md` exists
   - If "auto": extract top nouns from content; grep each skill's SKILL.md for matches
   - Score matches: exact keyword in ## heading = 0.8; in body text = 0.4; in constraints = 0.6
   - If top two scores are within 0.10: flag overlap and ask user to choose
   - If no match above 0.50: classify as new skill candidate
   - Current skill inventory (15 skills):
     react-frontend, express-api, supabase-database, coordination-calendar,
     authentication-system, discord-integration, monorepo-conventions, testing-strategy,
     side-panel-design, environment-variables, deployment, dev-server-workflow,
     github-workflow, ai-feedback-loop, skill-updater

3. **Measure skill headroom**:
   - Count lines in target SKILL.md; compute headroom = 200 - line_count
   - Estimate new content size in lines
   - If content exceeds headroom, plan for reference material extraction

4. **Decide integration path**:
   - If content is a distinct workflow pattern: create new skill
   - If fits in headroom and is operational: inline update
   - If supplementary, code-heavy, or too large: add to `references/` subfolder
   - If body is full but content is operational: restructure (move existing reference content out, add new inline)

5. **Execute the integration**:
   - Inline: edit the appropriate section, verify < 200 lines
   - Reference: create `references/{topic}.md`, add cross-reference in SKILL.md body
   - New skill: create `skills/{name}/SKILL.md` with all required sections:
     Purpose, When to Use, Workflow, Outputs, Self-Validation (with Trigger Indicators, Completion Markers, Quality Signals)

6. **Validate the result**:
   - YAML frontmatter: grep `^---` yields exactly 2 matches
   - Required sections: Purpose, When to Use, Workflow, Outputs, Self-Validation
   - Line count < 200
   - ASCII-safe text (no smart quotes or encoded characters)
   - No absolute paths

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Updated skill | .md | `.claude/skills/{name}/SKILL.md` |
| Reference file | .md | `.claude/skills/{name}/references/` |
| New skill | .md | `.claude/skills/{new-name}/SKILL.md` |

## Constraints

- SKILL.md files MUST stay under 200 lines
- MUST preserve YAML frontmatter validity
- MUST keep all 5 required h2 sections intact
- ASCII-safe characters only (no smart quotes, em dashes, or bullets)
- No absolute paths in skill files
- Reference files go in skill's `references/` subfolder
- When two skills overlap for the same content, ask user to choose target

## Self-Validation

### Trigger Indicators
- [ ] User asked to add instructions, update a skill, or incorporate research
- [ ] New guidelines or patterns provided for an existing workflow

### Completion Markers
- [ ] Content integrated into correct skill or new skill created
- [ ] SKILL.md passes structural validation (frontmatter, sections, line count)
- [ ] No absolute paths or non-ASCII characters

### Quality Signals
- [ ] Content placed in the right section (workflow, constraints, references)
- [ ] Existing skill structure preserved
- [ ] Line count stayed under 200
- [ ] Conflict detection triggered when content matches multiple skills

### Lint Checks
- [ ] YAML frontmatter has exactly 2 `---` markers
- [ ] All 5 required sections present
- [ ] No non-ASCII characters in modified files
