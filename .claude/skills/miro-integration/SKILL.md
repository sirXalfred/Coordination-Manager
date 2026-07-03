---
name: miro-integration
description: Generate architecture diagrams from code and create code from Miro board designs using MCP
---

# miro-integration

## Purpose

Guides use of Miro's hosted MCP Server integration in VS Code + GitHub Copilot to generate visual architecture diagrams from the codebase and create code from Miro board content. Enables two-way workflow between code and visual collaboration boards.

## When to Use

- Generating architecture diagrams, ERDs, sequence diagrams, or flowcharts from code
- Creating code scaffolding from Miro board designs or PRDs
- Reading or exploring Miro board content from VS Code
- Creating documentation, tables, or docs on Miro boards
- Keeping diagrams in sync after code changes

## Prerequisites

- Miro account with access to an authorized team board
- VS Code with GitHub Copilot Chat extension (agent mode)
- Miro MCP Server connected via `.vscode/mcp.json` or GitHub MCP Registry
- Enterprise plans: admin must enable Miro MCP Server for the org first

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Miro board URL | User provides in prompt | yes |
| Diagram type | User specifies (flowchart, UML class, UML sequence, ERD) | yes |
| Code scope | User specifies folder/file path or "full workspace" | no |

## Workflow

### 1. Verify MCP Connection

Check `.vscode/mcp.json` contains the `miro-mcp` server entry. Click the tools icon in Copilot Chat -- Miro tools (`diagram_create`, `context_explore`, etc.) should appear.

### 2. Generate Diagrams from Code

Call `diagram_get_dsl` first to get correct DSL syntax for the diagram type, then use `diagram_create`.

**Supported diagram types:** Flowchart, UML class, UML sequence, ERD.

**Project-specific examples:**

- Monorepo architecture: "Analyze the workspace and create a high-level architecture diagram showing Web, API, Discord Bot, Database and their connections. Add to board: [URL]"
- API routes: "Create a flowchart of all API endpoints in apps/api/src/routes/ showing HTTP methods and middleware. Add to board: [URL]"
- Database ERD: "Analyze supabase/migrations/ and create an ERD showing all tables, columns, and relationships. Add to board: [URL]"
- Event lifecycle: "Create a sequence diagram for event creation showing Discord Bot, API, Database interactions. Add to board: [URL]"

### 3. Generate Code from Board Content

Use `/mcp.miro-mcp.code_create_from_board` or custom prompts with a board URL. The agent reads board content (PRDs, wireframes, architecture proposals) and generates code scaffolding.

### 4. Explore Board Content

1. `context_explore` -- discover frames, documents, prototypes, tables, diagrams
2. `context_get` -- read specific item content (HTML docs, UI markup, AI summaries)
3. `board_list_items` -- paginated listing with type/parent filters
4. `image_get_url` / `image_get_data` -- retrieve images

### 5. Create Documents and Tables

- **Documents:** `doc_create` for markdown docs; `doc_get` and `doc_update` for editing
- **Tables:** `table_create` for new tables; `table_list_rows` to read; `table_sync_rows` for upserts

### 6. Keep Diagrams in Sync

After code changes, re-analyze affected areas and generate updated diagrams on the same board.

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `diagram_create` | Create diagram from DSL (flowchart, UML class, UML sequence, ERD) |
| `diagram_get_dsl` | Get DSL format spec and syntax for a diagram type |
| `context_explore` | Discover high-level items (frames, docs, tables, diagrams) |
| `context_get` | Get text content from a specific item |
| `board_list_items` | List items with pagination, filter by type or parent |
| `doc_create` / `doc_get` / `doc_update` | Create, read, edit markdown documents |
| `table_create` / `table_list_rows` / `table_sync_rows` | Create, read, upsert table data |
| `image_get_url` / `image_get_data` | Retrieve image URLs or base64 data |

**Built-in prompts:** `/mcp.miro-mcp.code_explain_on_board`, `/mcp.miro-mcp.code_create_from_board`

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Miro diagram | Visual on board | Target Miro board URL |
| Miro document | Markdown on board | Target Miro board URL |
| Generated code | Source files | Local workspace |

## Constraints

- Must include board URL in every Miro MCP tool call
- Board must belong to the authorized Miro team (team-specific OAuth)
- Standard Miro API rate limits apply -- reduce parallel operations if rate-limited
- `context_get` uses credits; other tools are free
- Must coexist with other skills -- no exclusive resource claims
- Does not modify local code unless explicitly asked (code-from-board workflow)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Board not found | Verify URL and that board belongs to authorized team |
| No Miro tools visible | Check `.vscode/mcp.json`; re-authenticate OAuth |
| Rate limit errors | Reduce parallel calls, wait, retry |
| Diagram renders wrong | Call `diagram_get_dsl` first for correct syntax |
| OAuth incomplete | Check popup blockers, try different browser |

## References

- User guide: `docs/public/MIRO_BOARD_GUIDE.md`
- MCP config: `.vscode/mcp.json`
- Miro MCP docs: https://developers.miro.com/docs/miro-mcp
- Tools reference: https://developers.miro.com/docs/miro-mcp-prompts

## Self-Validation

### Trigger Indicators
- [ ] User asked to create a diagram, visualize architecture, or work with a Miro board
- [ ] User provided a Miro board URL in the prompt
- [ ] Agent identified relevant code scope (folder, file, or workspace)

### Completion Markers
- [ ] Diagram or document was created on the target Miro board
- [ ] Or: board content was read and code/plan was generated from it
- [ ] Agent confirmed the output is accessible on the board

### Quality Signals
- [ ] `diagram_get_dsl` was called before `diagram_create` (correct syntax ensured)
- [ ] Diagram type matches what was requested (not generic)
- [ ] Code scope was targeted (not overly broad unless full overview requested)
- [ ] Rate limits were respected (no unnecessary parallel tool calls)
