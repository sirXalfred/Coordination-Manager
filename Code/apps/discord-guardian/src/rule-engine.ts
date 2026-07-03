/**
 * Pure-logic helpers extracted from index.ts so they can be unit-tested
 * without booting a Discord client. Any function in here must be free of
 * I/O (no DB, no Discord API, no env access).
 */

// ─── User-Reaction Emojis ─────────────────────────────────────────────
export const REACTION_EMOJIS = {
  false_flag: '\u2705',         // white_check_mark
  republish: '\uD83D\uDD01',    // repeat
  unmute: '\uD83D\uDD13',       // unlock
  escalate: '\uD83C\uDD98',     // sos
} as const

export type ReactionKind = keyof typeof REACTION_EMOJIS

export const EMOJI_TO_KIND: Record<string, ReactionKind> = {
  [REACTION_EMOJIS.false_flag]: 'false_flag',
  [REACTION_EMOJIS.republish]: 'republish',
  [REACTION_EMOJIS.unmute]: 'unmute',
  [REACTION_EMOJIS.escalate]: 'escalate',
}

export const REACTION_LABELS: Record<ReactionKind, string> = {
  false_flag: 'False flag (this was a mistake)',
  republish: 'Please re-publish my message',
  unmute: 'Please unmute me',
  escalate: 'Escalate -- urgent moderator review',
}

// ─── Rule Compilation ─────────────────────────────────────────────────

export interface CompiledRule {
  id: string
  groupId: string
  groupName: string
  regex: RegExp
  originalPattern: string
  actionDeleteMessage: boolean
  actionTimeoutMember: boolean
  actionTimeoutDuration: number
  actionBanMember: boolean
}

export interface MatchResult {
  rule: CompiledRule
  matchedText: string
  sourceType: 'direct' | 'reply' | 'forward' | 'embed'
  content: string
}

/**
 * Convert a wildcard pattern (using * for partial match) to a RegExp.
 * e.g. "*%2E%78%79%7A*" -> /.*%2E%78%79%7A.*\/i
 */
export function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(escaped, 'i')
}

export function compilePattern(pattern: string, type: 'regex' | 'wildcard'): RegExp | null {
  try {
    if (type === 'wildcard') return wildcardToRegex(pattern)
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

// ─── Obfuscation Normalisation ────────────────────────────────────────

const OBFUSCATION_STRIP_RE = /[\\<>*_~`|\u200B-\u200D\u2060\uFEFF]/g

export function deobfuscate(text: string): string {
  if (!text) return text
  return text
    .replace(OBFUSCATION_STRIP_RE, '')
    .replace(/(^|\n)\s*>+\s?/g, '$1')
    .replace(/[ \t]+/g, ' ')
}

const LETTER_SPACING_RE = /\b\w(?:[ .\-_]+\w){2,}\b/g

export function joinLetterSpacing(text: string): string {
  if (!text) return text
  return text.replace(LETTER_SPACING_RE, m => m.replace(/[ .\-_]+/g, ''))
}

export function buildScanVariants(text: string): Array<{ text: string; isNormalised: boolean }> {
  const variants: Array<{ text: string; isNormalised: boolean }> = [
    { text, isNormalised: false },
  ]
  const seen = new Set<string>([text])
  const push = (candidate: string) => {
    if (!candidate || seen.has(candidate)) return
    seen.add(candidate)
    variants.push({ text: candidate, isNormalised: true })
  }
  const stripped = deobfuscate(text)
  push(stripped)
  push(joinLetterSpacing(stripped))
  push(stripped.replace(/\s+/g, ''))
  return variants
}

// ─── Same-server link guard ───────────────────────────────────────────

const SAME_SERVER_DISCORD_LINK_RE = /discord\.com\/channels\/(\d+)\//i

export function isSameServerDiscordLink(matchedText: string, guildId: string): boolean {
  const m = matchedText.match(SAME_SERVER_DISCORD_LINK_RE)
  return !!m && m[1] === guildId
}

// ─── Core scanner ─────────────────────────────────────────────────────

export function scanText(
  text: string,
  rules: CompiledRule[],
  sourceType: MatchResult['sourceType'],
  guildId?: string
): MatchResult | null {
  if (!text) return null
  const variants = buildScanVariants(text)
  for (const rule of rules) {
    for (const variant of variants) {
      const match = variant.text.match(rule.regex)
      if (!match) continue
      if (guildId && isSameServerDiscordLink(match[0], guildId)) continue
      const matchedText = variant.isNormalised
        ? `${match[0]} (deobfuscated)`
        : match[0]
      return { rule, matchedText, sourceType, content: text }
    }
  }
  return null
}

// ─── Action plan ──────────────────────────────────────────────────────
// Given a matched rule, return the set of actions the bot will take.
// This is the deterministic plan; actual side-effects live in index.ts.

export type ActionKind = 'flag' | 'delete' | 'mute' | 'ban'

export function planActions(rule: CompiledRule): ActionKind[] {
  const actions: ActionKind[] = ['flag']
  if (rule.actionDeleteMessage) actions.push('delete')
  if (rule.actionTimeoutMember) actions.push('mute')
  if (rule.actionBanMember) actions.push('ban')
  return actions
}

/**
 * Translate the internal action plan into the comma-separated string
 * stored in guardian_flagged_messages.action_taken (legacy format).
 * Keeps backwards compatibility with the existing column shape:
 *   "flagged", "flagged,deleted", "flagged,deleted,timeout", "flagged,deleted,banned"
 */
export function formatActionsTaken(actions: ActionKind[]): string {
  return actions.map(a => {
    if (a === 'flag') return 'flagged'
    if (a === 'delete') return 'deleted'
    if (a === 'mute') return 'timeout'
    if (a === 'ban') return 'banned'
    return a
  }).join(',')
}
