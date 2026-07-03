import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Smile, Clock, Star, Heart, Leaf, Coffee, Gamepad2, Hash, Loader2, RefreshCw, Server } from 'lucide-react'
import { apiClient } from '../../lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────

interface EmojiCategory {
  label: string
  icon: React.ReactNode
  emojis: string[]
}

interface DiscordGuildEmoji {
  id: string
  name: string
  animated: boolean
  guild_id: string
  guild_name: string
  url: string
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
  className?: string
}

// ─── Standard Unicode Emoji Categories ────────────────────────────────

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    label: 'Frequently Used',
    icon: <Clock className="w-4 h-4" />,
    emojis: ['👍', '❤️', '😂', '🎉', '🔥', '✅', '👀', '🚀'],
  },
  {
    label: 'Smileys',
    icon: <Smile className="w-4 h-4" />,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶',
      '😏', '😒', '🙄', '😬', '😮', '🤯', '😴', '🥱',
      '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶',
      '😵', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕',
      '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
      '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
      '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
      '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
      '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖',
    ],
  },
  {
    label: 'Gestures',
    icon: <Star className="w-4 h-4" />,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳',
      '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
      '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
    ],
  },
  {
    label: 'Hearts & Symbols',
    icon: <Heart className="w-4 h-4" />,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗',
      '💖', '💘', '💝', '✨', '⭐', '🌟', '💫', '⚡',
      '🔥', '💥', '❄️', '🌊', '💧', '💦', '🌈', '☀️',
      '🌤️', '🌙', '⭕', '✅', '❌', '❓', '❗', '💯',
      '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪',
      '🟤', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '◾',
    ],
  },
  {
    label: 'Nature',
    icon: <Leaf className="w-4 h-4" />,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
      '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤',
      '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
      '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰',
      '🌸', '💐', '🌷', '🌹', '🥀', '🌺', '🌻', '🌼',
      '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🪴', '🌵',
      '🌲', '🌳', '🪵', '🌾', '🌱', '🫘', '🍄', '🐚',
    ],
  },
  {
    label: 'Food & Drink',
    icon: <Coffee className="w-4 h-4" />,
    emojis: [
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅',
      '🥑', '🍆', '🫑', '🥦', '🥬', '🥒', '🌶️', '🫒',
      '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🧀',
      '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗',
      '🍖', '🌭', '🍔', '🍟', '🍕', '🫔', '🌮', '🌯',
      '🫕', '🥘', '🍜', '🍝', '🍣', '🍱', '🥟', '🍩',
      '🍪', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '☕',
    ],
  },
  {
    label: 'Activities',
    icon: <Gamepad2 className="w-4 h-4" />,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🎱', '🏓', '🏸', '🏒', '🥊', '🥋', '🎯', '⛳',
      '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎮', '🕹️',
      '🎲', '🧩', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼',
      '🎹', '🥁', '🎷', '🎺', '🎸', '🪗', '🎻', '🪘',
      '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
      '🎪', '🎠', '🎡', '🎢', '🎰', '🚀', '🛸', '🎆',
      '🎇', '🧨', '✨', '🎈', '🎉', '🎊', '🎁', '🎀',
    ],
  },
  {
    label: 'Objects',
    icon: <Hash className="w-4 h-4" />,
    emojis: [
      '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '💾', '💿',
      '📷', '📹', '🎥', '📞', '☎️', '📺', '📻', '🎙️',
      '⏰', '⌚', '🔔', '🔕', '📢', '📣', '💡', '🔦',
      '🕯️', '🪔', '📚', '📖', '📝', '✏️', '🖊️', '🖋️',
      '📎', '📌', '📍', '✂️', '🗑️', '🔒', '🔓', '🔑',
      '🗝️', '🔨', '🪛', '🔧', '🪜', '🧲', '🪝', '🧰',
      '💰', '💵', '💴', '💶', '💷', '💎', '⚖️', '🧪',
      '🔬', '🔭', '📡', '💉', '🩺', '💊', '🩹', '🏥',
    ],
  },
]

// ─── Recently Used Emojis (localStorage) ──────────────────────────────

const RECENT_KEY = 'cm-emoji-recent'
const MAX_RECENT = 32

function getRecentEmojis(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) return JSON.parse(saved) as string[]
  } catch { /* ignore */ }
  return []
}

function addRecentEmoji(emoji: string): void {
  try {
    const recent = getRecentEmojis().filter(e => e !== emoji)
    recent.unshift(emoji)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────

export default function EmojiPicker({ onSelect, onClose, className }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(0)
  const [recentEmojis, setRecentEmojis] = useState<string[]>(getRecentEmojis)
  const [guildEmojis, setGuildEmojis] = useState<DiscordGuildEmoji[]>([])
  const [loadingGuildEmojis, setLoadingGuildEmojis] = useState(false)
  const [guildEmojisLoaded, setGuildEmojisLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Load guild emojis from Discord
  const loadGuildEmojis = useCallback(async () => {
    if (guildEmojisLoaded || loadingGuildEmojis) return
    setLoadingGuildEmojis(true)
    try {
      const resp = await apiClient.get('/api/discord/guild-emojis')
      const data = resp.data as { emojis: DiscordGuildEmoji[] }
      setGuildEmojis(data.emojis || [])
      setGuildEmojisLoaded(true)
    } catch {
      // Not linked to Discord or error -- silently ignore
      setGuildEmojisLoaded(true)
    } finally {
      setLoadingGuildEmojis(false)
    }
  }, [guildEmojisLoaded, loadingGuildEmojis])

  // Load guild emojis on mount
  useEffect(() => {
    loadGuildEmojis()
  }, [loadGuildEmojis])

  const handleSelect = useCallback((emoji: string) => {
    addRecentEmoji(emoji)
    setRecentEmojis(getRecentEmojis())
    onSelect(emoji)
  }, [onSelect])

  // Group guild emojis by guild
  const guildEmojiGroups = guildEmojis.reduce<Record<string, { guild_name: string; emojis: DiscordGuildEmoji[] }>>((acc, em) => {
    if (!acc[em.guild_id]) {
      acc[em.guild_id] = { guild_name: em.guild_name, emojis: [] }
    }
    acc[em.guild_id].emojis.push(em)
    return acc
  }, {})

  // Filter emojis by search
  const lowerQuery = searchQuery.toLowerCase().trim()
  const _filteredCategories = lowerQuery
    ? EMOJI_CATEGORIES.map(cat => ({
        ...cat,
        emojis: cat.emojis, // Unicode emojis don't have searchable names, keep all
      }))
    : EMOJI_CATEGORIES

  const filteredGuildEmojis = lowerQuery
    ? guildEmojis.filter(em =>
        em.name.toLowerCase().includes(lowerQuery) ||
        em.guild_name.toLowerCase().includes(lowerQuery)
      )
    : guildEmojis

  // Build guild group keys for navigation
  const guildGroupKeys = Object.keys(guildEmojiGroups)

  return (
    <div
      ref={containerRef}
      className={`bg-popover border border-border rounded-xl shadow-xl w-[340px] flex flex-col overflow-hidden ${className || ''}`}
      style={{ maxHeight: '400px' }}
    >
      {/* Search bar */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search emojis..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-input rounded-lg bg-background text-foreground focus:ring-1 focus:ring-ring outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      {!lowerQuery && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border overflow-x-auto scrollbar-thin">
          {recentEmojis.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveCategory(-1)}
              className={`p-1.5 rounded transition-colors flex-shrink-0 ${activeCategory === -1 ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title="Recently Used"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          )}
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(i)}
              className={`p-1.5 rounded transition-colors flex-shrink-0 ${activeCategory === i ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
          {guildGroupKeys.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveCategory(EMOJI_CATEGORIES.length)}
              className={`p-1.5 rounded transition-colors flex-shrink-0 ${activeCategory >= EMOJI_CATEGORIES.length ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title="Server Emojis"
            >
              <Server className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin" style={{ minHeight: '200px' }}>
        {/* Search results */}
        {lowerQuery ? (
          <>
            {/* Guild emoji search results */}
            {filteredGuildEmojis.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">Server Emojis</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {filteredGuildEmojis.map(em => (
                    <button
                      key={`${em.guild_id}-${em.id}`}
                      type="button"
                      onClick={() => handleSelect(em.animated ? `<a:${em.name}:${em.id}>` : `<:${em.name}:${em.id}>`)}
                      className="w-9 h-9 flex items-center justify-center rounded hover:bg-muted transition-colors"
                      title={`:${em.name}: (${em.guild_name})`}
                    >
                      <img
                        src={em.url}
                        alt={em.name}
                        className="w-6 h-6 object-contain"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Standard emoji -- show all since we can't search Unicode names easily */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">Standard</p>
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_CATEGORIES.flatMap(c => c.emojis).filter((v, i, a) => a.indexOf(v) === i).slice(0, 64).map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleSelect(em)}
                    className="w-9 h-9 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
                    title={em}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Recently used */}
            {activeCategory === -1 && recentEmojis.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">Recently Used</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {recentEmojis.map((em, i) => {
                    // Check if it's a custom Discord emoji
                    const customMatch = em.match(/^<(a?):(\w+):(\d+)>$/)
                    if (customMatch) {
                      const [, animated, name, id] = customMatch
                      const ext = animated ? 'gif' : 'png'
                      return (
                        <button
                          key={`recent-${i}`}
                          type="button"
                          onClick={() => handleSelect(em)}
                          className="w-9 h-9 flex items-center justify-center rounded hover:bg-muted transition-colors"
                          title={`:${name}:`}
                        >
                          <img
                            src={`https://cdn.discordapp.com/emojis/${id}.${ext}?size=48`}
                            alt={name}
                            className="w-6 h-6 object-contain"
                            loading="lazy"
                          />
                        </button>
                      )
                    }
                    return (
                      <button
                        key={`recent-${i}`}
                        type="button"
                        onClick={() => handleSelect(em)}
                        className="w-9 h-9 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
                        title={em}
                      >
                        {em}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Standard emoji categories */}
            {activeCategory >= 0 && activeCategory < EMOJI_CATEGORIES.length && (
              <div ref={el => { categoryRefs.current[activeCategory] = el }}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">
                  {EMOJI_CATEGORIES[activeCategory].label}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJI_CATEGORIES[activeCategory].emojis.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => handleSelect(em)}
                      className="w-9 h-9 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
                      title={em}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Guild emoji categories */}
            {activeCategory >= EMOJI_CATEGORIES.length && (
              <>
                {loadingGuildEmojis ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : guildGroupKeys.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    <p>No server emojis available.</p>
                    <p className="mt-1">Connect Discord and join servers with custom emojis.</p>
                  </div>
                ) : (
                  guildGroupKeys.map(guildId => {
                    const group = guildEmojiGroups[guildId]
                    return (
                      <div key={guildId}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">
                          {group.guild_name}
                        </p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {group.emojis.map(em => (
                            <button
                              key={`${em.guild_id}-${em.id}`}
                              type="button"
                              onClick={() => handleSelect(em.animated ? `<a:${em.name}:${em.id}>` : `<:${em.name}:${em.id}>`)}
                              className="w-9 h-9 flex items-center justify-center rounded hover:bg-muted transition-colors"
                              title={`:${em.name}:`}
                            >
                              <img
                                src={em.url}
                                alt={em.name}
                                className="w-6 h-6 object-contain"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
                {guildEmojisLoaded && guildGroupKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setGuildEmojisLoaded(false); loadGuildEmojis() }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh server emojis
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
