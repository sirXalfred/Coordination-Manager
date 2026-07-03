# Coordination Manager - Figma Wireframe Plugin

A Figma plugin that generates wireframes for the Coordination Manager web app from JSON specifications.

## Setup

### 1. Install dependencies & build

```bash
cd Code/figma-plugin
pnpm install
pnpm build
```

This compiles `code.ts` into `code.js` which Figma loads.

### 2. Load the plugin in Figma

1. Open Figma Desktop (or browser)
2. Go to **Plugins** > **Development** > **Import plugin from manifest...**
3. Select `Code/figma-plugin/manifest.json`
4. The plugin appears under **Plugins** > **Development** > **Coordination Manager Wireframes**

### 3. Generate wireframes

**Option A: Using the API endpoint**

```bash
# Get the wireframe spec from the API
curl -X POST http://localhost:3001/api/figma/wireframe-spec \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"pages": ["HomePage", "CalendarPage", "LoginPage"]}'
```

Copy the JSON response.

**Option B: Quick spec for all pages**

```bash
curl -X POST http://localhost:3001/api/figma/wireframe-spec \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"pages": ["HomePage", "CalendarPage", "MeetingPage", "AnnouncementsPage", "FeedbackPage", "SettingsPage", "LoginPage", "AiChatPage", "EventsCalendarPage", "GuardianPage"]}'
```

**Then in Figma:**

1. Run the plugin (**Plugins** > **Development** > **Coordination Manager Wireframes**)
2. Paste the JSON spec into the text area
3. Click **Generate Wireframes**
4. Each page becomes a separate Figma page prefixed with `[WF]`

## Available Pages

| Page | Description |
|------|-------------|
| `HomePage` | Landing with hero section and feature cards |
| `CalendarPage` | Availability calendar with AI side panel |
| `MeetingPage` | Meeting details with participant list |
| `AnnouncementsPage` | Announcement composer with Discord channels |
| `FeedbackPage` | Community feedback with sentiment grid |
| `SettingsPage` | User settings (profile, wallet, preferences) |
| `LoginPage` | Login with Google OAuth, wallet, guest entry |
| `AiChatPage` | AI chat interface with message list |
| `EventsCalendarPage` | Full calendar with day/week/month toggle |
| `GuardianPage` | Discord Guardian moderation dashboard |

## Design System

The wireframes use the app's actual design tokens:

- **Dark theme** matching the Tailwind config
- **Inter** font family
- **Purple accent** (#6d28d9) primary color
- **Border radius** and spacing consistent with the web app
- **Auto-layout** for responsive structure

## Development

```bash
pnpm watch   # Rebuild on file changes
```

After rebuilding, go to Figma > **Plugins** > **Development** > right-click the plugin > **Run last plugin** to reload.
