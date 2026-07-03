# Miro Board Integration -- User Guide

## Overview

The Miro Board integration connects our Coordination Manager codebase with Miro's visual collaboration platform. This enables a two-way workflow between code and visual diagrams: developers can generate architecture visuals from code, and use Miro boards to propose and communicate architectural changes back.

---

## Getting Started

### Prerequisites

- A Miro account (free or paid)
- VS Code with GitHub Copilot Chat extension installed and authenticated
- Access to a Miro board in your authorized team

### Installation (One-Time Setup)

**Recommended: GitHub MCP Registry**
1. Visit the Miro MCP Server on GitHub's MCP Registry: `https://github.com/mcp/miroapp/mcp-server`
2. Click **"Install MCP server"**
3. VS Code will prompt you to authorize with Miro -- follow the OAuth flow
4. Select the Miro team where your project boards live
5. You will see a "Connected to Miro" confirmation

**Alternative: Manual Configuration**
1. Create a file at `.vscode/mcp.json` in the workspace root with:
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
2. Open Copilot Chat and authenticate when prompted

### Verifying the Connection

In Copilot Chat:
1. Click the **tools icon** -- you should see Miro tools listed (diagram_create, context_explore, etc.)
2. Type `/` in the chat box -- you should see Miro prompts like `/mcp.miro-mcp.code_explain_on_board`

---

## Features

### 1. Generate Architecture Diagrams from Code

Turn your codebase structure into visual diagrams on a Miro board.

**How to use:**
1. Open Copilot Chat in VS Code
2. Type `/mcp.miro-mcp.code_explain_on_board` or write a custom prompt
3. Describe what part of the codebase to visualize
4. Include your Miro board URL
5. The diagram appears on your board within seconds

**What you can generate:**
- **High-level architecture** -- shows all services (Web, API, Discord Bot, Database) and how they connect
- **Component diagrams** -- internals of a specific app (e.g., all API routes and their middleware)
- **Sequence diagrams** -- step-by-step flow of a feature (e.g., user login, event creation)
- **Database ERDs** -- all tables, columns, and relationships from migration files
- **Flowcharts** -- decision trees, user journeys, process flows

**Example prompts:**

*Full project overview:*
> "Analyze my current workspace and create a high-level architecture diagram showing all services and their connections. Add it to this Miro board: [your-board-URL]"

*Specific folder:*
> "Create a flowchart of all API endpoints in apps/api/src/routes/ showing HTTP methods and middleware. Add it to this Miro board: [your-board-URL]"

*Single file:*
> "Create a sequence diagram for the ImportAvailabilityModal component showing user interactions and API calls. Add it to this Miro board: [your-board-URL]"

### 2. Generate Code from Miro Board Content

Use visual designs, PRDs, or architecture proposals on Miro boards to generate code.

**How to use:**
1. Open Copilot Chat
2. Type `/mcp.miro-mcp.code_create_from_board` or write a custom prompt
3. Include the Miro board URL containing your requirements or designs
4. The AI reads the board content and generates implementation guidance or code

**Use cases:**
- Convert a feature requirements document on Miro into route/service scaffolding
- Turn a UI wireframe description into React component structure
- Read an architecture proposal and generate migration files

**Example prompts:**

> "Read the feature specification on this Miro board: [board-URL] and generate the API route, service, and database migration following our existing patterns."

> "Analyze the architecture diagram on this Miro board: [board-URL] and create an implementation plan with specific file changes needed."

### 3. Explore and Read Board Content

Browse what's on a Miro board without leaving VS Code.

**Available actions:**
- **Discover items** -- see all frames, documents, diagrams, and tables on a board
- **Read documents** -- get the markdown content of any doc item
- **List board items** -- filter by type (sticky notes, shapes, connectors, etc.)
- **Get images** -- download or view images from the board

**Example:**
> "Use context_explore to show me what's on this Miro board: [board-URL]"

### 4. Create and Update Documents on Miro

Create structured documentation directly on your Miro board.

**Supported formats:**
- Markdown documents with headings, bold, italic, lists, and links
- Tables with text and select columns
- Images (referenced by URL)

**Example:**
> "Create a document on this Miro board: [board-URL] summarizing the current API endpoints, their request/response formats, and authentication requirements."

### 5. Keep Diagrams in Sync

After making code changes, update your Miro diagrams to stay current.

**Workflow:**
1. Make code changes (new routes, refactored services, schema updates)
2. Ask Copilot to re-analyze the changed areas
3. Generate updated diagrams on the same board

> "The database schema has been updated with new migrations. Re-analyze packages/database/migrations/ and create an updated ERD on this Miro board: [board-URL]"

---

## Collaboration Workflows

### Proposing Architecture Changes

1. **Developer A** creates an architecture diagram on Miro showing proposed changes
2. **Developer B** opens Copilot Chat and reads the proposal from the board
3. Copilot generates an implementation plan or scaffolding code
4. After code review and implementation, update the diagram to reflect final state

### Onboarding New Team Members

1. Generate a full architecture overview diagram from the current codebase
2. Create sequence diagrams for key user flows (login, event creation, notifications)
3. Share the Miro board link -- new members get a visual map of the system

### Sprint Planning

1. Create feature requirement docs on Miro with wireframes and specifications
2. Use `code_create_from_board` to generate initial implementation plans
3. Reference the Miro board in PRs for visual context

### Code Reviews

1. Before a PR, generate a sequence diagram of the changed flow
2. Add the diagram to the project Miro board
3. Link the diagram in the PR description for reviewer context

---

## Tips and Best Practices

- **Always include the board URL** in your prompt -- the AI needs it to know where to create content
- **Be specific about diagram type** -- say "UML sequence diagram" or "flowchart" rather than just "diagram"
- **Target specific folders** for detailed views, use the full workspace for high-level overviews
- **Use Miro's built-in prompts** (`/mcp.miro-mcp.code_explain_on_board`) for best results -- they're optimized for diagram generation
- **Name your diagrams** with dates or version numbers so you can track how the architecture evolves
- **The board must be in your authorized team** -- you can only access boards in the Miro team you connected during setup

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Board not found" error | Verify the board URL is correct and belongs to your authorized Miro team |
| No Miro tools visible in Copilot | Re-authenticate: remove and re-add the MCP server, complete OAuth again |
| Rate limit errors | Reduce parallel operations, wait a few minutes, try again |
| Diagram renders incorrectly | Use `diagram_get_dsl` first to get the correct syntax, then retry |
| OAuth flow doesn't complete | Check browser popup blockers, try a different browser for the auth step |

---

## Reference Links

- Miro MCP Overview: https://developers.miro.com/docs/miro-mcp
- Tools and Prompts Reference: https://developers.miro.com/docs/miro-mcp-prompts
- VSCode Setup Guide: https://developers.miro.com/docs/connecting-miro-mcp-to-ai-coding-tools#vscode-and-github-copilot
- Tutorial (Code to Diagrams): https://developers.miro.com/docs/guided-tutorial-generating-code-diagrams-with-miro-mcp-vs-code
- FAQ and Troubleshooting: https://developers.miro.com/docs/miro-mcp-server-faq-and-troubleshooting
