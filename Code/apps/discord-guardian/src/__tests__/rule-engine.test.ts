import { describe, it, expect } from 'vitest'
import {
  wildcardToRegex,
  compilePattern,
  deobfuscate,
  joinLetterSpacing,
  buildScanVariants,
  isSameServerDiscordLink,
  scanText,
  planActions,
  formatActionsTaken,
  EMOJI_TO_KIND,
  REACTION_EMOJIS,
  type CompiledRule,
} from '../rule-engine.js'

function makeRule(partial: Partial<CompiledRule> & Pick<CompiledRule, 'regex'>): CompiledRule {
  return {
    id: 'rule-1',
    groupId: 'group-1',
    groupName: 'Test Group',
    originalPattern: partial.originalPattern ?? '*test*',
    actionDeleteMessage: false,
    actionTimeoutMember: false,
    actionTimeoutDuration: 60,
    actionBanMember: false,
    ...partial,
  }
}

describe('wildcardToRegex', () => {
  it('translates * to .* and escapes regex metachars', () => {
    const re = wildcardToRegex('*hello.world*')
    expect(re.test('say hello.world today')).toBe(true)
    expect(re.test('hello world')).toBe(false) // dot escaped, not wildcard
  })

  it('is case-insensitive', () => {
    expect(wildcardToRegex('*FREE NITRO*').test('claim your free nitro now')).toBe(true)
  })

  it('escapes URL-encoded patterns literally', () => {
    expect(wildcardToRegex('*%2E%78%79%7A*').test('http://evil.com/%2E%78%79%7A/path')).toBe(true)
  })
})

describe('compilePattern', () => {
  it('returns null for invalid regex', () => {
    expect(compilePattern('(unclosed', 'regex')).toBeNull()
  })
  it('compiles a valid regex', () => {
    const re = compilePattern('^foo$', 'regex')
    expect(re?.test('foo')).toBe(true)
    expect(re?.test('foobar')).toBe(false)
  })
  it('compiles wildcards through wildcardToRegex', () => {
    const re = compilePattern('*bar*', 'wildcard')
    expect(re?.test('foobarbaz')).toBe(true)
  })
})

describe('deobfuscate', () => {
  it('strips markdown formatting characters', () => {
    expect(deobfuscate('h*el*l*o*')).toBe('hello')
    expect(deobfuscate('h_e_l_l_o')).toBe('hello')
    expect(deobfuscate('h~e~l~l~o')).toBe('hello')
    expect(deobfuscate('h`e`l`l`o')).toBe('hello')
    expect(deobfuscate('h|e|l|l|o')).toBe('hello')
  })

  it('removes zero-width spaces', () => {
    expect(deobfuscate('he\u200Bll\u200Co')).toBe('hello')
  })

  it('strips blockquote markers (via markdown char removal)', () => {
    // Note: '>' is included in OBFUSCATION_STRIP_RE, so it is removed before
    // the dedicated blockquote regex runs. Leading whitespace may remain.
    expect(deobfuscate('> hello').trim()).toBe('hello')
    expect(deobfuscate('>>> phishing link').trim()).toBe('phishing link')
  })

  it('strips backslashes and angle brackets', () => {
    expect(deobfuscate('discord\\app<.>com')).toBe('discordapp.com')
  })

  it('preserves Estonian / Unicode diacriticals', () => {
    expect(deobfuscate('üõöä')).toBe('üõöä')
  })

  it('returns empty input untouched', () => {
    expect(deobfuscate('')).toBe('')
  })
})

describe('joinLetterSpacing', () => {
  it('joins single-letter runs (>=3 tokens)', () => {
    expect(joinLetterSpacing('s.u.p.p.o.r.t')).toBe('support')
    expect(joinLetterSpacing('t e a m')).toBe('team')
  })
  it('leaves short legitimate phrases alone', () => {
    expect(joinLetterSpacing('I am')).toBe('I am') // only 2 tokens, not joined
  })
})

describe('buildScanVariants', () => {
  it('always includes the raw text first', () => {
    const v = buildScanVariants('hello world')
    expect(v[0]).toEqual({ text: 'hello world', isNormalised: false })
  })

  it('deduplicates variants', () => {
    const v = buildScanVariants('abc')
    const texts = v.map(x => x.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('produces a no-whitespace variant for fragmented URLs', () => {
    const v = buildScanVariants('discord app .com / invite')
    expect(v.some(x => x.text === 'discordapp.com/invite')).toBe(true)
  })
})

describe('isSameServerDiscordLink', () => {
  it('returns true for same-guild discord.com channel links', () => {
    expect(isSameServerDiscordLink('see https://discord.com/channels/12345/67890/111', '12345')).toBe(true)
  })
  it('returns false for other-guild links', () => {
    expect(isSameServerDiscordLink('https://discord.com/channels/99999/67890', '12345')).toBe(false)
  })
  it('returns false for non-discord links', () => {
    expect(isSameServerDiscordLink('https://example.com', '12345')).toBe(false)
  })
})

describe('scanText', () => {
  const phishingRule = makeRule({
    regex: wildcardToRegex('*discordapp.com/invite*'),
    originalPattern: '*discordapp.com/invite*',
    actionDeleteMessage: true,
  })

  it('returns null when no rule matches', () => {
    expect(scanText('totally clean text', [phishingRule], 'direct')).toBeNull()
  })

  it('returns null on empty text', () => {
    expect(scanText('', [phishingRule], 'direct')).toBeNull()
  })

  it('matches a clean direct hit', () => {
    const m = scanText('go to discordapp.com/invite/abc', [phishingRule], 'direct')
    expect(m).not.toBeNull()
    expect(m!.matchedText).not.toMatch(/deobfuscated/)
    expect(m!.sourceType).toBe('direct')
  })

  it('matches an obfuscated hit and marks it deobfuscated', () => {
    const m = scanText(
      '> ht\\tp> :////\\\\@dis\\cord> app> .com/> invite\\q5MamteXdG',
      [phishingRule],
      'direct',
    )
    expect(m).not.toBeNull()
    expect(m!.matchedText).toMatch(/\(deobfuscated\)$/)
  })

  it('skips same-server discord channel links', () => {
    const sameServerRule = makeRule({
      regex: wildcardToRegex('*discord.com/channels*'),
      originalPattern: '*discord.com/channels*',
    })
    const m = scanText('https://discord.com/channels/12345/67890', [sameServerRule], 'direct', '12345')
    expect(m).toBeNull()
  })

  it('returns first matching rule (stable order)', () => {
    const r1 = makeRule({ regex: wildcardToRegex('*foo*'), originalPattern: '*foo*' })
    const r2 = makeRule({ regex: wildcardToRegex('*bar*'), originalPattern: '*bar*' })
    const m = scanText('foo and bar', [r1, r2], 'direct')
    expect(m?.rule.originalPattern).toBe('*foo*')
  })
})

describe('planActions', () => {
  it('always includes flag', () => {
    const rule = makeRule({ regex: /x/ })
    expect(planActions(rule)).toEqual(['flag'])
  })

  it('adds delete when configured', () => {
    const rule = makeRule({ regex: /x/, actionDeleteMessage: true })
    expect(planActions(rule)).toEqual(['flag', 'delete'])
  })

  it('adds mute and ban when both configured', () => {
    const rule = makeRule({
      regex: /x/,
      actionDeleteMessage: true,
      actionTimeoutMember: true,
      actionBanMember: true,
    })
    expect(planActions(rule)).toEqual(['flag', 'delete', 'mute', 'ban'])
  })
})

describe('formatActionsTaken', () => {
  it('maps action kinds to legacy strings', () => {
    expect(formatActionsTaken(['flag'])).toBe('flagged')
    expect(formatActionsTaken(['flag', 'delete'])).toBe('flagged,deleted')
    expect(formatActionsTaken(['flag', 'delete', 'mute'])).toBe('flagged,deleted,timeout')
    expect(formatActionsTaken(['flag', 'delete', 'ban'])).toBe('flagged,deleted,banned')
  })
})

describe('reaction emoji mapping', () => {
  it('maps every emoji round-trip', () => {
    for (const [kind, emoji] of Object.entries(REACTION_EMOJIS)) {
      expect(EMOJI_TO_KIND[emoji]).toBe(kind)
    }
  })

  it('returns undefined for unknown emojis', () => {
    expect(EMOJI_TO_KIND['\u2764\uFE0F']).toBeUndefined() // red heart
  })
})
