---
name: discord-integration
description: Develop Discord bot commands, guardian moderation, and platform-Discord linking
---

# discord-integration

## Purpose

Guides development of the two Discord bots: the main integration bot (slash commands, platform linking, announcements) and the guardian moderation bot (rule-based message filtering). Covers both bot architectures and their shared Supabase backend.

## When to Use

- Adding slash commands to the Discord bot
- Modifying guardian moderation rules or actions
- Working with platform-Discord account linking
- Implementing announcement posting to Discord channels
- Adding new guild/channel discovery features
- Modifying rule caching or pattern matching logic

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Bot to modify | discord-bot or discord-guardian | yes |
| Feature description | What to add or change | yes |

## Workflow

1. **Discord bot architecture** (`Code/apps/discord-bot/`):
   - Client intents: Guilds, GuildMessages, DirectMessages, MessageContent, GuildMembers
   - Env vars: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `API_URL`, `BOT_API_SECRET`
   - Communicates with main API via `BOT_API_SECRET` for authenticated requests

2. **Slash commands** (existing):
   - `/link <key>` -- validates link key, checks expiry, deactivates old integrations, triggers background guild sync
   - `/status` -- checks current link status
   - `/channels` -- lists channels where bot can post
   - `/feedback <message>` -- submits platform feedback
   - Register: use `REST.put(Routes.applicationCommands(clientId), { body: commands })`
   - Handler: `client.on(Events.InteractionCreate, async interaction => { ... })`
   - Use `deferReply({ flags: 64 })` for deferred ephemeral responses

3. **Add a new slash command**:
   - Define command in the commands array: `new SlashCommandBuilder().setName().setDescription()`
   - Add options: `.addStringOption()`, `.addBooleanOption()`, etc.
   - Add handler case in InteractionCreate listener
   - Reply with `interaction.reply()` or `interaction.deferReply()` for long operations
   - Test with a specific guild first before global registration

4. **Bot internal API** (Express on port 3002):
   - `POST /sync-channels` -- trigger guild channel sync (checks bot+user permissions separately)
   - `POST /list-dm-members` -- SSE stream: phase 1 (discovery) + phase 2 (paginated with cursor, 1000-item batches)
   - `POST /check-permissions` -- batch permission checks by channel ID
   - Guild sync: upsert channels with conflict resolution to preserve user selections

5. **DM fallback handler** (for non-slash messages):
   - Detects keywords: stop, opt-out, unsubscribe
   - Recognizes link key patterns and guides user through `/link` command
   - Provides help text for unrecognized messages
   - All wrapped in error handling

6. **Guardian bot architecture** (`Code/apps/discord-guardian/`):
   - Separate bot with its own token and client
   - Rule groups: `{ id, guild_id, name, is_enabled, action_delete_message, action_timeout_member, action_timeout_duration, action_ban_member }`
   - Rules: `{ id, group_id, pattern, pattern_type ('regex'|'wildcard'), is_enabled }`
   - Pattern compilation: wildcard `*` converts to `.*` (escape all other regex chars, case-insensitive)

7. **Guardian message scanning** (multi-source, short-circuit):
   - Source 1: Direct message content
   - Source 2: Referenced message (replies)
   - Source 3: Forwarded snapshots
   - Source 4: Embeds (title + description + author + footer + fields + URLs combined)
   - Source 5: Attachment URLs and filenames
   - Returns first match (stops scanning on hit)
   - On match: execute group actions in order (delete first, then timeout/ban)
   - Reason format: `Guardian auto-<action>: matched rule group "<name>"`

8. **Guardian caching and logging**:
   - Rules refreshed every 30 seconds from Supabase (stale check + interval minimum)
   - Ignored roles refreshed every 60 seconds (composite key: `guild_id:role_id`)
   - In-memory compiled RegExp cache (recompiled on refresh)
   - Two log tables: `guardian_message_log` (all scanned) and `guardian_flagged_messages` (violations only)
   - Edit versioning: separate row per edit with incremented version number

9. **Platform-Discord linking** (shared tables):
   - `discord_integrations`: `{ user_id, link_key, discord_user_id, bot_verified, is_active }`
   - `discord_keys`: generated from platform UI with 24-hour TTL, validated by bot
   - `discord_guild_channels`: discovered channels per guild (cascade on integration deactivation)
   - `discord_server_roles`: role data for guardian ignore lists

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Bot commands | .ts | `Code/apps/discord-bot/src/` |
| Guardian rules | .ts | `Code/apps/discord-guardian/src/` |
| Discord routes | .ts | `Code/apps/api/src/routes/discord.ts` |
| Integration tables | .sql | `Code/packages/database/migrations/` |

## Constraints

- NEVER expose bot tokens in frontend code or API responses
- NEVER commit or share bot tokens (treat as passwords -- Discord official guidance)
- Rotate bot tokens immediately on suspicion of exposure; discord.js docs describe the
  damage of a leaked token and emphasize immediate reset
- Each bot has its own separate token (never share tokens between bots)
- Grant minimal bot permissions -- only request what the bot actually uses
- Avoid privileged intents (MessageContent, GuildMembers, GuildPresences) unless
  necessary; Discord notes privileged intents may access potentially sensitive data.
  Audit intent usage periodically and remove intents no longer needed.
- Guardian rules use in-memory cache; changes take up to 30s to propagate
- Link keys are single-use and have 24-hour TTL
- Bot must handle rate limits from Discord API (429 responses)
- Guardian actions execute in order: delete first, then timeout/ban
- Test new commands in a specific guild before global registration
- Log bot security events (token usage, permission errors) without logging tokens

## Self-Validation

### Trigger Indicators
- [ ] User asked about Discord bot, slash commands, or moderation
- [ ] Task involves files in `Code/apps/discord-bot/` or `Code/apps/discord-guardian/`
- [ ] User mentioned announcements, linking, guardian rules, or DM handling

### Completion Markers
- [ ] Command registered and handler implemented
- [ ] Guardian rule patterns compile to valid RegExp
- [ ] Platform-Discord linking flow works end-to-end
- [ ] Bot token used from environment variable only

### Quality Signals
- [ ] No hardcoded tokens or secrets in bot code
- [ ] Guardian multi-source scanning covers embeds and attachments
- [ ] Slash command replies use ephemeral flags for private responses
- [ ] Guild sync uses upsert with conflict resolution

### Lint Checks
- [ ] TypeScript compiles without errors
- [ ] No non-ASCII characters in command descriptions
- [ ] Bot intents match required permissions for features
