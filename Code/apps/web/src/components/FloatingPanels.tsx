import { useState } from 'react'
import { MessageSquare, Sparkles, MessageCircle, ChevronDown, LayoutGrid, LifeBuoy } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────────

type PanelId = 'feedback' | 'ai' | 'chat' | 'support' | null

interface FloatingPanelsProps {
  /** Currently open panel – lifted so Layout can control the AI panel too */
  activePanel: PanelId
  onPanelChange: (panel: PanelId) => void
}

// ── Color Scheme ────────────────────────────────────────────────────────────────
// Each panel gets a distinct color so buttons & headers are instantly recognisable.

const PANEL_COLORS = {
  feedback: {
    bg: 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700',
    faded: 'bg-amber-500/25 hover:bg-amber-500/40 dark:bg-amber-700/25 dark:hover:bg-amber-700/40 text-white/60',
    active: 'bg-amber-500 dark:bg-amber-600 ring-2 ring-amber-300 shadow-amber-400/30 shadow-lg scale-105',
  },
  ai: {
    bg: 'ai-floating-button hover:shadow-purple-500/40 hover:shadow-lg',
    faded: 'bg-purple-500/25 hover:bg-purple-500/40 dark:bg-purple-700/25 dark:hover:bg-purple-700/40 text-white/60',
    active: 'ai-floating-button ring-2 ring-purple-300 shadow-purple-400/30 shadow-lg scale-105',
  },
  chat: {
    bg: 'bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700',
    faded: 'bg-sky-500/25 hover:bg-sky-500/40 dark:bg-sky-700/25 dark:hover:bg-sky-700/40 text-white/60',
    active: 'bg-sky-500 dark:bg-sky-600 ring-2 ring-sky-300 shadow-sky-400/30 shadow-lg scale-105',
  },
  support: {
    bg: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700',
    faded: 'bg-blue-500/25 hover:bg-blue-500/40 dark:bg-blue-700/25 dark:hover:bg-blue-700/40 text-white/60',
    active: 'bg-blue-500 dark:bg-blue-600 ring-2 ring-blue-300 shadow-blue-400/30 shadow-lg scale-105',
  },
} as const

// Panel width matches the side panels (22rem / sm:24rem)
const PANEL_WIDTH_CLASS = 'right-[22.5rem] sm:right-[24.5rem]'

// ── Component ───────────────────────────────────────────────────────────────────

export default function FloatingPanels({ activePanel, onPanelChange }: FloatingPanelsProps) {
  const [fabOpen, setFabOpen] = useState(false)

  const toggle = (panel: PanelId) => {
    if (activePanel === panel) {
      onPanelChange(null)
    } else {
      onPanelChange(panel)
    }
  }

  const isAnyPanelOpen = activePanel !== null

  // Determine button style based on whether this panel is the active one
  const btnStyle = (panel: 'feedback' | 'ai' | 'chat' | 'support') => {
    if (!isAnyPanelOpen) return PANEL_COLORS[panel].bg            // all full colour when no panel open
    if (activePanel === panel) return PANEL_COLORS[panel].active   // active = ring highlight
    return PANEL_COLORS[panel].faded                              // inactive = faded/transparent
  }

  return (
    <>
      {/* ── Floating Action Buttons ──────────────────────────────────────── */}
      {/* Container: when a panel is open the buttons slide left to sit beside it */}
      <div
        className={`fixed bottom-6 z-[55] flex flex-col-reverse items-end gap-2 transition-all duration-300 ease-in-out ${
          isAnyPanelOpen ? PANEL_WIDTH_CLASS : 'right-6'
        }`}
      >
        {/* ── Expanded option buttons (visible when fabOpen OR a panel is open) ── */}
        <div
          className={`flex flex-col-reverse items-end gap-2 transition-all duration-200 ${
            fabOpen || isAnyPanelOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {/* Feedback */}
          <button
            onClick={() => toggle('feedback')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-lg transition-all duration-200 ${btnStyle('feedback')}`}
            title="Send Feedback"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Feedback</span>
          </button>

          {/* AI Assistant */}
          <button
            onClick={() => toggle('ai')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-lg transition-all duration-200 ${btnStyle('ai')}`}
            title="AI Assistant"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Assistant</span>
          </button>

          {/* Chat */}
          <button
            onClick={() => toggle('chat')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-lg transition-all duration-200 ${btnStyle('chat')}`}
            title="Chat"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Chat</span>
          </button>

          {/* Support */}
          <button
            onClick={() => toggle('support')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-lg transition-all duration-200 ${btnStyle('support')}`}
            title="Support"
          >
            <LifeBuoy className="h-4 w-4" />
            <span>Support</span>
          </button>
        </div>

        {/* ── Main FAB / Hide toggle ─────────────────────────────────────── */}
        {/* When collapsed: gradient circle with chat icon.                   */}
        {/* When expanded (fabOpen): pill button saying "Hide".               */}
        {/* When a panel is open: the options stay visible; this button       */}
        {/* collapses back to the circle and also closes the panel.           */}
        {!isAnyPanelOpen && (
          <button
            onClick={() => setFabOpen(prev => !prev)}
            className={`shadow-xl flex items-center justify-center text-white transition-all duration-300 ${
              fabOpen
                ? 'px-4 py-2.5 rounded-full bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-sm font-medium gap-2'
                : 'w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-sky-500 to-amber-500'
            }`}
            title={fabOpen ? 'Hide options' : 'Open panel'}
          >
            {fabOpen ? (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>Hide</span>
              </>
            ) : (
              <LayoutGrid className="h-6 w-6" />
            )}
          </button>
        )}

        {/* When a panel IS open, show a "Hide" pill at the bottom (shorter = pyramid feel) */}
        {isAnyPanelOpen && (
          <button
            onClick={() => { onPanelChange(null); setFabOpen(false) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-white text-xs font-medium bg-gray-500/70 hover:bg-gray-600 dark:bg-gray-600/70 dark:hover:bg-gray-700 transition-all duration-200"
            title="Close panel"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Hide</span>
          </button>
        )}
      </div>
    </>
  )
}

export type { PanelId }
