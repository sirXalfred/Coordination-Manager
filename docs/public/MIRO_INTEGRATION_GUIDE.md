# Miro Board Integration Guide for AI Agents

> This guide is written for Claude (or any AI coding agent) that needs to integrate with Miro boards via the MCP Server in VS Code + GitHub Copilot. It covers setup, available tools, prompts, workflows, and best practices.

---

## Table of Contents

1. [What is Miro MCP?](#what-is-miro-mcp)
2. [Setup](#setup)
3. [Tools Reference](#tools-reference)
4. [Prompts Reference](#prompts-reference)
5. [Workflow: Code to Diagram](#workflow-code-to-diagram)
6. [Workflow: Board to Code](#workflow-board-to-code)
7. [Workflow: Explore Board Content](#workflow-explore-board-content)
8. [Workflow: Create Documents and Tables](#workflow-create-documents-and-tables)
9. [DSL Diagram Syntax](#dsl-diagram-syntax)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Reference Links](#reference-links)

---

## What is Miro MCP?

Miro's hosted MCP (Model Context Protocol) Server gives AI agents secure, OAuth 2.1-authenticated access to Miro boards. It enables two primary workflows:

1. **Code -> Diagram**: Analyze a codebase and generate visual diagrams (flowcharts, UML, ERDs, sequence diagrams) directly onto a Miro board.
2. **Board -> Code**: Read Miro board content (PRDs, wireframes, diagrams, prototypes) and generate code, documentation, or scaffolding from it.

The server is hosted at `https://mcp.miro.com/` and uses OAuth 2.1 with dynamic client registration. Standard Miro API rate limits apply.

---

## Setup

### Prerequisites

- A Miro account with access to a team board
- VS Code with GitHub Copilot Chat extension
- Enterprise plans: admin must enable Miro MCP Server for the org

### Install via GitHub MCP Registry (Recommended)

1. Go to https://github.com/mcp/miroapp/mcp-server
2. Click "Install MCP server"
3. VS Code opens and prompts OAuth -- authorize with your Miro account
4. Select the Miro **team** that contains the boards you want to use
5. Done -- tools and prompts are now available in Copilot Chat

### Install Manually

Create or edit `.vscode/mcp.json` in your workspace root:

```json
{
  "servers": {
    "miro-mcp": {
      "url": "https://mcp.miro.com/",
      "type": "http"
    }
  }
}
```

Then authenticate when VS Code prompts the OAuth flow.

### Verify

- Click the **tools icon** (wrench) in Copilot Chat -- you should see Miro tools listed (diagram_create, context_explore, doc_create, etc.)
- Type `/` in the chat input -- you should see Miro prompts like `/mcp.miro-mcp.code_explain_on_board`

**Important:** Miro MCP is **team-specific**. The board you reference in prompts must belong to the team you authorized during setup. If you get access errors, re-authenticate and select the correct team.

---

## Tools Reference

These are the MCP tools available after connecting. You invoke them indirectly through natural language prompts -- the AI agent selects the appropriate tool.

### Board Navigation

| Tool | What It Does |
|------|-------------|
| `board_list_items` | List items on a board with cursor-based pagination. Supports filters by item type and parent container. |
| `context_explore` | Discover high-level items on a board: frames, documents, prototypes, tables, diagrams. Returns URLs and titles. |
| `context_get` | Get detailed text content from a specific board item. Documents return HTML, prototype screens return UI markup, frames return AI-generated summaries. **Uses credits.** |

### Diagrams

| Tool | What It Does |
|------|-------------|
| `diagram_create` | Create a diagram on a Miro board from DSL text. Supports: flowchart, UML class, UML sequence, ERD. |
| `diagram_get_dsl` | Get the DSL format specification (rules, syntax, color guidelines, examples) for a given diagram type. **Always call this before diagram_create** to get correct syntax. |

### Documents

| Tool | What It Does |
|------|-------------|
| `doc_create` | Create a doc-format item with markdown support (headings, bold, italic, lists, links). |
| `doc_get` | Read the markdown content and version of an existing doc. |
| `doc_update` | Edit content in an existing doc using find-and-replace (single or all occurrences). |

### Images

| Tool | What It Does |
|------|-------------|
| `image_get_url` | Get the download URL for an image item on the board. |
| `image_get_data` | Get the actual base64-encoded binary image data for an image item. |

### Tables

| Tool | What It Does |
|------|-------------|
| `table_create` | Create a table with specified columns (text and select column types supported). |
| `table_list_rows` | Get rows from a table with column metadata. Supports filtering by column value and cursor-based pagination. |
| `table_sync_rows` | Add new rows or update existing rows using key-based upsert matching. |

---

## Prompts Reference

Miro provides two built-in prompts optimized for common workflows. Access them via `/mcp.miro-mcp.<prompt_name>` in Copilot Chat.

### `code_explain_on_board`

**Purpose:** Analyze code and create visual diagrams + documentation on a Miro board.

**What it does:**
- Reads the codebase (local workspace or a GitHub URL)
- Identifies architecture, components, data flows, relationships
- Creates diagrams (flowchart, UML, sequence, ERD) on the specified board

**How to invoke:**
```
/mcp.miro-mcp.code_explain_on_board
```
Then provide context about what to analyze and the board URL.

### `code_create_from_board`

**Purpose:** Read a Miro board and generate code + documentation from its content.

**What it does:**
- Phase 1: Analyzes the board, identifies content types, recommends document types
- Phase 2: Generates specific documentation and code based on recommendations

**How to invoke:**
```
/mcp.miro-mcp.code_create_from_board
```
Then provide the board URL and what you want generated.

---

## Workflow: Code to Diagram

This is the most common workflow. You analyze code and produce a visual diagram on a Miro board.

### Step-by-Step

1. **Get the DSL spec** (recommended): Call `diagram_get_dsl` for the diagram type you want (flowchart, uml_class, uml_sequence, erd) to understand the correct syntax.

2. **Analyze the code**: Read the relevant source files to understand the architecture, components, and relationships.

3. **Generate DSL**: Write the diagram in the correct DSL format.

4. **Create the diagram**: Call `diagram_create` with the DSL text and the target Miro board URL.

### Example Prompts

**High-level architecture (entire workspace):**
```
Analyze my current workspace and create a high-level architecture diagram
showing all services and their connections. Identify key components like
"API Server", "Frontend", "Database", "Discord Bot". Show interactions
with labeled arrows.

Add it to this Miro board: https://miro.com/app/board/uXjVK1234567/
```

**Component diagram (specific folder):**
```
Create a flowchart of all API endpoints in apps/api/src/routes/ showing
HTTP methods, middleware chain, and service calls.

Add it to this Miro board: https://miro.com/app/board/uXjVK1234567/
```

**Database ERD (from migrations):**
```
Analyze packages/database/migrations/ and create an ERD showing all tables,
their columns with types, primary keys, and foreign key relationships.

Add it to this Miro board: https://miro.com/app/board/uXjVK1234567/
```

**Sequence diagram (specific feature):**
```
Create a sequence diagram showing the authentication flow: from Google
OAuth callback through JWT token generation, including the API,
Supabase Auth, and frontend interactions.

Add it to this Miro board: https://miro.com/app/board/uXjVK1234567/
```

**Tip for agents:** To guarantee the correct tool is used, include explicit instructions like "use the diagram_create tool" in your prompt.

---

## Workflow: Board to Code

Read Miro board content and generate code from it.

### Step-by-Step

1. **Explore the board**: Use `context_explore` on the board URL to see what's there (frames, docs, prototypes, tables).

2. **Read specific content**: Use `context_get` on specific items to get their full text/markup.

3. **Generate code**: Based on the board content, generate the appropriate code files.

### Example Prompts

**Generate code from a PRD:**
```
Read the PRD document on this Miro board and generate Express.js route
handlers, service layer, and database migration files that implement
the described feature.

Board: https://miro.com/app/board/uXjVK1234567/
```

**Generate React components from wireframes:**
```
Analyze the wireframe prototypes on this Miro board and generate
React components with TailwindCSS styling that match the designs.

Board: https://miro.com/app/board/uXjVK1234567/
```

---

## Workflow: Explore Board Content

Read and understand what's on a board without modifying it.

### Exploration Pattern

```
1. context_explore(board_url)
   -> Returns: list of frames, documents, prototypes, tables, diagrams
   -> Each has: title, URL, type

2. context_get(item_url)
   -> Returns: full text content of a specific item
   -> Documents: HTML content
   -> Prototypes: UI markup
   -> Frames: AI-generated summary

3. board_list_items(board_url, type_filter, parent_filter)
   -> Returns: paginated list of items
   -> Use cursor for pagination

4. image_get_url(item_url) / image_get_data(item_url)
   -> Returns: image download URL or base64 data
```

---

## Workflow: Create Documents and Tables

### Creating a Document

Use `doc_create` to add markdown-formatted documents to a board:

```
Create a document on this Miro board with:
- Title: "API Reference"
- Content: a summary of all REST endpoints with their methods,
  paths, and descriptions

Board: https://miro.com/app/board/uXjVK1234567/
```

Supported markdown: headings (#, ##, ###), bold (**text**), italic (*text*), lists (- item), links ([text](url)).

### Editing a Document

Use `doc_get` to read, then `doc_update` with find-and-replace:

```
Read the "API Reference" document on this board, then update the
/api/calendars endpoint description to mention the new recurrence
parameter.
```

### Creating a Table

Use `table_create` with column definitions:

```
Create a table on this Miro board with columns:
- "Endpoint" (text)
- "Method" (text)
- "Auth Required" (select: Yes, No)
- "Status" (select: Implemented, Planned, Deprecated)
```

### Updating Table Rows

Use `table_sync_rows` for upsert operations (key-based matching):

```
Add these rows to the API endpoints table, matching on the
"Endpoint" column...
```

---

## DSL Diagram Syntax

The `diagram_create` tool accepts DSL text in specific formats. **Always call `diagram_get_dsl` first** to get the exact syntax for your diagram type.

### Supported Diagram Types

| Type | DSL Keyword | Use For |
|------|------------|---------|
| Flowchart | `flowchart` | Process flows, decision trees, user journeys, API endpoint maps |
| UML Class | `uml_class` | Class hierarchies, module structures, service architectures |
| UML Sequence | `uml_sequence` | Request/response flows, authentication flows, API call chains |
| ERD | `erd` | Database schemas, table relationships, data models |

### General Tips

- Keep diagrams focused -- one concern per diagram
- Use clear, descriptive labels on nodes and edges
- For complex systems, create multiple focused diagrams rather than one massive one
- Color coding is supported -- use it to distinguish layers (frontend, backend, database)

---

## Best Practices

### For AI Agents

1. **Always include the board URL** in every prompt that creates or reads board content. Format: `https://miro.com/app/board/uXjVK.../`

2. **Call `diagram_get_dsl` before `diagram_create`** to get the correct DSL syntax. This prevents malformed diagrams.

3. **Be specific about diagram type** -- explicitly state "flowchart", "UML class diagram", "sequence diagram", or "ERD".

4. **Scope your analysis** -- analyze specific folders or files rather than the entire workspace when possible. This produces more accurate and focused diagrams.

5. **Reduce parallelism** to avoid rate limits. Don't make many concurrent Miro tool calls. Batch operations where possible.

6. **Use `context_explore` before `context_get`** -- explore first to discover what's on the board, then read specific items.

7. **Team-specific auth** -- boards must belong to the team authorized during OAuth setup. If you get access errors, the user needs to re-authenticate with the correct team.

8. **Error handling** -- if a tool call fails with a rate limit error, wait and retry with fewer parallel operations.

### For Prompt Engineering

- **Architecture diagrams**: Ask for "key components", "interactions", "labeled arrows", "external dependencies"
- **ERDs**: Ask for "tables, columns with types, primary keys, foreign key relationships"  
- **Sequence diagrams**: Specify the actors and the flow you want visualized
- **Component diagrams**: Specify the folder scope and what relationships to show

### Keeping Diagrams Current

After code changes, re-run the analysis for the changed area:

```
The database schema changed. Re-analyze packages/database/migrations/
and create an updated ERD on this Miro board: [URL]
```

For tracked evolution, create new diagrams with date-stamped titles rather than overwriting.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tools not visible in Copilot Chat | Check `.vscode/mcp.json` configuration. Reinstall from GitHub MCP Registry. |
| "Access denied" or "Board not found" | Board must be in the team you authorized. Re-authenticate with the correct team. |
| Rate limit errors | Reduce parallel tool calls. Wait and retry. Ask the agent to batch operations. |
| Diagram looks wrong | Call `diagram_get_dsl` first to get correct syntax. Simplify the DSL. |
| OAuth flow fails | Check browser pop-up blockers. Try manual config in `.vscode/mcp.json`. |
| `context_get` returns empty | Item may be empty or unsupported type. Try `board_list_items` with type filter. |
| Enterprise org blocked | Admin must enable Miro MCP Server -- see [admin guide](https://help.miro.com/hc/en-us/articles/31625761037202). |

### Diagnostic Tool

Use MCP Inspector for detailed connection diagnostics: https://modelcontextprotocol.io/docs/tools/inspector

---

## Reference Links

- [Miro MCP Overview](https://developers.miro.com/docs/miro-mcp)
- [Connecting to Miro MCP](https://developers.miro.com/docs/connecting-to-miro-mcp)
- [Tools & Prompts Reference](https://developers.miro.com/docs/miro-mcp-prompts)
- [VS Code + Copilot Setup](https://developers.miro.com/docs/connecting-miro-mcp-to-ai-coding-tools#vscode-and-github-copilot)
- [VS Code + Copilot Tutorial](https://developers.miro.com/docs/guided-tutorial-generating-code-diagrams-with-miro-mcp-vs-code)
- [FAQ & Troubleshooting](https://developers.miro.com/docs/miro-mcp-server-faq-and-troubleshooting)
- [MCP Protocol Spec](https://modelcontextprotocol.io/docs/getting-started/intro)
