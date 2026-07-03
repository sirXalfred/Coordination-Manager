/**
 * Wireframe specification generator — produces JSON structures that the
 * Figma plugin consumes to create frames, rectangles, text, and auto-layout
 * containers.
 *
 * Each page in the Coordination Manager web app has a corresponding spec
 * function that describes its wireframe layout.
 */

// ─── Types ────────────────────────────────────────────────────────────

export interface WireframeNode {
  type: 'FRAME' | 'RECTANGLE' | 'TEXT' | 'ELLIPSE'
  name: string
  x?: number
  y?: number
  width: number
  height: number
  /** Fill color as hex */
  fill?: string
  /** Stroke color as hex */
  stroke?: string
  strokeWeight?: number
  /** Corner radius */
  cornerRadius?: number
  /** Text content (only for TEXT nodes) */
  text?: string
  fontSize?: number
  fontWeight?: 'Regular' | 'Medium' | 'Bold'
  /** Auto-layout direction */
  layoutMode?: 'HORIZONTAL' | 'VERTICAL'
  /** Auto-layout spacing */
  itemSpacing?: number
  /** Auto-layout padding */
  padding?: number | { top: number; right: number; bottom: number; left: number }
  /** Auto-layout alignment */
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX'
  children?: WireframeNode[]
}

export interface WireframePage {
  name: string
  description: string
  /** Label shown on the arrow leading TO the next page */
  transitionLabel?: string
  frame: WireframeNode
}

export interface WireframeSpec {
  projectName: string
  generatedAt: string
  designSystem: {
    colors: Record<string, string>
    typography: { fontFamily: string; sizes: Record<string, number> }
    spacing: Record<string, number>
    borderRadius: Record<string, number>
  }
  pages: WireframePage[]
}

// ─── Design System (mirrors Tailwind config) ──────────────────────────

const DESIGN_SYSTEM: WireframeSpec['designSystem'] = {
  colors: {
    background: '#0a0a0f',
    foreground: '#e4e4e7',
    card: '#18181b',
    cardForeground: '#e4e4e7',
    primary: '#6d28d9',
    primaryForeground: '#ffffff',
    secondary: '#27272a',
    secondaryForeground: '#a1a1aa',
    muted: '#27272a',
    mutedForeground: '#71717a',
    accent: '#6d28d9',
    destructive: '#dc2626',
    border: '#27272a',
    placeholder: '#52525b',
  },
  typography: {
    fontFamily: 'Inter',
    sizes: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  borderRadius: { sm: 4, md: 8, lg: 12, full: 9999 },
}

// ─── Shared component helpers ─────────────────────────────────────────

function navbar(): WireframeNode {
  return {
    type: 'FRAME',
    name: 'Navbar',
    width: 1440,
    height: 64,
    fill: DESIGN_SYSTEM.colors.card,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    padding: { top: 12, right: 32, bottom: 12, left: 32 },
    children: [
      { type: 'TEXT', name: 'Logo', width: 200, height: 40, text: 'Coordination Manager', fontSize: 20, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.primary },
      { type: 'FRAME', name: 'NavLinks', width: 800, height: 40, layoutMode: 'HORIZONTAL', itemSpacing: 24, children: [
        { type: 'TEXT', name: 'NavLink-Home', width: 60, height: 40, text: 'Home', fontSize: 14, fill: DESIGN_SYSTEM.colors.foreground },
        { type: 'TEXT', name: 'NavLink-Events', width: 60, height: 40, text: 'Events', fontSize: 14, fill: DESIGN_SYSTEM.colors.foreground },
        { type: 'TEXT', name: 'NavLink-Calendar', width: 80, height: 40, text: 'Calendar', fontSize: 14, fill: DESIGN_SYSTEM.colors.foreground },
        { type: 'TEXT', name: 'NavLink-Feedback', width: 80, height: 40, text: 'Feedback', fontSize: 14, fill: DESIGN_SYSTEM.colors.foreground },
        { type: 'TEXT', name: 'NavLink-Announce', width: 110, height: 40, text: 'Announcements', fontSize: 14, fill: DESIGN_SYSTEM.colors.foreground },
      ]},
      { type: 'RECTANGLE', name: 'AvatarButton', width: 40, height: 40, cornerRadius: 9999, fill: DESIGN_SYSTEM.colors.secondary },
    ],
  }
}

function sidePanel(title: string, panelWidth = 380): WireframeNode {
  return {
    type: 'FRAME',
    name: `SidePanel-${title}`,
    width: panelWidth,
    height: 800,
    fill: DESIGN_SYSTEM.colors.card,
    stroke: DESIGN_SYSTEM.colors.border,
    strokeWeight: 1,
    layoutMode: 'VERTICAL',
    itemSpacing: 16,
    padding: 24,
    children: [
      { type: 'TEXT', name: 'PanelTitle', width: panelWidth - 48, height: 32, text: title, fontSize: 18, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
      { type: 'RECTANGLE', name: 'PanelDivider', width: panelWidth - 48, height: 1, fill: DESIGN_SYSTEM.colors.border },
      { type: 'RECTANGLE', name: 'PanelContent', width: panelWidth - 48, height: 600, fill: DESIGN_SYSTEM.colors.muted, cornerRadius: 8 },
    ],
  }
}

function button(label: string, variant: 'primary' | 'secondary' = 'primary'): WireframeNode {
  return {
    type: 'FRAME',
    name: `Button-${label}`,
    width: Math.max(120, label.length * 10 + 32),
    height: 40,
    fill: variant === 'primary' ? DESIGN_SYSTEM.colors.primary : DESIGN_SYSTEM.colors.secondary,
    cornerRadius: 8,
    padding: { top: 8, right: 16, bottom: 8, left: 16 },
    children: [
      { type: 'TEXT', name: 'ButtonLabel', width: label.length * 10, height: 24, text: label, fontSize: 14, fontWeight: 'Medium', fill: variant === 'primary' ? DESIGN_SYSTEM.colors.primaryForeground : DESIGN_SYSTEM.colors.foreground },
    ],
  }
}

function card(title: string, width = 400, height = 250): WireframeNode {
  return {
    type: 'FRAME',
    name: `Card-${title}`,
    width,
    height,
    fill: DESIGN_SYSTEM.colors.card,
    stroke: DESIGN_SYSTEM.colors.border,
    strokeWeight: 1,
    cornerRadius: 12,
    layoutMode: 'VERTICAL',
    itemSpacing: 12,
    padding: 20,
    children: [
      { type: 'TEXT', name: 'CardTitle', width: width - 40, height: 28, text: title, fontSize: 18, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
      { type: 'RECTANGLE', name: 'CardContent', width: width - 40, height: height - 80, fill: DESIGN_SYSTEM.colors.muted, cornerRadius: 8 },
    ],
  }
}

function inputField(label: string, width = 340): WireframeNode {
  return {
    type: 'FRAME',
    name: `Input-${label}`,
    width,
    height: 68,
    layoutMode: 'VERTICAL',
    itemSpacing: 6,
    children: [
      { type: 'TEXT', name: 'InputLabel', width, height: 20, text: label, fontSize: 14, fontWeight: 'Medium', fill: DESIGN_SYSTEM.colors.foreground },
      { type: 'RECTANGLE', name: 'InputBox', width, height: 40, fill: DESIGN_SYSTEM.colors.background, stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 8 },
    ],
  }
}

// ─── Page Specs ───────────────────────────────────────────────────────

function homePage(): WireframePage {
  return {
    name: 'HomePage',
    description: 'Landing page with feature cards and hero section',
    frame: {
      type: 'FRAME', name: 'HomePage', width: 1440, height: 1200, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Hero', width: 1440, height: 400, fill: DESIGN_SYSTEM.colors.background,
          layoutMode: 'VERTICAL', itemSpacing: 24, padding: { top: 80, right: 200, bottom: 80, left: 200 },
          children: [
            { type: 'TEXT', name: 'HeroTitle', width: 1040, height: 48, text: 'Coordination Manager', fontSize: 48, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
            { type: 'TEXT', name: 'HeroSubtitle', width: 800, height: 28, text: 'Schedule meetings, coordinate events, and manage your community', fontSize: 20, fill: DESIGN_SYSTEM.colors.mutedForeground },
            { type: 'FRAME', name: 'HeroButtons', width: 400, height: 48, layoutMode: 'HORIZONTAL', itemSpacing: 16, children: [
              button('Get Started'),
              button('Learn More', 'secondary'),
            ]},
          ],
        },
        {
          type: 'FRAME', name: 'FeatureCards', width: 1440, height: 350, layoutMode: 'HORIZONTAL', itemSpacing: 24,
          padding: { top: 32, right: 80, bottom: 32, left: 80 },
          children: [
            card('Calendar Coordination', 400, 280),
            card('Meeting Scheduler', 400, 280),
            card('Community Feedback', 400, 280),
          ],
        },
      ],
    },
  }
}

function calendarPage(): WireframePage {
  return {
    name: 'CalendarPage',
    description: 'Interactive calendar with availability grid and side panel',
    frame: {
      type: 'FRAME', name: 'CalendarPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'CalendarBody', width: 1440, height: 836, layoutMode: 'HORIZONTAL', itemSpacing: 0,
          children: [
            {
              type: 'FRAME', name: 'CalendarMain', width: 1060, height: 836, padding: 32,
              layoutMode: 'VERTICAL', itemSpacing: 24,
              children: [
                { type: 'TEXT', name: 'PageTitle', width: 996, height: 36, text: 'Availability Calendar', fontSize: 30, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
                {
                  type: 'FRAME', name: 'CalendarGrid', width: 996, height: 600, fill: DESIGN_SYSTEM.colors.card,
                  stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 0, padding: 16,
                  children: [
                    { type: 'FRAME', name: 'DayHeaders', width: 964, height: 48, layoutMode: 'HORIZONTAL', itemSpacing: 4, children:
                      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        { type: 'TEXT', name: `Day-${d}`, width: 133, height: 48, text: d, fontSize: 14, fontWeight: 'Medium', fill: DESIGN_SYSTEM.colors.mutedForeground }
                      ))
                    },
                    { type: 'RECTANGLE', name: 'TimeSlotGrid', width: 964, height: 520, fill: DESIGN_SYSTEM.colors.muted, cornerRadius: 8 },
                  ],
                },
              ],
            },
            sidePanel('AI Calendar Assistant'),
          ],
        },
      ],
    },
  }
}

function meetingPage(): WireframePage {
  return {
    name: 'MeetingPage',
    description: 'Meeting details with participant list and scheduling info',
    frame: {
      type: 'FRAME', name: 'MeetingPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'MeetingBody', width: 1440, height: 836, layoutMode: 'HORIZONTAL', itemSpacing: 0,
          children: [
            {
              type: 'FRAME', name: 'MeetingMain', width: 1060, height: 836, padding: 32,
              layoutMode: 'VERTICAL', itemSpacing: 24,
              children: [
                { type: 'TEXT', name: 'PageTitle', width: 996, height: 36, text: 'Meeting Details', fontSize: 30, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
                card('Meeting Info', 996, 200),
                {
                  type: 'FRAME', name: 'ParticipantList', width: 996, height: 300, fill: DESIGN_SYSTEM.colors.card,
                  stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 8, padding: 20,
                  children: [
                    { type: 'TEXT', name: 'ParticipantsTitle', width: 956, height: 28, text: 'Participants', fontSize: 18, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
                    ...Array.from({ length: 4 }, (_, i) => ({
                      type: 'FRAME' as const, name: `Participant-${i + 1}`, width: 956, height: 48, fill: DESIGN_SYSTEM.colors.muted, cornerRadius: 8,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 12, padding: 12,
                      children: [
                        { type: 'ELLIPSE' as const, name: `Avatar-${i + 1}`, width: 32, height: 32, fill: DESIGN_SYSTEM.colors.secondary },
                        { type: 'TEXT' as const, name: `Name-${i + 1}`, width: 200, height: 24, text: `Participant ${i + 1}`, fontSize: 14, fill: DESIGN_SYSTEM.colors.foreground },
                      ],
                    })),
                  ],
                },
              ],
            },
            sidePanel('Meeting Chat'),
          ],
        },
      ],
    },
  }
}

function announcementsPage(): WireframePage {
  return {
    name: 'AnnouncementsPage',
    description: 'Announcement composer with Discord channel selection',
    frame: {
      type: 'FRAME', name: 'AnnouncementsPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'AnnouncementBody', width: 1440, height: 836, padding: { top: 32, right: 200, bottom: 32, left: 200 },
          layoutMode: 'VERTICAL', itemSpacing: 24,
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1040, height: 36, text: 'Send Announcement', fontSize: 30, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
            {
              type: 'FRAME', name: 'ComposerCard', width: 1040, height: 600, fill: DESIGN_SYSTEM.colors.card,
              stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 20, padding: 32,
              children: [
                inputField('Title', 976),
                { type: 'FRAME', name: 'MessageInput', width: 976, height: 200, layoutMode: 'VERTICAL', itemSpacing: 6, children: [
                  { type: 'TEXT', name: 'MessageLabel', width: 976, height: 20, text: 'Message', fontSize: 14, fontWeight: 'Medium', fill: DESIGN_SYSTEM.colors.foreground },
                  { type: 'RECTANGLE', name: 'MessageBox', width: 976, height: 168, fill: DESIGN_SYSTEM.colors.background, stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 8 },
                ]},
                inputField('Discord Channels', 976),
                { type: 'FRAME', name: 'ActionButtons', width: 976, height: 48, layoutMode: 'HORIZONTAL', itemSpacing: 16, children: [
                  button('Send Now'),
                  button('Schedule', 'secondary'),
                ]},
              ],
            },
          ],
        },
      ],
    },
  }
}

function feedbackPage(): WireframePage {
  return {
    name: 'FeedbackPage',
    description: 'Feedback forms and sentiment grid',
    frame: {
      type: 'FRAME', name: 'FeedbackPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'FeedbackBody', width: 1440, height: 836, padding: { top: 32, right: 120, bottom: 32, left: 120 },
          layoutMode: 'VERTICAL', itemSpacing: 24,
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1200, height: 36, text: 'Community Feedback', fontSize: 30, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
            {
              type: 'FRAME', name: 'SentimentGrid', width: 1200, height: 300, fill: DESIGN_SYSTEM.colors.card,
              stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'HORIZONTAL', itemSpacing: 16, padding: 24,
              children: Array.from({ length: 5 }, (_, i) => ({
                type: 'FRAME' as const, name: `SentimentCard-${i + 1}`, width: 216, height: 252,
                fill: DESIGN_SYSTEM.colors.muted, cornerRadius: 8,
                layoutMode: 'VERTICAL' as const, itemSpacing: 12, padding: 16,
                children: [
                  { type: 'ELLIPSE' as const, name: `Emoji-${i + 1}`, width: 48, height: 48, fill: DESIGN_SYSTEM.colors.primary },
                  { type: 'TEXT' as const, name: `SentimentLabel-${i + 1}`, width: 184, height: 24, text: ['Very Negative', 'Negative', 'Neutral', 'Positive', 'Very Positive'][i], fontSize: 14, fontWeight: 'Medium' as const, fill: DESIGN_SYSTEM.colors.foreground },
                  { type: 'RECTANGLE' as const, name: `SentimentBar-${i + 1}`, width: 184, height: 8, fill: DESIGN_SYSTEM.colors.primary, cornerRadius: 4 },
                ],
              })),
            },
            card('Recent Feedback', 1200, 350),
          ],
        },
      ],
    },
  }
}

function settingsPage(): WireframePage {
  return {
    name: 'SettingsPage',
    description: 'User settings with profile, wallet, and preferences',
    frame: {
      type: 'FRAME', name: 'SettingsPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'SettingsBody', width: 1440, height: 836, padding: { top: 32, right: 300, bottom: 32, left: 300 },
          layoutMode: 'VERTICAL', itemSpacing: 24,
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 840, height: 36, text: 'Settings', fontSize: 30, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
            {
              type: 'FRAME', name: 'ProfileSection', width: 840, height: 250, fill: DESIGN_SYSTEM.colors.card,
              stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: [
                { type: 'TEXT', name: 'ProfileTitle', width: 792, height: 28, text: 'Profile', fontSize: 18, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
                inputField('Display Name', 792),
                inputField('Email', 792),
              ],
            },
            {
              type: 'FRAME', name: 'WalletSection', width: 840, height: 160, fill: DESIGN_SYSTEM.colors.card,
              stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: [
                { type: 'TEXT', name: 'WalletTitle', width: 792, height: 28, text: 'Cardano Wallet', fontSize: 18, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
                button('Connect Wallet'),
              ],
            },
          ],
        },
      ],
    },
  }
}

function loginPage(): WireframePage {
  return {
    name: 'LoginPage',
    description: 'Login page with Google OAuth, wallet connect, and guest entry',
    frame: {
      type: 'FRAME', name: 'LoginPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      padding: { top: 200, right: 400, bottom: 200, left: 400 },
      children: [
        {
          type: 'FRAME', name: 'LoginCard', width: 640, height: 500, fill: DESIGN_SYSTEM.colors.card,
          stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 16,
          layoutMode: 'VERTICAL', itemSpacing: 24, padding: 48,
          children: [
            { type: 'TEXT', name: 'LoginTitle', width: 544, height: 40, text: 'Welcome', fontSize: 30, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
            { type: 'TEXT', name: 'LoginSubtitle', width: 544, height: 24, text: 'Sign in to Coordination Manager', fontSize: 16, fill: DESIGN_SYSTEM.colors.mutedForeground },
            button('Continue with Google'),
            button('Connect Wallet', 'secondary'),
            { type: 'RECTANGLE', name: 'Divider', width: 544, height: 1, fill: DESIGN_SYSTEM.colors.border },
            button('Continue as Guest', 'secondary'),
          ],
        },
      ],
    },
  }
}

function aiChatPage(): WireframePage {
  return {
    name: 'AiChatPage',
    description: 'AI chat interface with message list and input',
    frame: {
      type: 'FRAME', name: 'AiChatPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'ChatBody', width: 1440, height: 836, padding: { top: 16, right: 200, bottom: 16, left: 200 },
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            {
              type: 'FRAME', name: 'MessageList', width: 1040, height: 720,
              fill: DESIGN_SYSTEM.colors.card, cornerRadius: 12, stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: Array.from({ length: 4 }, (_, i) => ({
                type: 'FRAME' as const, name: `Message-${i + 1}`, width: 992, height: 80,
                fill: i % 2 === 0 ? DESIGN_SYSTEM.colors.muted : DESIGN_SYSTEM.colors.primary + '20',
                cornerRadius: 12, padding: 16,
                children: [
                  { type: 'TEXT' as const, name: `MsgText-${i + 1}`, width: 960, height: 48, text: i % 2 === 0 ? 'User message placeholder...' : 'AI response placeholder...', fontSize: 14, fill: DESIGN_SYSTEM.colors.foreground },
                ],
              })),
            },
            {
              type: 'FRAME', name: 'ChatInput', width: 1040, height: 64, layoutMode: 'HORIZONTAL', itemSpacing: 12,
              padding: { top: 12, right: 0, bottom: 12, left: 0 },
              children: [
                { type: 'RECTANGLE', name: 'InputBox', width: 920, height: 48, fill: DESIGN_SYSTEM.colors.card, stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 24 },
                button('Send'),
              ],
            },
          ],
        },
      ],
    },
  }
}

function eventsCalendarPage(): WireframePage {
  return {
    name: 'EventsCalendarPage',
    description: 'Full calendar view with event cards and day/week/month toggle',
    frame: {
      type: 'FRAME', name: 'EventsCalendarPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'CalendarHeader', width: 1440, height: 60, layoutMode: 'HORIZONTAL', itemSpacing: 16,
          padding: { top: 12, right: 80, bottom: 12, left: 80 },
          children: [
            { type: 'TEXT', name: 'MonthLabel', width: 200, height: 36, text: 'March 2026', fontSize: 24, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
            button('Day', 'secondary'), button('Week', 'secondary'), button('Month'),
          ],
        },
        {
          type: 'RECTANGLE', name: 'CalendarGrid', width: 1280, height: 676, x: 80,
          fill: DESIGN_SYSTEM.colors.card, stroke: DESIGN_SYSTEM.colors.border, strokeWeight: 1, cornerRadius: 12,
        },
      ],
    },
  }
}

function guardianPage(): WireframePage {
  return {
    name: 'GuardianPage',
    description: 'Discord Guardian moderation dashboard',
    frame: {
      type: 'FRAME', name: 'GuardianPage', width: 1440, height: 900, fill: DESIGN_SYSTEM.colors.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'GuardianBody', width: 1440, height: 836, padding: { top: 32, right: 80, bottom: 32, left: 80 },
          layoutMode: 'VERTICAL', itemSpacing: 24,
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1280, height: 36, text: 'Discord Guardian', fontSize: 30, fontWeight: 'Bold', fill: DESIGN_SYSTEM.colors.foreground },
            {
              type: 'FRAME', name: 'StatsRow', width: 1280, height: 120, layoutMode: 'HORIZONTAL', itemSpacing: 24,
              children: [
                card('Messages Scanned', 304, 120),
                card('Threats Blocked', 304, 120),
                card('Active Servers', 304, 120),
                card('Uptime', 304, 120),
              ],
            },
            card('Recent Activity Log', 1280, 400),
          ],
        },
      ],
    },
  }
}

// ─── Guest Booking Flow (3 steps) ─────────────────────────────────────

function guestBookingStep1(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'GuestBooking-Step1-Name',
    description: 'Step 1: Guest enters their name before picking available times',
    frame: {
      type: 'FRAME', name: 'GuestBooking-Step1', width: 1440, height: 900, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        // Top bar with theme toggle (right-aligned)
        {
          type: 'FRAME', name: 'TopBar', width: 1440, height: 48,
          layoutMode: 'HORIZONTAL', itemSpacing: 0,
          primaryAxisAlignItems: 'MAX',
          padding: { top: 12, right: 12, bottom: 12, left: 12 },
          children: [
            { type: 'RECTANGLE', name: 'ThemeToggle', width: 24, height: 24, cornerRadius: 8, fill: C.muted },
          ],
        },
        // Centered content area (flex-1, items-center, justify-center)
        {
          type: 'FRAME', name: 'CenterContent', width: 1440, height: 852,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          primaryAxisAlignItems: 'CENTER',
          counterAxisAlignItems: 'CENTER',
          padding: { top: 0, right: 0, bottom: 80, left: 0 },
          children: [
            // Gradient badge (blue-500 to purple-600, shown as solid purple)
            {
              type: 'FRAME', name: 'CalendarBadge', width: 56, height: 56,
              fill: '#7C3AED', cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'CalIcon', width: 28, height: 28, text: 'Cal', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' },
              ],
            },
            // Title group
            {
              type: 'FRAME', name: 'TitleGroup', width: 384, height: 90,
              layoutMode: 'VERTICAL', itemSpacing: 4,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'InviteLabel', width: 384, height: 16, text: "YOU'RE INVITED TO", fontSize: 12, fontWeight: 'Medium', fill: C.mutedForeground },
                { type: 'TEXT', name: 'EventName', width: 384, height: 36, text: 'Weekly Team Standup', fontSize: 28, fontWeight: 'Bold', fill: C.foreground },
                { type: 'TEXT', name: 'OrganizedBy', width: 384, height: 18, text: 'Organized by Tevo Saks', fontSize: 14, fill: C.mutedForeground },
              ],
            },
            // Stats badges (pill-shaped, muted bg)
            {
              type: 'FRAME', name: 'StatsBadges', width: 384, height: 28,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'ResponsesBadge', width: 170, height: 28,
                  fill: C.muted, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL', itemSpacing: 6,
                  padding: { top: 4, right: 12, bottom: 4, left: 12 },
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'UsersIcon', width: 14, height: 14, fill: C.mutedForeground },
                    { type: 'TEXT', name: 'RespText', width: 120, height: 14, text: '5 responses so far', fontSize: 12, fill: C.mutedForeground },
                  ],
                },
                {
                  type: 'FRAME', name: 'MeetingsBadge', width: 180, height: 28,
                  fill: C.muted, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL', itemSpacing: 6,
                  padding: { top: 4, right: 12, bottom: 4, left: 12 },
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'ClockIcon', width: 14, height: 14, fill: C.mutedForeground },
                    { type: 'TEXT', name: 'MeetText', width: 130, height: 14, text: '2 meetings confirmed', fontSize: 12, fill: C.mutedForeground },
                  ],
                },
              ],
            },
            // Name input section (max-w-sm = 384px, stacked vertically)
            {
              type: 'FRAME', name: 'NameSection', width: 384, height: 160,
              layoutMode: 'VERTICAL', itemSpacing: 12,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'NameLabel', width: 384, height: 20, text: "What's your name?", fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                {
                  type: 'FRAME', name: 'NameInput', width: 384, height: 48,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 0,
                  primaryAxisAlignItems: 'CENTER',
                  padding: { top: 12, right: 16, bottom: 12, left: 16 },
                  children: [
                    { type: 'TEXT', name: 'Placeholder', width: 352, height: 20, text: 'Enter your name...', fontSize: 16, fill: C.placeholder },
                  ],
                },
                {
                  type: 'FRAME', name: 'PickTimesBtn', width: 384, height: 48,
                  fill: C.primary, cornerRadius: 12,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'BtnLabel', width: 130, height: 20, text: 'Pick your times', fontSize: 16, fontWeight: 'Bold', fill: '#ffffff' },
                    { type: 'TEXT', name: 'BtnArrow', width: 16, height: 20, text: '->', fontSize: 16, fill: '#ffffff' },
                  ],
                },
              ],
            },
            // Footer (helper text + link)
            {
              type: 'FRAME', name: 'Footer', width: 384, height: 60,
              layoutMode: 'VERTICAL', itemSpacing: 16,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'HelperText', width: 320, height: 14, text: 'No account needed. Just enter your name and select when you are available.', fontSize: 12, fill: C.mutedForeground },
                { type: 'TEXT', name: 'CalLink', width: 260, height: 16, text: 'View the full calendar instead  ->', fontSize: 14, fill: C.primary },
              ],
            },
          ],
        },
      ],
    },
  }
}

function guestBookingStep2(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'GuestBooking-Step2-PickTimes',
    description: 'Step 2: Calendar grid where the guest drags to select available times',
    frame: {
      type: 'FRAME', name: 'GuestBooking-Step2', width: 1440, height: 900, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        // Compact sticky header (no full navbar)
        {
          type: 'FRAME', name: 'CompactHeader', width: 1440, height: 52,
          fill: C.background, stroke: C.border, strokeWeight: 1,
          layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: { top: 8, right: 16, bottom: 8, left: 16 },
          counterAxisAlignItems: 'CENTER',
          children: [
            {
              type: 'FRAME', name: 'CalBadge', width: 32, height: 32,
              fill: '#7C3AED', cornerRadius: 8,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'CalBadgeIcon', width: 16, height: 16, text: 'C', fontSize: 12, fontWeight: 'Bold', fill: '#ffffff' },
              ],
            },
            {
              type: 'FRAME', name: 'HeaderText', width: 400, height: 36, layoutMode: 'VERTICAL', itemSpacing: 2,
              children: [
                { type: 'TEXT', name: 'HeaderTitle', width: 400, height: 18, text: 'Weekly Team Standup', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                { type: 'TEXT', name: 'HeaderSubtitle', width: 400, height: 14, text: 'Picking times as Alex', fontSize: 12, fill: C.mutedForeground },
              ],
            },
          ],
        },
        // Purple instruction banner
        {
          type: 'FRAME', name: 'InstructionBanner', width: 1440, height: 44,
          fill: '#2e1065', stroke: '#581c87', strokeWeight: 1,
          layoutMode: 'HORIZONTAL', itemSpacing: 0,
          primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
          padding: { top: 10, right: 16, bottom: 10, left: 16 },
          children: [
            { type: 'TEXT', name: 'InstructionText', width: 500, height: 18, text: "Drag to select when you're available, then confirm below", fontSize: 14, fontWeight: 'Medium', fill: '#c084fc' },
          ],
        },
        // Calendar content
        {
          type: 'FRAME', name: 'CalendarContent', width: 1440, height: 804,
          padding: { top: 12, right: 120, bottom: 12, left: 120 },
          layoutMode: 'VERTICAL', itemSpacing: 8,
          children: [
            // Week navigation
            {
              type: 'FRAME', name: 'WeekNav', width: 1200, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'FRAME', name: 'PrevBtn', width: 36, height: 36, fill: C.muted, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'PrevArrow', width: 16, height: 20, text: '<', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                  ],
                },
                { type: 'TEXT', name: 'WeekLabel', width: 280, height: 36, text: 'Mar 9 - Mar 15, 2026', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                { type: 'FRAME', name: 'NextBtn', width: 36, height: 36, fill: C.muted, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'NextArrow', width: 16, height: 20, text: '>', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                  ],
                },
              ],
            },
            // Day headers row
            {
              type: 'FRAME', name: 'DayHeaders', width: 1200, height: 56,
              fill: C.card, stroke: C.border, strokeWeight: 1,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              children: [
                { type: 'FRAME', name: 'TimeColHeader', width: 60, height: 56, children: [] },
                ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
                  type: 'FRAME' as const, name: `DayCol-${day}`, width: 163, height: 56,
                  stroke: C.border, strokeWeight: 1,
                  fill: i === 0 ? '#1e3a1e' : i === 6 ? '#1e1b4b' : undefined as string | undefined,
                  layoutMode: 'VERTICAL' as const, itemSpacing: 2,
                  primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    { type: 'TEXT' as const, name: `DayName-${day}`, width: 40, height: 16, text: day, fontSize: 12, fontWeight: 'Medium' as const,
                      fill: i === 0 ? '#4ade80' : i === 6 ? '#818cf8' : C.foreground },
                    { type: 'TEXT' as const, name: `DayNum-${i}`, width: 30, height: 24, text: `${9 + i}`, fontSize: 18, fontWeight: 'Bold' as const,
                      fill: i === 0 ? '#4ade80' : i === 6 ? '#818cf8' : C.foreground },
                  ],
                })),
              ],
            },
            // Time grid with cells
            {
              type: 'FRAME', name: 'TimeGrid', width: 1200, height: 580,
              fill: C.card, stroke: C.border, strokeWeight: 1,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children:
                ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].map((time, rowIdx) => ({
                  type: 'FRAME' as const, name: `TimeRow-${time}`, width: 1200, height: 32,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                  children: [
                    { type: 'TEXT' as const, name: `TimeLabel-${time}`, width: 60, height: 32, text: time, fontSize: 11, fill: C.mutedForeground },
                    ...Array.from({ length: 7 }, (_, colIdx) => {
                      const isUserSelected = (colIdx >= 1 && colIdx <= 3 && rowIdx >= 2 && rowIdx <= 7)
                      const hasOtherAvail = (colIdx >= 2 && colIdx <= 4 && rowIdx >= 4 && rowIdx <= 9)
                      let cellFill = C.background
                      if (isUserSelected) cellFill = '#7c3aed'
                      else if (hasOtherAvail) cellFill = '#166534'
                      return {
                        type: 'RECTANGLE' as const,
                        name: `Cell-${time}-${colIdx}`,
                        width: 163, height: 32,
                        fill: cellFill,
                        stroke: C.border, strokeWeight: 0.5,
                      }
                    }),
                  ],
                })),
            },
            // Bottom action bar
            {
              type: 'FRAME', name: 'ConfirmBar', width: 1200, height: 56,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              counterAxisAlignItems: 'CENTER',
              padding: { top: 8, right: 0, bottom: 8, left: 0 },
              children: [
                {
                  type: 'FRAME', name: 'SelectionInfo', width: 300, height: 40,
                  layoutMode: 'HORIZONTAL', itemSpacing: 6,
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'CheckIcon', width: 16, height: 16, fill: '#a855f6' },
                    { type: 'TEXT', name: 'SelectionCount', width: 260, height: 20, text: '24 slots selected', fontSize: 14, fontWeight: 'Medium', fill: '#a855f6' },
                  ],
                },
                {
                  type: 'FRAME', name: 'BackBtn', width: 80, height: 40,
                  fill: C.muted, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 0,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'BackLabel', width: 40, height: 20, text: 'Back', fontSize: 14, fill: C.mutedForeground },
                  ],
                },
                {
                  type: 'FRAME', name: 'ConfirmButton', width: 210, height: 44,
                  fill: '#16a34a', cornerRadius: 12,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'ConfirmCheckIcon', width: 16, height: 16, fill: '#ffffff' },
                    { type: 'TEXT', name: 'ConfirmLabel', width: 160, height: 20, text: 'Confirm Availability', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function guestBookingStep3(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'GuestBooking-Step3-Success',
    description: 'Step 3: Celebration screen after submitting availability',
    frame: {
      type: 'FRAME', name: 'GuestBooking-Step3', width: 1440, height: 900, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
      children: [
        // Confetti decoration (scattered colored dots)
        { type: 'RECTANGLE', name: 'Confetti-1', width: 8, height: 12, x: 200, y: 80, fill: '#8B5CF6', cornerRadius: 2 },
        { type: 'RECTANGLE', name: 'Confetti-2', width: 6, height: 9, x: 400, y: 120, fill: '#3B82F6', cornerRadius: 2 },
        { type: 'RECTANGLE', name: 'Confetti-3', width: 10, height: 15, x: 1100, y: 100, fill: '#10B981', cornerRadius: 2 },
        { type: 'RECTANGLE', name: 'Confetti-4', width: 7, height: 10, x: 1200, y: 150, fill: '#F59E0B', cornerRadius: 2 },
        { type: 'RECTANGLE', name: 'Confetti-5', width: 8, height: 12, x: 300, y: 200, fill: '#EF4444', cornerRadius: 2 },
        { type: 'RECTANGLE', name: 'Confetti-6', width: 6, height: 9, x: 900, y: 90, fill: '#EC4899', cornerRadius: 2 },
        { type: 'RECTANGLE', name: 'Confetti-7', width: 9, height: 13, x: 700, y: 140, fill: '#6366F1', cornerRadius: 2 },
        { type: 'RECTANGLE', name: 'Confetti-8', width: 7, height: 11, x: 1050, y: 200, fill: '#14B8A6', cornerRadius: 2 },
        // Main content
        {
          type: 'FRAME', name: 'SuccessContent', width: 520, height: 720,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          counterAxisAlignItems: 'CENTER',
          children: [
            // Green celebration circle (gradient green-400 to emerald-500)
            {
              type: 'ELLIPSE', name: 'CelebrationCircle', width: 80, height: 80, fill: '#10B981',
            },
            // Title
            { type: 'TEXT', name: 'SuccessTitle', width: 520, height: 48, text: "You're in!", fontSize: 36, fontWeight: 'Bold', fill: C.foreground },
            // Description group
            {
              type: 'FRAME', name: 'DescGroup', width: 520, height: 56,
              layoutMode: 'VERTICAL', itemSpacing: 8,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'ThanksText', width: 520, height: 24, text: 'Thanks for contributing to the planning of Weekly Team Standup!', fontSize: 18, fill: C.mutedForeground },
                { type: 'TEXT', name: 'SavedText', width: 520, height: 18, text: 'Your availability has been saved. The organizer will pick the best time.', fontSize: 14, fill: C.mutedForeground },
              ],
            },
            // "What's Next?" card
            {
              type: 'FRAME', name: 'WhatsNextCard', width: 520, height: 150,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: [
                {
                  type: 'FRAME', name: 'WhatsNextHeader', width: 472, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12,
                  counterAxisAlignItems: 'MIN',
                  children: [
                    {
                      type: 'FRAME', name: 'NextIconBadge', width: 40, height: 40,
                      fill: '#10B981', cornerRadius: 10,
                      layoutMode: 'VERTICAL', itemSpacing: 0,
                      primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'NextArrowIcon', width: 20, height: 20, text: '->', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' },
                      ],
                    },
                    {
                      type: 'FRAME', name: 'NextTextBlock', width: 420, height: 44,
                      layoutMode: 'VERTICAL', itemSpacing: 4,
                      children: [
                        { type: 'TEXT', name: 'NextTitle', width: 420, height: 20, text: "What's Next?", fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                        { type: 'TEXT', name: 'NextDesc', width: 420, height: 16, text: 'The organizer has a recommended next step for you', fontSize: 13, fill: C.mutedForeground },
                      ],
                    },
                  ],
                },
                {
                  type: 'FRAME', name: 'NextStepBtn', width: 200, height: 40,
                  fill: C.primary, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'NextStepLabel', width: 160, height: 16, text: 'Continue to Next Step', fontSize: 14, fontWeight: 'Medium', fill: '#ffffff' },
                  ],
                },
              ],
            },
            // "Explore Coordination Manager" card
            {
              type: 'FRAME', name: 'ExploreCard', width: 520, height: 160,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: [
                {
                  type: 'FRAME', name: 'ExploreHeader', width: 472, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12,
                  counterAxisAlignItems: 'MIN',
                  children: [
                    {
                      type: 'FRAME', name: 'ExploreIconBadge', width: 40, height: 40,
                      fill: '#7C3AED', cornerRadius: 10,
                      layoutMode: 'VERTICAL', itemSpacing: 0,
                      primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'SparkleIcon', width: 20, height: 20, text: '*', fontSize: 18, fontWeight: 'Bold', fill: '#ffffff' },
                      ],
                    },
                    {
                      type: 'FRAME', name: 'ExploreTextBlock', width: 420, height: 44,
                      layoutMode: 'VERTICAL', itemSpacing: 4,
                      children: [
                        { type: 'TEXT', name: 'ExploreTitle', width: 420, height: 20, text: 'Explore Coordination Manager', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                        { type: 'TEXT', name: 'ExploreDesc', width: 420, height: 16, text: 'Discover how teams find meeting times and stay in sync', fontSize: 13, fill: C.mutedForeground },
                      ],
                    },
                  ],
                },
                {
                  type: 'FRAME', name: 'ExploreBtn', width: 200, height: 40,
                  fill: C.primary, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'ExploreLabel', width: 170, height: 16, text: 'Explore the Application', fontSize: 14, fontWeight: 'Medium', fill: '#ffffff' },
                  ],
                },
              ],
            },
            // View calendar link
            { type: 'TEXT', name: 'ViewCalendarLink', width: 340, height: 18, text: 'View The Current Coordination Calendar  ->', fontSize: 14, fill: C.primary },
          ],
        },
      ],
    },
  }
}

// ─── Facilitator Journey ──────────────────────────────────────────────
// A 13-step flow showing the full facilitator user guide.

const W = 1440, H = 900 // Standard frame dimensions

function fj01_HomeUnauthenticated(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '01 - Home (No Account)',
    description: 'Facilitator arrives at the landing page without an account',
    transitionLabel: 'clicks Coordinate',
    frame: {
      type: 'FRAME', name: 'FJ-Home', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        // Hero
        {
          type: 'FRAME', name: 'Hero', width: W, height: 360, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 20,
          primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
          padding: { top: 60, right: 200, bottom: 40, left: 200 },
          children: [
            { type: 'TEXT', name: 'HeroTitle', width: 800, height: 48, text: 'How would you like to coordinate?', fontSize: 36, fontWeight: 'Bold', fill: C.foreground },
            { type: 'TEXT', name: 'HeroSub', width: 500, height: 24, text: 'Engage. Schedule. Synchronize.', fontSize: 18, fill: C.mutedForeground },
            {
              type: 'FRAME', name: 'HeroCTAs', width: 500, height: 48,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              primaryAxisAlignItems: 'CENTER',
              children: [
                button('Join Conversations', 'secondary'),
                button('Coordinate the Next Meeting'),
              ],
            },
          ],
        },
        // Feature cards (6 items in 2x3 grid)
        {
          type: 'FRAME', name: 'FeatureGrid', width: W, height: 400,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 24, right: 80, bottom: 24, left: 80 },
          children: [
            { type: 'TEXT', name: 'ExploreLabel', width: 1280, height: 28, text: 'Explore', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
            {
              type: 'FRAME', name: 'CardRow1', width: 1280, height: 140,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                card('Agentic Tools', 416, 140),
                card('Distribution', 416, 140),
                card('Availability', 416, 140),
              ],
            },
            {
              type: 'FRAME', name: 'CardRow2', width: 1280, height: 140,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                card('Public Events', 416, 140),
                card('API Integration', 416, 140),
                card('Feedback', 416, 140),
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj02_CreateCalendar(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '02 - Create Calendar',
    description: 'Facilitator creates a new Coordination Calendar',
    transitionLabel: 'proceeds to login',
    frame: {
      type: 'FRAME', name: 'FJ-CreateCalendar', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'CalBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 20,
          padding: { top: 24, right: 80, bottom: 24, left: 80 },
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1280, height: 36, text: 'Prepare Coordination Calendar', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
            // Learner guide
            {
              type: 'FRAME', name: 'LearnerGuide', width: 1280, height: 80,
              fill: '#1e3a5f', stroke: '#2563eb', strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 6, padding: 16,
              children: [
                { type: 'TEXT', name: 'GuideTitle', width: 1248, height: 20, text: 'Getting Started Guide', fontSize: 14, fontWeight: 'Bold', fill: '#93c5fd' },
                { type: 'TEXT', name: 'GuideText', width: 1248, height: 32, text: 'Name your event, set the date range, mark your availability, then share the invite link.', fontSize: 13, fill: '#bfdbfe' },
              ],
            },
            // Event name input
            {
              type: 'FRAME', name: 'EventNameRow', width: 1280, height: 52,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'EventInput', width: 600, height: 44,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 10, right: 16, bottom: 10, left: 16 },
                  children: [
                    { type: 'TEXT', name: 'EventPlaceholder', width: 568, height: 20, text: 'Weekly Team Standup', fontSize: 16, fill: C.foreground },
                  ],
                },
                button('Create Calendar'),
              ],
            },
            // Date range picker
            {
              type: 'FRAME', name: 'DateRange', width: 1280, height: 60,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 16, padding: 16,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'FromLabel', width: 50, height: 20, text: 'From:', fontSize: 14, fill: C.mutedForeground },
                { type: 'RECTANGLE', name: 'StartDate', width: 160, height: 36, fill: C.muted, cornerRadius: 8, stroke: C.border, strokeWeight: 1 },
                { type: 'TEXT', name: 'ToLabel', width: 30, height: 20, text: 'To:', fontSize: 14, fill: C.mutedForeground },
                { type: 'RECTANGLE', name: 'EndDate', width: 160, height: 36, fill: C.muted, cornerRadius: 8, stroke: C.border, strokeWeight: 1 },
              ],
            },
            // Empty calendar grid placeholder
            {
              type: 'FRAME', name: 'EmptyGrid', width: 1280, height: 500,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children: [
                // Day headers
                {
                  type: 'FRAME', name: 'DayHeaders', width: 1280, height: 48,
                  fill: C.card, stroke: C.border, strokeWeight: 1,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  children: [
                    { type: 'FRAME', name: 'TimeCol', width: 60, height: 48, children: [] },
                    ...['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20', 'Sat 21', 'Sun 22'].map(d => ({
                      type: 'FRAME' as const, name: `Day-${d}`, width: 174, height: 48,
                      stroke: C.border, strokeWeight: 1,
                      layoutMode: 'VERTICAL' as const, itemSpacing: 2,
                      primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'TEXT' as const, name: `DayLabel-${d}`, width: 60, height: 16, text: d.split(' ')[0], fontSize: 12, fill: C.foreground },
                        { type: 'TEXT' as const, name: `DayNum-${d}`, width: 30, height: 24, text: d.split(' ')[1], fontSize: 18, fontWeight: 'Bold' as const, fill: C.foreground },
                      ],
                    })),
                  ],
                },
                // Empty grid (faded, no selections yet)
                { type: 'RECTANGLE', name: 'GridPlaceholder', width: 1280, height: 450, fill: '#0d0d14' },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj03_LoginCardano(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '03 - Login (Cardano Wallet)',
    description: 'Facilitator creates an account by connecting their Cardano wallet',
    transitionLabel: 'wallet connected',
    frame: {
      type: 'FRAME', name: 'FJ-Login', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        // Simple header
        {
          type: 'FRAME', name: 'LoginHeader', width: W, height: 56,
          layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: { top: 12, right: 32, bottom: 12, left: 32 },
          counterAxisAlignItems: 'CENTER',
          children: [
            { type: 'ELLIPSE', name: 'CalIcon', width: 32, height: 32, fill: C.primary },
            { type: 'TEXT', name: 'BrandName', width: 240, height: 24, text: 'Coordination Manager', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
          ],
        },
        // Centered login card
        {
          type: 'FRAME', name: 'LoginCenter', width: W, height: H - 56,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
          children: [
            {
              type: 'FRAME', name: 'LoginCard', width: 440, height: 560,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 16,
              layoutMode: 'VERTICAL', itemSpacing: 20, padding: 32,
              children: [
                { type: 'TEXT', name: 'WelcomeTitle', width: 376, height: 36, text: 'Welcome', fontSize: 28, fontWeight: 'Bold', fill: C.foreground },
                { type: 'TEXT', name: 'WelcomeSub', width: 376, height: 20, text: 'Sign in to Coordination Manager', fontSize: 14, fill: C.mutedForeground },
                // Google button
                {
                  type: 'FRAME', name: 'GoogleBtn', width: 376, height: 44,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 10,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'GoogleIcon', width: 20, height: 20, fill: '#4285f4' },
                    { type: 'TEXT', name: 'GoogleLabel', width: 150, height: 20, text: 'Continue with Google', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                  ],
                },
                { type: 'TEXT', name: 'GoogleInfo', width: 376, height: 14, text: 'Full access - calendar sync, persistent account', fontSize: 12, fill: C.mutedForeground },
                // Cardano button (highlighted - this is what user clicks)
                {
                  type: 'FRAME', name: 'CardanoBtn', width: 376, height: 44,
                  fill: '#1a1a2e', stroke: '#6d28d9', strokeWeight: 2, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 10,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'WalletIcon', width: 20, height: 20, fill: '#6d28d9' },
                    { type: 'TEXT', name: 'CardanoLabel', width: 200, height: 20, text: 'Connect Cardano Wallet', fontSize: 14, fontWeight: 'Bold', fill: '#a78bfa' },
                  ],
                },
                { type: 'TEXT', name: 'WalletInfo', width: 376, height: 28, text: 'Sign in with your Cardano wallet - prove ownership with a signature. No transaction submitted.', fontSize: 12, fill: C.mutedForeground },
                // Divider
                { type: 'RECTANGLE', name: 'Divider', width: 376, height: 1, fill: C.border },
                // Traveler
                {
                  type: 'FRAME', name: 'TravelerBtn', width: 376, height: 44,
                  fill: '#422006', stroke: '#92400e', strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 10,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'CompassIcon', width: 20, height: 20, fill: '#f59e0b' },
                    { type: 'TEXT', name: 'TravelerLabel', width: 200, height: 20, text: 'Continue as Traveler', fontSize: 14, fontWeight: 'Medium', fill: '#fbbf24' },
                  ],
                },
                { type: 'TEXT', name: 'TravelerInfo', width: 376, height: 14, text: 'No email needed - random identity, expires in 64 days', fontSize: 12, fill: C.mutedForeground },
                // Privacy
                { type: 'TEXT', name: 'LegalLinks', width: 376, height: 14, text: 'Privacy Policy  |  Terms of Service', fontSize: 12, fill: C.mutedForeground },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj04_CalendarWithInvite(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '04 - Share Invite Link',
    description: 'Calendar is created - facilitator copies invite link for planning',
    transitionLabel: 'clicks Distribute',
    frame: {
      type: 'FRAME', name: 'FJ-ShareInvite', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'CalBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 20, right: 80, bottom: 20, left: 80 },
          children: [
            // Title + actions row
            {
              type: 'FRAME', name: 'HeaderRow', width: 1280, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'CalTitle', width: 400, height: 32, text: 'Coordination Calendar', fontSize: 22, fontWeight: 'Bold', fill: C.foreground },
                button('Edit Settings', 'secondary'),
                button('Invite for Planning'),
              ],
            },
            // Calendar info bar
            {
              type: 'FRAME', name: 'InfoBar', width: 1280, height: 44,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 16, padding: { top: 8, right: 16, bottom: 8, left: 16 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'EventLabel', width: 300, height: 20, text: 'Weekly Team Standup', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                { type: 'TEXT', name: 'TZLabel', width: 120, height: 16, text: 'UTC+2 (Europe)', fontSize: 12, fill: C.mutedForeground },
                { type: 'TEXT', name: 'VisLabel', width: 60, height: 16, text: 'Public', fontSize: 12, fill: '#4ade80' },
                // Copy link button (highlighted)
                {
                  type: 'FRAME', name: 'CopyLinkBtn', width: 220, height: 36,
                  fill: '#1a1a2e', stroke: '#6d28d9', strokeWeight: 2, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'CopyIcon', width: 16, height: 16, text: 'Lnk', fontSize: 12, fill: '#a78bfa' },
                    { type: 'TEXT', name: 'CopyLabel', width: 160, height: 16, text: 'Copy Invite Link', fontSize: 13, fontWeight: 'Medium', fill: '#a78bfa' },
                  ],
                },
              ],
            },
            // Participant section (just the facilitator)
            {
              type: 'FRAME', name: 'ParticipantRow', width: 1280, height: 40,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: { top: 8, right: 16, bottom: 8, left: 16 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PartLabel', width: 100, height: 18, text: 'Participants:', fontSize: 13, fill: C.mutedForeground },
                {
                  type: 'FRAME', name: 'YouPill', width: 80, height: 28,
                  fill: '#6d28d9', cornerRadius: 9999, padding: { top: 4, right: 12, bottom: 4, left: 12 },
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'YouName', width: 56, height: 16, text: 'Tevo (you)', fontSize: 12, fontWeight: 'Medium', fill: '#ffffff' },
                  ],
                },
              ],
            },
            // Calendar grid with user's selections
            {
              type: 'FRAME', name: 'CalGrid', width: 1280, height: 520,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children: [
                {
                  type: 'FRAME', name: 'GridDayHeaders', width: 1280, height: 48,
                  fill: C.card, stroke: C.border, strokeWeight: 1,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  children: [
                    { type: 'FRAME', name: 'TimeCol', width: 60, height: 48, children: [] },
                    ...['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20'].map((d, i) => ({
                      type: 'FRAME' as const, name: `Day-${d}`, width: 244, height: 48,
                      stroke: C.border, strokeWeight: 1,
                      fill: i === 0 ? '#1e3a1e' : undefined as string | undefined,
                      layoutMode: 'VERTICAL' as const, itemSpacing: 2,
                      primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'TEXT' as const, name: `DL-${d}`, width: 40, height: 14, text: d.split(' ')[0], fontSize: 12, fill: i === 0 ? '#4ade80' : C.foreground },
                        { type: 'TEXT' as const, name: `DN-${d}`, width: 30, height: 22, text: d.split(' ')[1], fontSize: 18, fontWeight: 'Bold' as const, fill: i === 0 ? '#4ade80' : C.foreground },
                      ],
                    })),
                  ],
                },
                // Grid body with some purple selections (facilitator's availability)
                {
                  type: 'FRAME', name: 'GridBody', width: 1280, height: 470,
                  layoutMode: 'VERTICAL', itemSpacing: 0,
                  children: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30'].map((time, rowIdx) => ({
                    type: 'FRAME' as const, name: `Row-${time}`, width: 1280, height: 36,
                    layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                    children: [
                      { type: 'TEXT' as const, name: `T-${time}`, width: 60, height: 36, text: time, fontSize: 11, fill: C.mutedForeground },
                      ...Array.from({ length: 5 }, (_, colIdx) => {
                        const selected = colIdx <= 3 && rowIdx >= 2 && rowIdx <= 8
                        return {
                          type: 'RECTANGLE' as const, name: `C-${time}-${colIdx}`, width: 244, height: 36,
                          fill: selected ? '#7c3aed' : C.background,
                          stroke: C.border, strokeWeight: 0.5,
                        }
                      }),
                    ],
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj05_DistributeInvite(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '05 - Distribute Invite',
    description: 'Facilitator opens Distribution page to send invite, sees Discord not connected',
    transitionLabel: 'clicks Discord tab',
    frame: {
      type: 'FRAME', name: 'FJ-Distribute', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'DistBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 20, right: 160, bottom: 20, left: 160 },
          children: [
            // Page header
            {
              type: 'FRAME', name: 'DistHeader', width: 1120, height: 52,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'MegaphoneIcon', width: 40, height: 40, fill: C.primary },
                {
                  type: 'FRAME', name: 'HeaderText', width: 600, height: 52,
                  layoutMode: 'VERTICAL', itemSpacing: 4,
                  children: [
                    { type: 'TEXT', name: 'DistTitle', width: 600, height: 28, text: 'Distribute Announcements', fontSize: 22, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'DistSub', width: 600, height: 16, text: 'Send messages across Discord channels and DMs', fontSize: 13, fill: C.mutedForeground },
                  ],
                },
              ],
            },
            // Tabs
            {
              type: 'FRAME', name: 'TabBar', width: 1120, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              stroke: C.border, strokeWeight: 1,
              children: [
                { type: 'FRAME', name: 'Tab-Compose', width: 280, height: 44, fill: C.card, stroke: C.border, strokeWeight: 1,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'ComposeLabel', width: 80, height: 18, text: 'Compose', fontSize: 14, fontWeight: 'Bold', fill: C.primary }],
                },
                { type: 'FRAME', name: 'Tab-Templates', width: 280, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'TemplatesLabel', width: 80, height: 18, text: 'Templates', fontSize: 14, fill: C.mutedForeground }],
                },
                { type: 'FRAME', name: 'Tab-Scheduled', width: 280, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'ScheduledLabel', width: 80, height: 18, text: 'Scheduled', fontSize: 14, fill: C.mutedForeground }],
                },
                { type: 'FRAME', name: 'Tab-Discord', width: 280, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'DiscordLabel', width: 80, height: 18, text: 'Discord', fontSize: 14, fill: C.mutedForeground }],
                },
              ],
            },
            // Compose content area
            {
              type: 'FRAME', name: 'ComposeArea', width: 1120, height: 640,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: [
                // Warning: Discord not connected
                {
                  type: 'FRAME', name: 'DiscordWarning', width: 1072, height: 56,
                  fill: '#422006', stroke: '#92400e', strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 16,
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'WarnIcon', width: 20, height: 20, fill: '#f59e0b' },
                    { type: 'TEXT', name: 'WarnText', width: 800, height: 20, text: 'Discord bot is not connected. Go to the Discord tab to set up your bot integration.', fontSize: 14, fill: '#fbbf24' },
                  ],
                },
                // Prefilled title
                inputField('Title', 1072),
                // Prefilled body
                {
                  type: 'FRAME', name: 'BodyInput', width: 1072, height: 200,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    { type: 'TEXT', name: 'BodyLabel', width: 1072, height: 20, text: 'Message Body', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'BodyBox', width: 1072, height: 168,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                      padding: 12,
                      children: [
                        { type: 'TEXT', name: 'BodyText', width: 1048, height: 80, text: 'Hey team! Please mark your availability for our Weekly Team Standup. Click the link below to pick your times...', fontSize: 14, fill: C.foreground },
                      ],
                    },
                  ],
                },
                // Empty channel list
                {
                  type: 'FRAME', name: 'ChannelSection', width: 1072, height: 120,
                  fill: C.muted, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 0,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'NoChannels', width: 400, height: 20, text: 'No Discord channels available', fontSize: 14, fill: C.mutedForeground },
                    { type: 'TEXT', name: 'ConnectHint', width: 400, height: 16, text: 'Connect your Discord bot to see channels', fontSize: 12, fill: C.mutedForeground },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj06_DiscordIntegration(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '06 - Discord Integration',
    description: 'Facilitator sets up Discord bot integration via the Discord tab',
    transitionLabel: 'bot connected',
    frame: {
      type: 'FRAME', name: 'FJ-Discord', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'DiscBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 20, right: 160, bottom: 20, left: 160 },
          children: [
            // Same header
            {
              type: 'FRAME', name: 'DistHeader', width: 1120, height: 36,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'MegaphoneIcon', width: 28, height: 28, fill: C.primary },
                { type: 'TEXT', name: 'DistTitle', width: 300, height: 28, text: 'Distribute Announcements', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
              ],
            },
            // Tabs - Discord tab active
            {
              type: 'FRAME', name: 'TabBar', width: 1120, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              stroke: C.border, strokeWeight: 1,
              children: [
                { type: 'FRAME', name: 'Tab-Compose', width: 280, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'CL', width: 80, height: 18, text: 'Compose', fontSize: 14, fill: C.mutedForeground }],
                },
                { type: 'FRAME', name: 'Tab-Templates', width: 280, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'TL', width: 80, height: 18, text: 'Templates', fontSize: 14, fill: C.mutedForeground }],
                },
                { type: 'FRAME', name: 'Tab-Scheduled', width: 280, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'SL', width: 80, height: 18, text: 'Scheduled', fontSize: 14, fill: C.mutedForeground }],
                },
                { type: 'FRAME', name: 'Tab-Discord', width: 280, height: 44, fill: C.card, stroke: C.border, strokeWeight: 1,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'DL', width: 80, height: 18, text: 'Discord', fontSize: 14, fontWeight: 'Bold', fill: C.primary }],
                },
              ],
            },
            // Discord tab content
            {
              type: 'FRAME', name: 'DiscordContent', width: 1120, height: 640,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 20, padding: 24,
              children: [
                // Link key section
                {
                  type: 'FRAME', name: 'LinkKeySection', width: 1072, height: 100,
                  fill: '#1a1a2e', stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 12, padding: 20,
                  children: [
                    { type: 'TEXT', name: 'LinkTitle', width: 1032, height: 20, text: 'Connect Discord Bot', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'LinkRow', width: 1032, height: 40,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12,
                      counterAxisAlignItems: 'CENTER',
                      children: [
                        {
                          type: 'FRAME', name: 'LinkKeyBox', width: 500, height: 36,
                          fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                          padding: { top: 8, right: 12, bottom: 8, left: 12 },
                          children: [
                            { type: 'TEXT', name: 'KeyValue', width: 476, height: 16, text: 'cm_link_a8f3b2e1c9d4...', fontSize: 13, fill: C.mutedForeground },
                          ],
                        },
                        button('Generate Link Key'),
                        button('Copy', 'secondary'),
                      ],
                    },
                  ],
                },
                // Server list
                {
                  type: 'FRAME', name: 'ServerList', width: 1072, height: 340,
                  layoutMode: 'VERTICAL', itemSpacing: 12,
                  children: [
                    { type: 'TEXT', name: 'ServersTitle', width: 1072, height: 24, text: 'Connected Servers', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    // Server 1
                    {
                      type: 'FRAME', name: 'Server1', width: 1072, height: 140,
                      fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                      layoutMode: 'VERTICAL', itemSpacing: 8, padding: 16,
                      children: [
                        { type: 'TEXT', name: 'Server1Name', width: 1040, height: 20, text: 'My DAO Community', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                        // Channels
                        ...['# general', '# announcements', '# coordination'].map(ch => ({
                          type: 'FRAME' as const, name: `Ch-${ch}`, width: 1040, height: 28,
                          layoutMode: 'HORIZONTAL' as const, itemSpacing: 8,
                          counterAxisAlignItems: 'CENTER' as const,
                          children: [
                            { type: 'RECTANGLE' as const, name: `Toggle-${ch}`, width: 36, height: 20, fill: '#16a34a', cornerRadius: 10 },
                            { type: 'TEXT' as const, name: `ChName-${ch}`, width: 200, height: 16, text: ch, fontSize: 13, fill: C.foreground },
                            { type: 'TEXT' as const, name: `ChPerm-${ch}`, width: 80, height: 14, text: 'can send', fontSize: 11, fill: '#4ade80' },
                          ],
                        })),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj07_SendMessage(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '07 - Send Announcement',
    description: 'Facilitator sends the planning invite via Discord channels',
    transitionLabel: 'checks logs',
    frame: {
      type: 'FRAME', name: 'FJ-SendMsg', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'SendBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 20, right: 160, bottom: 20, left: 160 },
          children: [
            { type: 'FRAME', name: 'Header', width: 1120, height: 36, layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'Icon', width: 28, height: 28, fill: C.primary },
                { type: 'TEXT', name: 'Title', width: 300, height: 28, text: 'Distribute Announcements', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
              ],
            },
            // Compose tab active (with Discord connected now)
            {
              type: 'FRAME', name: 'ComposeContent', width: 1120, height: 700,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: [
                // Title field
                {
                  type: 'FRAME', name: 'TitleField', width: 1072, height: 68,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    { type: 'TEXT', name: 'TL', width: 1072, height: 20, text: 'Title', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'TitleInput', width: 1072, height: 40,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                      padding: { top: 10, right: 16, bottom: 10, left: 16 },
                      children: [
                        { type: 'TEXT', name: 'TV', width: 1040, height: 18, text: 'Planning: Weekly Team Standup', fontSize: 14, fill: C.foreground },
                      ],
                    },
                  ],
                },
                // Body
                {
                  type: 'FRAME', name: 'BodyBox', width: 1072, height: 140,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: 12,
                  children: [
                    { type: 'TEXT', name: 'BV', width: 1048, height: 100, text: 'Hey team! Please fill in your availability for the Weekly Team Standup.\n\nClick here to pick your times: https://app.coordmanager.com/guest/abc123\n\nDeadline: Friday 5pm', fontSize: 14, fill: C.foreground },
                  ],
                },
                // Channel list (connected, with checkboxes)
                {
                  type: 'FRAME', name: 'Channels', width: 1072, height: 180,
                  layoutMode: 'VERTICAL', itemSpacing: 8,
                  children: [
                    { type: 'TEXT', name: 'ChTitle', width: 1072, height: 20, text: 'Distribution Channels', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    ...['# general', '# announcements', '# coordination'].map((ch, i) => ({
                      type: 'FRAME' as const, name: `ChRow-${i}`, width: 1072, height: 36,
                      fill: C.muted, cornerRadius: 6,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 12, padding: { top: 8, right: 12, bottom: 8, left: 12 },
                      counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'RECTANGLE' as const, name: `CB-${i}`, width: 18, height: 18, fill: i < 2 ? C.primary : C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 4 },
                        { type: 'TEXT' as const, name: `CN-${i}`, width: 200, height: 16, text: `My DAO  ${ch}`, fontSize: 13, fill: C.foreground },
                        { type: 'TEXT' as const, name: `CS-${i}`, width: 80, height: 14, text: 'can send', fontSize: 11, fill: '#4ade80' },
                      ],
                    })),
                  ],
                },
                // Action bar
                {
                  type: 'FRAME', name: 'ActionBar', width: 1072, height: 56,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12,
                  primaryAxisAlignItems: 'MAX',
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    button('Save as Template', 'secondary'),
                    {
                      type: 'FRAME', name: 'SendNowBtn', width: 160, height: 44,
                      fill: '#16a34a', cornerRadius: 10,
                      layoutMode: 'HORIZONTAL', itemSpacing: 8,
                      primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'SendLabel', width: 100, height: 20, text: 'Send Now', fontSize: 16, fontWeight: 'Bold', fill: '#ffffff' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj08_CheckLogs(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '08 - Check Delivery Logs',
    description: 'Facilitator checks the Scheduled tab to see delivery status',
    transitionLabel: 'next day...',
    frame: {
      type: 'FRAME', name: 'FJ-Logs', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'LogsBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 20, right: 160, bottom: 20, left: 160 },
          children: [
            { type: 'FRAME', name: 'Header', width: 1120, height: 36, layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'Icon', width: 28, height: 28, fill: C.primary },
                { type: 'TEXT', name: 'Title', width: 300, height: 28, text: 'Distribute Announcements', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
              ],
            },
            // Tabs - Scheduled active
            {
              type: 'FRAME', name: 'TabBar', width: 1120, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 0, stroke: C.border, strokeWeight: 1,
              children: [
                { type: 'FRAME', name: 'T1', width: 280, height: 44, layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'L1', width: 80, height: 18, text: 'Compose', fontSize: 14, fill: C.mutedForeground }] },
                { type: 'FRAME', name: 'T2', width: 280, height: 44, layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'L2', width: 80, height: 18, text: 'Templates', fontSize: 14, fill: C.mutedForeground }] },
                { type: 'FRAME', name: 'T3', width: 280, height: 44, fill: C.card, stroke: C.border, strokeWeight: 1,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'L3', width: 80, height: 18, text: 'Scheduled', fontSize: 14, fontWeight: 'Bold', fill: C.primary }] },
                { type: 'FRAME', name: 'T4', width: 280, height: 44, layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'L4', width: 80, height: 18, text: 'Discord', fontSize: 14, fill: C.mutedForeground }] },
              ],
            },
            // Log content
            {
              type: 'FRAME', name: 'LogContent', width: 1120, height: 640,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 12, padding: 24,
              children: [
                { type: 'TEXT', name: 'LogTitle', width: 1072, height: 24, text: 'Delivery History', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                // Sent message log entry
                {
                  type: 'FRAME', name: 'LogEntry1', width: 1072, height: 120,
                  fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 8, padding: 16,
                  children: [
                    {
                      type: 'FRAME', name: 'EntryHeader', width: 1040, height: 24,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'EntryTitle', width: 500, height: 20, text: 'Planning: Weekly Team Standup', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                        {
                          type: 'FRAME', name: 'SentBadge', width: 60, height: 24,
                          fill: '#14532d', cornerRadius: 9999, padding: { top: 4, right: 10, bottom: 4, left: 10 },
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'SentLabel', width: 40, height: 14, text: 'Sent', fontSize: 12, fontWeight: 'Medium', fill: '#4ade80' }],
                        },
                        { type: 'TEXT', name: 'SentTime', width: 200, height: 16, text: 'Mar 16, 2026 at 2:35 PM', fontSize: 12, fill: C.mutedForeground },
                      ],
                    },
                    // Delivery details
                    {
                      type: 'FRAME', name: 'DeliveryDetails', width: 1040, height: 48,
                      layoutMode: 'HORIZONTAL', itemSpacing: 16,
                      children: [
                        {
                          type: 'FRAME', name: 'ChDelivery1', width: 320, height: 44,
                          fill: C.background, cornerRadius: 6, padding: 10,
                          layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                          children: [
                            { type: 'ELLIPSE', name: 'OK1', width: 12, height: 12, fill: '#4ade80' },
                            { type: 'TEXT', name: 'CD1', width: 280, height: 16, text: '# general -> Delivered', fontSize: 12, fill: C.foreground },
                          ],
                        },
                        {
                          type: 'FRAME', name: 'ChDelivery2', width: 320, height: 44,
                          fill: C.background, cornerRadius: 6, padding: 10,
                          layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                          children: [
                            { type: 'ELLIPSE', name: 'OK2', width: 12, height: 12, fill: '#4ade80' },
                            { type: 'TEXT', name: 'CD2', width: 280, height: 16, text: '# announcements -> Delivered', fontSize: 12, fill: C.foreground },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj09_CalendarWithParticipants(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '09 - Calendar (5 Participants)',
    description: 'Next day: facilitator returns to see 5 people registered with availability heatmap',
    transitionLabel: 'suggests meetings',
    frame: {
      type: 'FRAME', name: 'FJ-CalFull', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'CalBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 12,
          padding: { top: 16, right: 60, bottom: 16, left: 60 },
          children: [
            // Title + actions
            {
              type: 'FRAME', name: 'HeaderRow', width: 1320, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'CalTitle', width: 400, height: 28, text: 'Coordination Calendar', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
                button('Suggest Meeting Times'),
              ],
            },
            // Info bar
            {
              type: 'FRAME', name: 'InfoBar', width: 1320, height: 36,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 16, padding: { top: 6, right: 16, bottom: 6, left: 16 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'EvName', width: 250, height: 16, text: 'Weekly Team Standup', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                { type: 'TEXT', name: 'TZ', width: 100, height: 14, text: 'UTC+2', fontSize: 11, fill: C.mutedForeground },
              ],
            },
            // Participants (5 people, visually distinct)
            {
              type: 'FRAME', name: 'ParticipantBar', width: 1320, height: 40,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: { top: 6, right: 12, bottom: 6, left: 12 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PLabel', width: 90, height: 16, text: 'Participants:', fontSize: 12, fill: C.mutedForeground },
                ...[ ['Tevo', '#6d28d9'], ['Alice', '#2563eb'], ['Bob', '#0891b2'], ['Charlie', '#059669'], ['Diana', '#d97706'] ].map(([name, color]) => ({
                  type: 'FRAME' as const, name: `Pill-${name}`, width: 70, height: 28,
                  fill: color as string, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                  primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    { type: 'TEXT' as const, name: `PN-${name}`, width: 50, height: 14, text: name as string, fontSize: 11, fontWeight: 'Medium' as const, fill: '#ffffff' },
                  ],
                })),
              ],
            },
            // Calendar grid with heatmap (green = more available)
            {
              type: 'FRAME', name: 'HeatGrid', width: 1320, height: 540,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children: [
                // Day headers
                {
                  type: 'FRAME', name: 'DayH', width: 1320, height: 48,
                  fill: C.card, stroke: C.border, strokeWeight: 1,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  children: [
                    { type: 'FRAME', name: 'TC', width: 60, height: 48, children: [] },
                    ...['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20'].map(d => ({
                      type: 'FRAME' as const, name: `D-${d}`, width: 252, height: 48,
                      stroke: C.border, strokeWeight: 1,
                      layoutMode: 'VERTICAL' as const, itemSpacing: 2,
                      primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'TEXT' as const, name: `DL-${d}`, width: 40, height: 14, text: d.split(' ')[0], fontSize: 12, fill: C.foreground },
                        { type: 'TEXT' as const, name: `DN-${d}`, width: 24, height: 22, text: d.split(' ')[1], fontSize: 18, fontWeight: 'Bold' as const, fill: C.foreground },
                      ],
                    })),
                  ],
                },
                // Grid with heatmap: varying green intensities showing availability overlap
                {
                  type: 'FRAME', name: 'GridRows', width: 1320, height: 490,
                  layoutMode: 'VERTICAL', itemSpacing: 0,
                  children: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'].map((time, rowIdx) => ({
                    type: 'FRAME' as const, name: `R-${time}`, width: 1320, height: 34,
                    layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                    children: [
                      { type: 'TEXT' as const, name: `T-${time}`, width: 60, height: 34, text: time, fontSize: 11, fill: C.mutedForeground },
                      ...Array.from({ length: 5 }, (_, colIdx) => {
                        // Simulate 2 groups: Group A (Mon-Wed 10-12) and Group B (Wed-Fri 14-16)
                        const groupA = colIdx <= 2 && rowIdx >= 2 && rowIdx <= 5
                        const groupB = colIdx >= 2 && rowIdx >= 8 && rowIdx <= 11
                        const overlap = colIdx === 2 && ((rowIdx >= 2 && rowIdx <= 5) || (rowIdx >= 8 && rowIdx <= 11))
                        let cellFill = C.background
                        if (overlap) cellFill = '#166534'     // 5/5 dark green
                        else if (groupA) cellFill = '#15803d' // 3/5 medium green
                        else if (groupB) cellFill = '#14532d' // 2/5 lighter green
                        return {
                          type: 'RECTANGLE' as const, name: `C-${time}-${colIdx}`, width: 252, height: 34,
                          fill: cellFill, stroke: C.border, strokeWeight: 0.5,
                        }
                      }),
                    ],
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj10_MeetingSuggestions(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '10 - Meeting Suggestions',
    description: 'Optimal meeting times panel shows 2 groups based on availability clusters',
    transitionLabel: 'prepares meeting',
    frame: {
      type: 'FRAME', name: 'FJ-Suggestions', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'SugBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 12,
          padding: { top: 16, right: 60, bottom: 16, left: 60 },
          children: [
            // Header
            {
              type: 'FRAME', name: 'HRow', width: 1320, height: 36,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'CT', width: 300, height: 28, text: 'Coordination Calendar', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
              ],
            },
            // Participants
            {
              type: 'FRAME', name: 'PBar', width: 1320, height: 36,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: { top: 4, right: 12, bottom: 4, left: 12 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PL', width: 90, height: 14, text: 'Participants:', fontSize: 12, fill: C.mutedForeground },
                ...[ 'Tevo', 'Alice', 'Bob', 'Charlie', 'Diana' ].map(name => ({
                  type: 'FRAME' as const, name: `P-${name}`, width: 56, height: 24,
                  fill: C.secondary, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                  primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                  children: [{ type: 'TEXT' as const, name: `N-${name}`, width: 36, height: 12, text: name, fontSize: 10, fill: C.foreground }],
                })),
              ],
            },
            // Suggestions panel (expanded inline)
            {
              type: 'FRAME', name: 'SuggestionPanel', width: 1320, height: 340,
              fill: C.card, stroke: '#16a34a', strokeWeight: 2, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 20,
              children: [
                {
                  type: 'FRAME', name: 'SugHeader', width: 1280, height: 28,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'SugIcon', width: 24, height: 24, fill: '#16a34a' },
                    { type: 'TEXT', name: 'SugTitle', width: 400, height: 24, text: 'Optimal Meeting Times', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                  ],
                },
                // Group 1
                {
                  type: 'FRAME', name: 'Group1', width: 1280, height: 120,
                  fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 16,
                  children: [
                    { type: 'TEXT', name: 'G1Title', width: 1248, height: 20, text: 'Group A  -  Mon-Wed, 10:00-12:00', fontSize: 15, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'G1Who', width: 1248, height: 16, text: 'Tevo, Alice, Bob (3/5 available)', fontSize: 13, fill: C.mutedForeground },
                    {
                      type: 'FRAME', name: 'G1Actions', width: 1248, height: 36,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12,
                      children: [
                        {
                          type: 'FRAME', name: 'ConfirmG1', width: 140, height: 36,
                          fill: '#16a34a', cornerRadius: 8,
                          layoutMode: 'HORIZONTAL', itemSpacing: 6,
                          primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'CL1', width: 100, height: 16, text: 'Confirm Time', fontSize: 13, fontWeight: 'Medium', fill: '#ffffff' }],
                        },
                        button('Dismiss', 'secondary'),
                      ],
                    },
                  ],
                },
                // Group 2
                {
                  type: 'FRAME', name: 'Group2', width: 1280, height: 120,
                  fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 16,
                  children: [
                    { type: 'TEXT', name: 'G2Title', width: 1248, height: 20, text: 'Group B  -  Wed-Fri, 14:00-16:00', fontSize: 15, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'G2Who', width: 1248, height: 16, text: 'Charlie, Diana, Tevo (3/5 available)', fontSize: 13, fill: C.mutedForeground },
                    {
                      type: 'FRAME', name: 'G2Actions', width: 1248, height: 36,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12,
                      children: [
                        {
                          type: 'FRAME', name: 'ConfirmG2', width: 140, height: 36,
                          fill: '#16a34a', cornerRadius: 8,
                          layoutMode: 'HORIZONTAL', itemSpacing: 6,
                          primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'CL2', width: 100, height: 16, text: 'Confirm Time', fontSize: 13, fontWeight: 'Medium', fill: '#ffffff' }],
                        },
                        button('Dismiss', 'secondary'),
                      ],
                    },
                  ],
                },
              ],
            },
            // Simplified calendar behind (smaller)
            {
              type: 'FRAME', name: 'MiniGrid', width: 1320, height: 240,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              children: [
                { type: 'TEXT', name: 'GridLabel', width: 200, height: 20, x: 20, y: 20, text: 'Calendar Grid (below)', fontSize: 13, fill: C.mutedForeground },
                { type: 'RECTANGLE', name: 'GridFade', width: 1320, height: 240, fill: '#0d0d14' },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj11_MeetingSidePanel(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '11 - Prepare Meeting (Left Panel)',
    description: 'Left sidebar open to prepare meeting details: time, link, recurrence',
    transitionLabel: 'opens AI assistant',
    frame: {
      type: 'FRAME', name: 'FJ-MeetingPanel', width: W, height: H, fill: C.background,
      layoutMode: 'HORIZONTAL', itemSpacing: 0,
      children: [
        // LEFT SIDE PANEL (w-80 = 320px)
        {
          type: 'FRAME', name: 'MeetingSidePanel', width: 320, height: H,
          fill: C.card, stroke: C.primary, strokeWeight: 2,
          layoutMode: 'VERTICAL', itemSpacing: 16, padding: 20,
          children: [
            // Panel header
            {
              type: 'FRAME', name: 'PanelHeader', width: 280, height: 36,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PanelTitle', width: 200, height: 24, text: 'Prepare Meeting', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                { type: 'RECTANGLE', name: 'CloseBtn', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
              ],
            },
            { type: 'RECTANGLE', name: 'Divider', width: 280, height: 1, fill: C.border },
            // Time summary card
            {
              type: 'FRAME', name: 'TimeSummary', width: 280, height: 80,
              fill: '#1e3a5f', stroke: '#2563eb', strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'VERTICAL', itemSpacing: 6, padding: 14,
              children: [
                { type: 'TEXT', name: 'TSTitle', width: 252, height: 18, text: 'Wednesday, Mar 18', fontSize: 14, fontWeight: 'Bold', fill: '#93c5fd' },
                { type: 'TEXT', name: 'TSTime', width: 252, height: 18, text: '10:00 - 12:00 (2h 0m)', fontSize: 13, fill: '#bfdbfe' },
                { type: 'TEXT', name: 'TSAvail', width: 252, height: 14, text: '3 of 5 participants available', fontSize: 12, fill: '#93c5fd' },
              ],
            },
            // Duration
            inputField('Duration (minutes)', 280),
            // Meeting Link
            {
              type: 'FRAME', name: 'LinkField', width: 280, height: 90,
              layoutMode: 'VERTICAL', itemSpacing: 6,
              children: [
                { type: 'TEXT', name: 'LinkLabel', width: 280, height: 18, text: 'Meeting Link', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                {
                  type: 'FRAME', name: 'LinkInput', width: 280, height: 36,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                  padding: { top: 8, right: 10, bottom: 8, left: 10 },
                  children: [
                    { type: 'TEXT', name: 'LinkVal', width: 260, height: 16, text: 'https://meet.google.com/abc-xyz', fontSize: 12, fill: C.foreground },
                  ],
                },
                {
                  type: 'FRAME', name: 'GenMeetBtn', width: 280, height: 32,
                  fill: '#1a1a2e', stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                  layoutMode: 'HORIZONTAL', itemSpacing: 6,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'GIcon', width: 14, height: 14, fill: '#4285f4' },
                    { type: 'TEXT', name: 'GLabel', width: 150, height: 14, text: 'Generate Google Meet', fontSize: 12, fill: C.foreground },
                  ],
                },
              ],
            },
            // Recurrence
            {
              type: 'FRAME', name: 'RecurrenceSection', width: 280, height: 100,
              layoutMode: 'VERTICAL', itemSpacing: 8,
              children: [
                { type: 'TEXT', name: 'RecLabel', width: 280, height: 18, text: 'Recurrence', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                {
                  type: 'FRAME', name: 'RecOptions', width: 280, height: 32,
                  layoutMode: 'HORIZONTAL', itemSpacing: 6,
                  children: [
                    ...['Weekly', 'Biweekly', 'Monthly'].map((opt, i) => ({
                      type: 'FRAME' as const, name: `Rec-${opt}`, width: 86, height: 32,
                      fill: i === 0 ? C.primary : C.muted, cornerRadius: 6,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                      primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                      children: [{ type: 'TEXT' as const, name: `RL-${opt}`, width: 66, height: 14, text: opt, fontSize: 12, fontWeight: i === 0 ? 'Medium' as const : 'Regular' as const, fill: i === 0 ? '#ffffff' : C.foreground }],
                    })),
                  ],
                },
                // Weekday checkboxes
                {
                  type: 'FRAME', name: 'Weekdays', width: 280, height: 32,
                  layoutMode: 'HORIZONTAL', itemSpacing: 4,
                  children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => ({
                    type: 'FRAME' as const, name: `WD-${i}`, width: 36, height: 32,
                    fill: i === 2 ? C.primary : C.muted, cornerRadius: 6,
                    layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                    primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                    children: [{ type: 'TEXT' as const, name: `WDL-${i}`, width: 12, height: 14, text: d, fontSize: 12, fill: i === 2 ? '#ffffff' : C.mutedForeground }],
                  })),
                },
              ],
            },
            // Confirm button
            {
              type: 'FRAME', name: 'ConfirmMeeting', width: 280, height: 44,
              fill: '#16a34a', cornerRadius: 10,
              layoutMode: 'HORIZONTAL', itemSpacing: 8,
              primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'ConfLabel', width: 140, height: 18, text: 'Confirm Meeting', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' },
              ],
            },
          ],
        },
        // MAIN CONTENT (faded calendar behind)
        {
          type: 'FRAME', name: 'MainContent', width: W - 320, height: H,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            navbar(),
            {
              type: 'FRAME', name: 'CalFade', width: W - 320, height: H - 64,
              fill: '#0a0a0f',
              children: [
                { type: 'TEXT', name: 'CalLabel', width: 300, height: 24, x: 40, y: 30, text: 'Coordination Calendar', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                { type: 'RECTANGLE', name: 'GridPlaceholder', width: W - 400, height: H - 200, x: 40, y: 80, fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8 },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj12_AiAssistant(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '12 - AI Assistant (Right Panel)',
    description: 'Right sidebar AI panel open to prepare distribution template for the meeting',
    transitionLabel: 'goes to Distribute',
    frame: {
      type: 'FRAME', name: 'FJ-AiPanel', width: W, height: H, fill: C.background,
      layoutMode: 'HORIZONTAL', itemSpacing: 0,
      children: [
        // MAIN CONTENT (calendar behind)
        {
          type: 'FRAME', name: 'MainContent', width: W - 384, height: H,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            navbar(),
            {
              type: 'FRAME', name: 'CalFade', width: W - 384, height: H - 64,
              fill: '#0a0a0f',
              children: [
                { type: 'TEXT', name: 'CalLabel', width: 300, height: 24, x: 40, y: 30, text: 'Coordination Calendar', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                { type: 'RECTANGLE', name: 'GridPlaceholder', width: W - 504, height: H - 200, x: 40, y: 80, fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8 },
              ],
            },
          ],
        },
        // RIGHT AI PANEL (w-96 = 384px)
        {
          type: 'FRAME', name: 'AiSidePanel', width: 384, height: H,
          fill: C.card, stroke: C.border, strokeWeight: 1,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            // AI header
            {
              type: 'FRAME', name: 'AiHeader', width: 384, height: 56,
              fill: '#1a0a2e', stroke: C.border, strokeWeight: 1,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              padding: { top: 12, right: 16, bottom: 12, left: 16 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'SparkleIcon', width: 28, height: 28, fill: '#7C3AED' },
                { type: 'TEXT', name: 'AiTitle', width: 200, height: 24, text: 'AI Calendar Assistant', fontSize: 16, fontWeight: 'Bold', fill: '#a78bfa' },
                { type: 'RECTANGLE', name: 'CloseBtn', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
              ],
            },
            // Chat messages
            {
              type: 'FRAME', name: 'ChatMessages', width: 384, height: H - 120,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 16,
              children: [
                // User message
                {
                  type: 'FRAME', name: 'UserMsg', width: 352, height: 60,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  primaryAxisAlignItems: 'MAX',
                  children: [
                    {
                      type: 'FRAME', name: 'UserBubble', width: 280, height: 60,
                      fill: C.primary, cornerRadius: 12,
                      padding: 12,
                      children: [
                        { type: 'TEXT', name: 'UserText', width: 256, height: 36, text: 'Prepare a distribution template for the confirmed meeting on Wed 10-12', fontSize: 13, fill: '#ffffff' },
                      ],
                    },
                  ],
                },
                // AI response
                {
                  type: 'FRAME', name: 'AiMsg', width: 352, height: 200,
                  fill: C.muted, cornerRadius: 12, padding: 12,
                  children: [
                    { type: 'TEXT', name: 'AiText', width: 328, height: 176, text: 'Here is a distribution template:\n\nTitle: Meeting Confirmed - Weekly Standup\n\nBody: Hi team! Our Weekly Team Standup is confirmed:\n\nDate: Wednesday, March 18\nTime: 10:00 - 12:00 (UTC+2)\nLink: meet.google.com/abc-xyz\n\nSee you there!\n\nWould you like me to adjust anything?', fontSize: 13, fill: C.foreground },
                  ],
                },
                // Suggestion chips
                {
                  type: 'FRAME', name: 'SugChips', width: 352, height: 36,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8,
                  children: [
                    {
                      type: 'FRAME', name: 'Chip1', width: 180, height: 32,
                      fill: C.muted, stroke: C.primary, strokeWeight: 1, cornerRadius: 9999,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0,
                      primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [{ type: 'TEXT', name: 'CL1', width: 160, height: 14, text: 'Open in Distribution', fontSize: 12, fill: C.primary }],
                    },
                    {
                      type: 'FRAME', name: 'Chip2', width: 120, height: 32,
                      fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 9999,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0,
                      primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [{ type: 'TEXT', name: 'CL2', width: 100, height: 14, text: 'Edit template', fontSize: 12, fill: C.foreground }],
                    },
                  ],
                },
              ],
            },
            // Input bar
            {
              type: 'FRAME', name: 'AiInputBar', width: 384, height: 60,
              stroke: C.border, strokeWeight: 1,
              layoutMode: 'HORIZONTAL', itemSpacing: 8,
              padding: { top: 10, right: 12, bottom: 10, left: 12 },
              counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'AiInput', width: 310, height: 40,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 20,
                  padding: { top: 10, right: 16, bottom: 10, left: 16 },
                  children: [
                    { type: 'TEXT', name: 'InputPlaceholder', width: 278, height: 16, text: 'Ask the AI assistant...', fontSize: 13, fill: C.placeholder },
                  ],
                },
                {
                  type: 'FRAME', name: 'SendBtn', width: 36, height: 36,
                  fill: C.primary, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'SendIcon', width: 16, height: 16, text: '>', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' }],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function fj13_DistributeConfirmed(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: '13 - Distribute Meeting',
    description: 'Facilitator sends the confirmed meeting announcement, end of journey',
    frame: {
      type: 'FRAME', name: 'FJ-DistFinal', width: W, height: H, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'FinalBody', width: W, height: H - 64,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 20, right: 160, bottom: 20, left: 160 },
          children: [
            // Header
            {
              type: 'FRAME', name: 'Header', width: 1120, height: 36, layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'Icon', width: 28, height: 28, fill: C.primary },
                { type: 'TEXT', name: 'Title', width: 300, height: 28, text: 'Distribute Announcements', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
              ],
            },
            // Compose content (prefilled from AI)
            {
              type: 'FRAME', name: 'ComposeArea', width: 1120, height: 680,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
              children: [
                // AI-prefilled indicator
                {
                  type: 'FRAME', name: 'AiFilled', width: 1072, height: 36,
                  fill: '#1a0a2e', stroke: '#6d28d9', strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: { top: 8, right: 12, bottom: 8, left: 12 },
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'AIIcon', width: 16, height: 16, fill: '#7C3AED' },
                    { type: 'TEXT', name: 'AILabel', width: 400, height: 16, text: 'Template generated by AI Assistant', fontSize: 12, fill: '#a78bfa' },
                  ],
                },
                // Title
                {
                  type: 'FRAME', name: 'TitleField', width: 1072, height: 68,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    { type: 'TEXT', name: 'TL', width: 1072, height: 20, text: 'Title', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'TInput', width: 1072, height: 40,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                      padding: { top: 10, right: 16, bottom: 10, left: 16 },
                      children: [
                        { type: 'TEXT', name: 'TV', width: 1040, height: 18, text: 'Meeting Confirmed - Weekly Team Standup', fontSize: 14, fill: C.foreground },
                      ],
                    },
                  ],
                },
                // Body (from AI)
                {
                  type: 'FRAME', name: 'BodyBox', width: 1072, height: 180,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: 12,
                  children: [
                    { type: 'TEXT', name: 'BV', width: 1048, height: 150, text: 'Hi team! Our Weekly Team Standup is confirmed:\n\nDate: Wednesday, March 18\nTime: 10:00 - 12:00 (UTC+2)\nLink: meet.google.com/abc-xyz\n\nAll 5 participants have been notified. See you there!', fontSize: 14, fill: C.foreground },
                  ],
                },
                // Channels (selected)
                {
                  type: 'FRAME', name: 'Channels', width: 1072, height: 120,
                  layoutMode: 'VERTICAL', itemSpacing: 8,
                  children: [
                    { type: 'TEXT', name: 'ChTitle', width: 1072, height: 20, text: 'Distribution Channels', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    ...['# general', '# announcements'].map((ch, i) => ({
                      type: 'FRAME' as const, name: `ChRow-${i}`, width: 1072, height: 36,
                      fill: C.muted, cornerRadius: 6,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 12, padding: { top: 8, right: 12, bottom: 8, left: 12 },
                      counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'RECTANGLE' as const, name: `CB-${i}`, width: 18, height: 18, fill: C.primary, stroke: C.border, strokeWeight: 1, cornerRadius: 4 },
                        { type: 'TEXT' as const, name: `CN-${i}`, width: 200, height: 16, text: `My DAO  ${ch}`, fontSize: 13, fill: C.foreground },
                      ],
                    })),
                  ],
                },
                // Send button
                {
                  type: 'FRAME', name: 'ActionBar', width: 1072, height: 56,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12,
                  primaryAxisAlignItems: 'MAX', counterAxisAlignItems: 'CENTER',
                  children: [
                    {
                      type: 'FRAME', name: 'SendBtn', width: 160, height: 44,
                      fill: '#16a34a', cornerRadius: 10,
                      layoutMode: 'HORIZONTAL', itemSpacing: 8,
                      primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'SendLabel', width: 100, height: 20, text: 'Send Now', fontSize: 16, fontWeight: 'Bold', fill: '#ffffff' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

// ─── Power User Journey ───────────────────────────────────────────────
// Full-feature wireframes with ALL expandable sections open.
// Each page shows maximum detail for power user reference.

const PW = 1440 // Standard width

function pu01_HomePage(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-01 Home Page (Full)',
    description: 'Landing page with all 6 feature cards, public calendars, events, distribution expanded',
    transitionLabel: 'opens Calendar',
    frame: {
      type: 'FRAME', name: 'PU-Home', width: PW, height: 1800, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        // Hero
        {
          type: 'FRAME', name: 'Hero', width: PW, height: 280,
          fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
          padding: { top: 48, right: 200, bottom: 32, left: 200 },
          children: [
            { type: 'TEXT', name: 'HeroTitle', width: 800, height: 44, text: 'How would you like to coordinate?', fontSize: 36, fontWeight: 'Bold', fill: C.foreground },
            { type: 'TEXT', name: 'HeroSub', width: 500, height: 20, text: 'Engage. Schedule. Synchronize.', fontSize: 16, fill: C.mutedForeground },
            {
              type: 'FRAME', name: 'HeroCTAs', width: 480, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 16, primaryAxisAlignItems: 'CENTER',
              children: [button('Join Conversations', 'secondary'), button('Coordinate the Next Meeting')],
            },
          ],
        },
        // 6 Feature Cards (3x2)
        {
          type: 'FRAME', name: 'ExploreSection', width: PW, height: 420,
          layoutMode: 'VERTICAL', itemSpacing: 12,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            { type: 'TEXT', name: 'ExploreTitle', width: 1280, height: 28, text: 'Explore', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
            {
              type: 'FRAME', name: 'Row1', width: 1280, height: 160,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                _featureCard('Agentic Tools', 'AI-powered agents for scheduling, feedback, and coordination automation', '#7c3aed'),
                _featureCard('Distribution', 'Send announcements via Discord channels and DMs with tracking', '#2563eb'),
                _featureCard('Availability', 'Visual heatmap showing participant time overlap', '#059669'),
              ],
            },
            {
              type: 'FRAME', name: 'Row2', width: 1280, height: 160,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                _featureCard('Public Events', 'Community event calendar with Google Calendar sync', '#d97706'),
                _featureCard('API Integration', 'RESTful API with agent keys for external tool access', '#0891b2'),
                _featureCard('Feedback', 'Structured feedback with sentiment analysis and admin workflows', '#dc2626'),
              ],
            },
          ],
        },
        // Distribution card EXPANDED (auth options visible)
        {
          type: 'FRAME', name: 'DistExpanded', width: PW, height: 120,
          padding: { top: 0, right: 80, bottom: 0, left: 80 },
          children: [
            {
              type: 'FRAME', name: 'AuthOptions', width: 1280, height: 100,
              fill: '#1a1a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'HORIZONTAL', itemSpacing: 24, padding: 20,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'AuthPrompt', width: 280, height: 20, text: 'Sign in to use Distribution:', fontSize: 14, fill: C.foreground },
                {
                  type: 'FRAME', name: 'GoogleAuth', width: 220, height: 44,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'GIcon', width: 20, height: 20, fill: '#4285f4' },
                    { type: 'TEXT', name: 'GL', width: 160, height: 16, text: 'Continue with Google', fontSize: 13, fill: C.foreground },
                  ],
                },
                {
                  type: 'FRAME', name: 'TravelerAuth', width: 200, height: 44,
                  fill: '#422006', stroke: '#92400e', strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'CIcon', width: 20, height: 20, fill: '#f59e0b' },
                    { type: 'TEXT', name: 'TL', width: 140, height: 16, text: 'Continue as Traveler', fontSize: 13, fill: '#fbbf24' },
                  ],
                },
              ],
            },
          ],
        },
        // Public Calendars Grid
        {
          type: 'FRAME', name: 'PublicCalendars', width: PW, height: 300,
          layoutMode: 'VERTICAL', itemSpacing: 12,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            { type: 'TEXT', name: 'CalTitle', width: 1280, height: 28, text: 'Public Coordination Calendars', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
            {
              type: 'FRAME', name: 'CalCards', width: 1280, height: 240,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                _calendarCard('Weekly Team Standup', '5 participants', 'Mon-Fri'),
                _calendarCard('DAO Governance', '12 participants', 'Tue, Thu'),
                _calendarCard('Community Call', '8 participants', 'Saturday'),
                _calendarCard('Sprint Planning', '6 participants', 'Biweekly Mon'),
              ],
            },
          ],
        },
        // Public Events Grid
        {
          type: 'FRAME', name: 'PublicEvents', width: PW, height: 300,
          layoutMode: 'VERTICAL', itemSpacing: 12,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            { type: 'TEXT', name: 'EvTitle', width: 1280, height: 28, text: 'Upcoming Public Events', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
            {
              type: 'FRAME', name: 'EvCards', width: 1280, height: 240,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                _eventCard('Cardano Summit', 'Mar 20, 14:00 UTC'),
                _eventCard('Ambassador Meeting', 'Mar 22, 10:00 UTC'),
                _eventCard('Hackathon Kickoff', 'Mar 25, 16:00 UTC'),
                _eventCard('Community AMA', 'Mar 28, 18:00 UTC'),
              ],
            },
          ],
        },
        // Design Principles
        {
          type: 'FRAME', name: 'Principles', width: PW, height: 200,
          layoutMode: 'VERTICAL', itemSpacing: 12,
          padding: { top: 24, right: 80, bottom: 24, left: 80 },
          children: [
            { type: 'TEXT', name: 'PrinciplesTitle', width: 1280, height: 28, text: 'Design Principles', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
            {
              type: 'FRAME', name: 'PrincipleCards', width: 1280, height: 120,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: ['Low Maintenance', 'Transparency', 'Self-Service', 'Interoperability'].map(p => ({
                type: 'FRAME' as const, name: `P-${p}`, width: 300, height: 120,
                fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                layoutMode: 'VERTICAL' as const, itemSpacing: 8, padding: 16,
                children: [
                  { type: 'TEXT' as const, name: `PT-${p}`, width: 268, height: 20, text: p, fontSize: 14, fontWeight: 'Bold' as const, fill: C.foreground },
                  { type: 'RECTANGLE' as const, name: `PC-${p}`, width: 268, height: 60, fill: C.muted, cornerRadius: 6 },
                ],
              })),
            },
          ],
        },
      ],
    },
  }
}

// Helper: feature card with description
function _featureCard(title: string, desc: string, accentColor: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Feature-${title}`, width: 416, height: 160,
    fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
    layoutMode: 'VERTICAL', itemSpacing: 8, padding: 20,
    children: [
      {
        type: 'FRAME', name: `FH-${title}`, width: 376, height: 28,
        layoutMode: 'HORIZONTAL', itemSpacing: 10, counterAxisAlignItems: 'CENTER',
        children: [
          { type: 'ELLIPSE', name: `FIcon-${title}`, width: 24, height: 24, fill: accentColor },
          { type: 'TEXT', name: `FT-${title}`, width: 340, height: 20, text: title, fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
        ],
      },
      { type: 'TEXT', name: `FD-${title}`, width: 376, height: 40, text: desc, fontSize: 13, fill: C.mutedForeground },
      {
        type: 'FRAME', name: `FBtn-${title}`, width: 100, height: 32,
        fill: accentColor, cornerRadius: 6,
        layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
        children: [{ type: 'TEXT', name: `FBL-${title}`, width: 60, height: 14, text: 'Explore', fontSize: 12, fontWeight: 'Medium', fill: '#ffffff' }],
      },
    ],
  }
}

function _calendarCard(title: string, participants: string, schedule: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Cal-${title}`, width: 304, height: 240,
    fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
    layoutMode: 'VERTICAL', itemSpacing: 8, padding: 16,
    children: [
      { type: 'RECTANGLE', name: `Heatmap-${title}`, width: 272, height: 100, fill: '#0d1a0d', cornerRadius: 8, stroke: C.border, strokeWeight: 1 },
      { type: 'TEXT', name: `CT-${title}`, width: 272, height: 20, text: title, fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
      { type: 'TEXT', name: `CP-${title}`, width: 272, height: 16, text: participants, fontSize: 12, fill: C.mutedForeground },
      { type: 'TEXT', name: `CS-${title}`, width: 272, height: 16, text: schedule, fontSize: 12, fill: '#4ade80' },
      button('View Calendar', 'secondary'),
    ],
  }
}

function _eventCard(title: string, time: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Ev-${title}`, width: 304, height: 240,
    fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
    layoutMode: 'VERTICAL', itemSpacing: 8, padding: 16,
    children: [
      { type: 'ELLIPSE', name: `EvIcon-${title}`, width: 40, height: 40, fill: C.primary },
      { type: 'TEXT', name: `ET-${title}`, width: 272, height: 20, text: title, fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
      { type: 'TEXT', name: `ETm-${title}`, width: 272, height: 16, text: time, fontSize: 12, fill: '#93c5fd' },
      { type: 'RECTANGLE', name: `EDesc-${title}`, width: 272, height: 60, fill: C.muted, cornerRadius: 6 },
      button('View Event', 'secondary'),
    ],
  }
}

function pu02_CalendarFull(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-02 Calendar (Full Admin)',
    description: 'Calendar page with heatmap, settings expanded, learner guide, action menu, all controls',
    transitionLabel: 'opens meeting panel',
    frame: {
      type: 'FRAME', name: 'PU-Calendar', width: PW, height: 1600, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'CalBody', width: PW, height: 1536, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 12,
          padding: { top: 16, right: 60, bottom: 16, left: 60 },
          children: [
            // Title row with all action buttons
            {
              type: 'FRAME', name: 'HeaderRow', width: 1320, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 10, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'CalTitle', width: 300, height: 28, text: 'Weekly Team Standup', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
                // Visibility badge
                {
                  type: 'FRAME', name: 'VisBadge', width: 80, height: 28,
                  fill: '#14532d', cornerRadius: 9999, padding: { top: 4, right: 12, bottom: 4, left: 12 },
                  layoutMode: 'HORIZONTAL', itemSpacing: 4, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'VisIcon', width: 8, height: 8, fill: '#4ade80' },
                    { type: 'TEXT', name: 'VisLabel', width: 48, height: 14, text: 'Public', fontSize: 11, fill: '#4ade80' },
                  ],
                },
                // View mode toggle
                {
                  type: 'FRAME', name: 'ViewToggle', width: 180, height: 32,
                  fill: C.muted, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  children: [
                    { type: 'FRAME', name: 'AdminMode', width: 90, height: 32, fill: C.primary, cornerRadius: 8,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [{ type: 'TEXT', name: 'AM', width: 50, height: 14, text: 'Admin', fontSize: 12, fontWeight: 'Medium', fill: '#ffffff' }] },
                    { type: 'FRAME', name: 'VisitorMode', width: 90, height: 32,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [{ type: 'TEXT', name: 'VM', width: 50, height: 14, text: 'Visitor', fontSize: 12, fill: C.mutedForeground }] },
                  ],
                },
                button('Edit Settings', 'secondary'),
                button('Distribution'),
                button('Invite for Planning'),
                button('Suggest Times'),
                { type: 'RECTANGLE', name: 'TrashBtn', width: 36, height: 36, fill: '#7f1d1d', cornerRadius: 8 },
              ],
            },
            // Learner Guide EXPANDED
            {
              type: 'FRAME', name: 'LearnerGuide', width: 1320, height: 90,
              fill: '#1e3a5f', stroke: '#2563eb', strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 6, padding: 16,
              children: [
                {
                  type: 'FRAME', name: 'GuideHeader', width: 1288, height: 20,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'HelpIcon', width: 16, height: 16, fill: '#3b82f6' },
                    { type: 'TEXT', name: 'GuideTitle', width: 200, height: 18, text: 'Prepare: Set up your calendar', fontSize: 14, fontWeight: 'Bold', fill: '#93c5fd' },
                    { type: 'TEXT', name: 'Collapse', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: '#60a5fa' },
                  ],
                },
                { type: 'TEXT', name: 'GuideBody', width: 1288, height: 40, text: '1. Name your event above  2. Set your preferred time range  3. Mark your own availability on the grid  4. Share the invite link with participants  5. Review heatmap when everyone has responded', fontSize: 12, fill: '#bfdbfe' },
              ],
            },
            // Info bar
            {
              type: 'FRAME', name: 'InfoBar', width: 1320, height: 40,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: { top: 8, right: 16, bottom: 8, left: 16 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'TZ', width: 120, height: 16, text: 'UTC+2 (Europe)', fontSize: 12, fill: C.mutedForeground },
                { type: 'TEXT', name: 'Interval', width: 80, height: 16, text: '30 min slots', fontSize: 12, fill: C.mutedForeground },
                { type: 'TEXT', name: 'DateRange', width: 200, height: 16, text: 'Mar 16 - Mar 22, 2026', fontSize: 12, fill: C.mutedForeground },
                // Copy link
                {
                  type: 'FRAME', name: 'CopyLink', width: 180, height: 28,
                  fill: '#1a1a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 6,
                  layoutMode: 'HORIZONTAL', itemSpacing: 6, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'CL', width: 120, height: 14, text: 'Copy Invite Link', fontSize: 12, fill: '#a78bfa' }],
                },
              ],
            },
            // Participants (5 people with colored pills)
            {
              type: 'FRAME', name: 'ParticipantBar', width: 1320, height: 40,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: { top: 6, right: 12, bottom: 6, left: 12 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PLabel', width: 90, height: 16, text: 'Participants:', fontSize: 12, fill: C.mutedForeground },
                ...[['Tevo', '#6d28d9'], ['Alice', '#2563eb'], ['Bob', '#0891b2'], ['Charlie', '#059669'], ['Diana', '#d97706']].map(([n, c]) => ({
                  type: 'FRAME' as const, name: `Pill-${n}`, width: 70, height: 28,
                  fill: c as string, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                  children: [{ type: 'TEXT' as const, name: `PN-${n}`, width: 50, height: 14, text: n as string, fontSize: 11, fontWeight: 'Medium' as const, fill: '#ffffff' }],
                })),
                { type: 'TEXT', name: 'Count', width: 80, height: 14, text: '5 registered', fontSize: 11, fill: C.mutedForeground },
              ],
            },
            // Calendar grid with heatmap
            {
              type: 'FRAME', name: 'CalGrid', width: 1320, height: 600,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children: [
                // Week navigation + day headers
                {
                  type: 'FRAME', name: 'WeekNav', width: 1320, height: 52,
                  fill: C.card, stroke: C.border, strokeWeight: 1,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  children: [
                    { type: 'FRAME', name: 'TimeCol', width: 60, height: 52,
                      layoutMode: 'HORIZONTAL', itemSpacing: 4, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'RECTANGLE', name: 'PrevWeek', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
                        { type: 'RECTANGLE', name: 'NextWeek', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
                      ],
                    },
                    ...['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20', 'Sat 21', 'Sun 22'].map(d => ({
                      type: 'FRAME' as const, name: `D-${d}`, width: 180, height: 52,
                      stroke: C.border, strokeWeight: 1,
                      layoutMode: 'VERTICAL' as const, itemSpacing: 2,
                      primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'TEXT' as const, name: `DL-${d}`, width: 40, height: 14, text: d.split(' ')[0], fontSize: 12, fill: C.foreground },
                        { type: 'TEXT' as const, name: `DN-${d}`, width: 24, height: 22, text: d.split(' ')[1], fontSize: 16, fontWeight: 'Bold' as const, fill: C.foreground },
                      ],
                    })),
                  ],
                },
                // Grid body with heatmap
                {
                  type: 'FRAME', name: 'GridBody', width: 1320, height: 546,
                  layoutMode: 'VERTICAL', itemSpacing: 0,
                  children: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'].map((time, rowIdx) => ({
                    type: 'FRAME' as const, name: `R-${time}`, width: 1320, height: 30,
                    layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                    children: [
                      { type: 'TEXT' as const, name: `T-${time}`, width: 60, height: 30, text: time, fontSize: 10, fill: C.mutedForeground },
                      ...Array.from({ length: 7 }, (_, colIdx) => {
                        const skip = colIdx >= 5
                        const groupA = !skip && colIdx <= 2 && rowIdx >= 2 && rowIdx <= 7
                        const groupB = !skip && colIdx >= 2 && colIdx <= 4 && rowIdx >= 10 && rowIdx <= 15
                        const overlap = colIdx === 2 && ((rowIdx >= 2 && rowIdx <= 7) || (rowIdx >= 10 && rowIdx <= 15))
                        let fill = skip ? '#0d0d12' : C.background
                        if (overlap) fill = '#166534'
                        else if (groupA) fill = '#15803d'
                        else if (groupB) fill = '#14532d'
                        return {
                          type: 'RECTANGLE' as const, name: `C-${time}-${colIdx}`, width: 180, height: 30,
                          fill, stroke: C.border, strokeWeight: 0.5,
                        }
                      }),
                    ],
                  })),
                },
              ],
            },
            // Confirmed meetings section
            {
              type: 'FRAME', name: 'ConfirmedMeetings', width: 1320, height: 120,
              layoutMode: 'VERTICAL', itemSpacing: 8,
              children: [
                { type: 'TEXT', name: 'CMTitle', width: 1320, height: 24, text: 'Confirmed Meetings (2)', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                {
                  type: 'FRAME', name: 'MeetingCards', width: 1320, height: 80,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12,
                  children: [
                    _meetingCard('Group A - Wed 10:00-12:00', 'Weekly', '#16a34a'),
                    _meetingCard('Group B - Thu 14:00-16:00', 'Biweekly', '#2563eb'),
                  ],
                },
              ],
            },
            // Settings section EXPANDED
            {
              type: 'FRAME', name: 'SettingsExpanded', width: 1320, height: 200,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 12, padding: 20,
              children: [
                {
                  type: 'FRAME', name: 'SettingsHeader', width: 1280, height: 28,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'SetTitle', width: 200, height: 20, text: 'Calendar Settings', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'SetCollapse', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                  ],
                },
                {
                  type: 'FRAME', name: 'SettingsGrid', width: 1280, height: 120,
                  layoutMode: 'HORIZONTAL', itemSpacing: 24,
                  children: [
                    // Time range
                    {
                      type: 'FRAME', name: 'TimeRange', width: 300, height: 120,
                      layoutMode: 'VERTICAL', itemSpacing: 8,
                      children: [
                        { type: 'TEXT', name: 'TRLabel', width: 300, height: 18, text: 'Time Range', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                        { type: 'RECTANGLE', name: 'StartHour', width: 300, height: 36, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6 },
                        { type: 'RECTANGLE', name: 'EndHour', width: 300, height: 36, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6 },
                      ],
                    },
                    // Time interval
                    {
                      type: 'FRAME', name: 'TimeInterval', width: 200, height: 120,
                      layoutMode: 'VERTICAL', itemSpacing: 8,
                      children: [
                        { type: 'TEXT', name: 'TILabel', width: 200, height: 18, text: 'Time Interval', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                        {
                          type: 'FRAME', name: 'IntervalOpts', width: 200, height: 32,
                          layoutMode: 'HORIZONTAL', itemSpacing: 4,
                          children: ['15m', '30m', '60m'].map((v, i) => ({
                            type: 'FRAME' as const, name: `Int-${v}`, width: 60, height: 32,
                            fill: i === 1 ? C.primary : C.muted, cornerRadius: 6,
                            layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                            children: [{ type: 'TEXT' as const, name: `IL-${v}`, width: 30, height: 14, text: v, fontSize: 12, fill: i === 1 ? '#ffffff' : C.foreground }],
                          })),
                        },
                      ],
                    },
                    // Skip days
                    {
                      type: 'FRAME', name: 'SkipDays', width: 300, height: 120,
                      layoutMode: 'VERTICAL', itemSpacing: 8,
                      children: [
                        { type: 'TEXT', name: 'SDLabel', width: 300, height: 18, text: 'Skip Days', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                        {
                          type: 'FRAME', name: 'DayToggles', width: 300, height: 32,
                          layoutMode: 'HORIZONTAL', itemSpacing: 4,
                          children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => ({
                            type: 'FRAME' as const, name: `DT-${i}`, width: 36, height: 32,
                            fill: i >= 5 ? '#7f1d1d' : C.muted, cornerRadius: 6,
                            stroke: i >= 5 ? '#dc2626' : C.border, strokeWeight: 1,
                            layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                            children: [{ type: 'TEXT' as const, name: `DTL-${i}`, width: 12, height: 14, text: d, fontSize: 12, fill: i >= 5 ? '#fca5a5' : C.foreground }],
                          })),
                        },
                        { type: 'TEXT', name: 'SkipInfo', width: 300, height: 14, text: 'Sat, Sun are skipped (grayed out on grid)', fontSize: 11, fill: C.mutedForeground },
                      ],
                    },
                    // Custom dates
                    {
                      type: 'FRAME', name: 'CustomDates', width: 300, height: 120,
                      layoutMode: 'VERTICAL', itemSpacing: 8,
                      children: [
                        { type: 'TEXT', name: 'CDLabel', width: 300, height: 18, text: 'Custom Date Range', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                        { type: 'RECTANGLE', name: 'StartDate', width: 300, height: 36, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6 },
                        { type: 'RECTANGLE', name: 'EndDate', width: 300, height: 36, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _meetingCard(title: string, recurrence: string, color: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Meeting-${title}`, width: 400, height: 72,
    fill: C.card, stroke: color, strokeWeight: 2, cornerRadius: 10,
    layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 14,
    counterAxisAlignItems: 'CENTER',
    children: [
      { type: 'RECTANGLE', name: `MBar-${title}`, width: 4, height: 44, fill: color, cornerRadius: 2 },
      {
        type: 'FRAME', name: `MInfo-${title}`, width: 340, height: 44,
        layoutMode: 'VERTICAL', itemSpacing: 4,
        children: [
          { type: 'TEXT', name: `MT-${title}`, width: 340, height: 18, text: title, fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
          { type: 'TEXT', name: `MR-${title}`, width: 340, height: 14, text: `Recurrence: ${recurrence}`, fontSize: 11, fill: C.mutedForeground },
        ],
      },
    ],
  }
}

function pu03_CalendarMeetingPanel(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-03 Meeting Side Panel',
    description: 'Left panel open with all meeting config: duration, Google Meet, Zoom, Luma, recurrence expanded',
    transitionLabel: 'opens AI panel',
    frame: {
      type: 'FRAME', name: 'PU-MeetingPanel', width: PW, height: 1100, fill: C.background,
      layoutMode: 'HORIZONTAL', itemSpacing: 0,
      children: [
        // LEFT MEETING PANEL (320px)
        {
          type: 'FRAME', name: 'MeetingSidePanel', width: 340, height: 1100,
          fill: C.card, stroke: C.primary, strokeWeight: 2,
          layoutMode: 'VERTICAL', itemSpacing: 14, padding: 20,
          children: [
            // Header
            {
              type: 'FRAME', name: 'PanelHeader', width: 300, height: 32,
              layoutMode: 'HORIZONTAL', itemSpacing: 8,
              primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PTitle', width: 200, height: 24, text: 'Prepare Meeting', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                { type: 'RECTANGLE', name: 'CloseBtn', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
              ],
            },
            { type: 'RECTANGLE', name: 'Div1', width: 300, height: 1, fill: C.border },
            // Time summary
            {
              type: 'FRAME', name: 'TimeSummary', width: 300, height: 72,
              fill: '#1e3a5f', stroke: '#2563eb', strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'VERTICAL', itemSpacing: 4, padding: 12,
              children: [
                { type: 'TEXT', name: 'TSDate', width: 276, height: 18, text: 'Wednesday, Mar 18, 2026', fontSize: 14, fontWeight: 'Bold', fill: '#93c5fd' },
                { type: 'TEXT', name: 'TSTime', width: 276, height: 16, text: '10:00 - 12:00 (2h 0m)', fontSize: 13, fill: '#bfdbfe' },
                { type: 'TEXT', name: 'TSAvail', width: 276, height: 14, text: '3 of 5 participants available', fontSize: 12, fill: '#93c5fd' },
              ],
            },
            // Duration spinner
            {
              type: 'FRAME', name: 'DurationField', width: 300, height: 64,
              layoutMode: 'VERTICAL', itemSpacing: 6,
              children: [
                { type: 'TEXT', name: 'DurLabel', width: 300, height: 18, text: 'Duration (minutes)', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                {
                  type: 'FRAME', name: 'DurSpinner', width: 300, height: 36,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0,
                  children: [
                    { type: 'FRAME', name: 'DurMinus', width: 36, height: 36, fill: C.muted, cornerRadius: 6,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [{ type: 'TEXT', name: 'DM', width: 12, height: 14, text: '-', fontSize: 16, fontWeight: 'Bold', fill: C.foreground }] },
                    {
                      type: 'FRAME', name: 'DurValue', width: 228, height: 36,
                      fill: C.background, stroke: C.border, strokeWeight: 1,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [{ type: 'TEXT', name: 'DV', width: 40, height: 16, text: '120', fontSize: 14, fontWeight: 'Medium', fill: C.foreground }],
                    },
                    { type: 'FRAME', name: 'DurPlus', width: 36, height: 36, fill: C.muted, cornerRadius: 6,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [{ type: 'TEXT', name: 'DP', width: 12, height: 14, text: '+', fontSize: 16, fontWeight: 'Bold', fill: C.foreground }] },
                  ],
                },
              ],
            },
            // Meeting Link + generators
            {
              type: 'FRAME', name: 'LinkSection', width: 300, height: 140,
              layoutMode: 'VERTICAL', itemSpacing: 8,
              children: [
                { type: 'TEXT', name: 'LinkLabel', width: 300, height: 18, text: 'Meeting Link', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                {
                  type: 'FRAME', name: 'LinkInput', width: 300, height: 36,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                  padding: { top: 8, right: 10, bottom: 8, left: 10 },
                  children: [{ type: 'TEXT', name: 'LinkVal', width: 280, height: 16, text: 'https://meet.google.com/abc-xyz', fontSize: 12, fill: C.foreground }],
                },
                {
                  type: 'FRAME', name: 'GenBtns', width: 300, height: 68,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    _linkGenButton('Generate Google Meet', '#4285f4'),
                    _linkGenButton('Generate Zoom Meeting', '#2d8cff'),
                  ],
                },
              ],
            },
            // Description
            {
              type: 'FRAME', name: 'DescField', width: 300, height: 90,
              layoutMode: 'VERTICAL', itemSpacing: 6,
              children: [
                { type: 'TEXT', name: 'DescLabel', width: 300, height: 18, text: 'Description', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                { type: 'RECTANGLE', name: 'DescBox', width: 300, height: 64, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8 },
              ],
            },
            // Recurrence EXPANDED
            {
              type: 'FRAME', name: 'RecurrenceExpanded', width: 300, height: 200,
              fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'VERTICAL', itemSpacing: 8, padding: 12,
              children: [
                { type: 'TEXT', name: 'RecTitle', width: 276, height: 18, text: 'Recurrence', fontSize: 13, fontWeight: 'Bold', fill: C.foreground },
                // Type selector
                {
                  type: 'FRAME', name: 'RecTypes', width: 276, height: 28,
                  layoutMode: 'HORIZONTAL', itemSpacing: 4,
                  children: ['None', 'Weekly', 'Biweekly', 'Monthly', 'Custom'].map((t, i) => ({
                    type: 'FRAME' as const, name: `RT-${t}`, width: 52, height: 28,
                    fill: i === 1 ? C.primary : C.background, cornerRadius: 6,
                    layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                    children: [{ type: 'TEXT' as const, name: `RTL-${t}`, width: 44, height: 12, text: t, fontSize: 10, fill: i === 1 ? '#ffffff' : C.mutedForeground }],
                  })),
                },
                // Day picks
                {
                  type: 'FRAME', name: 'WeekdayPick', width: 276, height: 32,
                  layoutMode: 'HORIZONTAL', itemSpacing: 4,
                  children: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
                    type: 'FRAME' as const, name: `WP-${d}`, width: 36, height: 32,
                    fill: i === 2 ? C.primary : C.background, cornerRadius: 6, stroke: C.border, strokeWeight: 1,
                    layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                    children: [{ type: 'TEXT' as const, name: `WPL-${d}`, width: 24, height: 12, text: d.slice(0, 2), fontSize: 10, fill: i === 2 ? '#ffffff' : C.foreground }],
                  })),
                },
                // End condition
                {
                  type: 'FRAME', name: 'EndCond', width: 276, height: 80,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    { type: 'TEXT', name: 'EndLabel', width: 276, height: 14, text: 'Ends', fontSize: 12, fontWeight: 'Medium', fill: C.foreground },
                    ...['Never', 'On date: Apr 30, 2026', 'After 12 occurrences'].map((opt, i) => ({
                      type: 'FRAME' as const, name: `End-${i}`, width: 276, height: 18,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 8, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'ELLIPSE' as const, name: `ER-${i}`, width: 14, height: 14, fill: i === 0 ? C.primary : C.background, stroke: C.border, strokeWeight: 1 },
                        { type: 'TEXT' as const, name: `ERL-${i}`, width: 250, height: 14, text: opt, fontSize: 11, fill: C.foreground },
                      ],
                    })),
                  ],
                },
              ],
            },
            // Luma integration EXPANDED
            {
              type: 'FRAME', name: 'LumaSection', width: 300, height: 80,
              fill: '#1a1a2e', stroke: '#d946ef', strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'VERTICAL', itemSpacing: 8, padding: 12,
              children: [
                { type: 'TEXT', name: 'LumaTitle', width: 276, height: 18, text: 'Publish to Luma', fontSize: 13, fontWeight: 'Bold', fill: '#f0abfc' },
                {
                  type: 'FRAME', name: 'LumaRow', width: 276, height: 32,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                  children: [
                    button('Publish'),
                    { type: 'TEXT', name: 'LumaVis', width: 120, height: 14, text: 'Visibility: Public', fontSize: 11, fill: '#d946ef' },
                  ],
                },
              ],
            },
            // Save / Cancel
            {
              type: 'FRAME', name: 'Actions', width: 300, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 12,
              children: [
                {
                  type: 'FRAME', name: 'SaveBtn', width: 180, height: 44,
                  fill: '#16a34a', cornerRadius: 10,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'SaveL', width: 120, height: 18, text: 'Confirm Meeting', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' }],
                },
                button('Cancel', 'secondary'),
              ],
            },
          ],
        },
        // MAIN CALENDAR (faded)
        {
          type: 'FRAME', name: 'MainArea', width: PW - 340, height: 1100,
          fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            navbar(),
            {
              type: 'FRAME', name: 'CalBg', width: PW - 340, height: 1036,
              padding: { top: 20, right: 40, bottom: 20, left: 40 },
              children: [
                { type: 'TEXT', name: 'CT', width: 300, height: 24, x: 0, y: 0, text: 'Coordination Calendar', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                { type: 'RECTANGLE', name: 'GridBg', width: PW - 460, height: 900, x: 0, y: 40, fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8 },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _linkGenButton(label: string, iconColor: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Gen-${label}`, width: 300, height: 32,
    fill: '#1a1a2e', stroke: C.border, strokeWeight: 1, cornerRadius: 6,
    layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
    children: [
      { type: 'ELLIPSE', name: `GI-${label}`, width: 14, height: 14, fill: iconColor },
      { type: 'TEXT', name: `GL-${label}`, width: 200, height: 14, text: label, fontSize: 12, fill: C.foreground },
    ],
  }
}

function pu04_CalendarAiPanel(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-04 AI Calendar Panel',
    description: 'Right AI panel with chat, suggestion chips, sentiment grid expanded, system prompt visible',
    transitionLabel: 'opens Announcements',
    frame: {
      type: 'FRAME', name: 'PU-AiPanel', width: PW, height: 1100, fill: C.background,
      layoutMode: 'HORIZONTAL', itemSpacing: 0,
      children: [
        // MAIN CALENDAR
        {
          type: 'FRAME', name: 'MainArea', width: PW - 400, height: 1100, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            navbar(),
            {
              type: 'FRAME', name: 'CalBg', width: PW - 400, height: 1036,
              padding: { top: 20, right: 40, bottom: 20, left: 40 },
              children: [
                { type: 'TEXT', name: 'CT', width: 300, height: 24, x: 0, y: 0, text: 'Coordination Calendar', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                { type: 'RECTANGLE', name: 'GridBg', width: PW - 520, height: 900, x: 0, y: 40, fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8 },
              ],
            },
          ],
        },
        // RIGHT AI PANEL (400px)
        {
          type: 'FRAME', name: 'AiPanel', width: 400, height: 1100,
          fill: C.card, stroke: C.border, strokeWeight: 1,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            // AI header
            {
              type: 'FRAME', name: 'AiHeader', width: 400, height: 52,
              fill: '#1a0a2e', stroke: C.border, strokeWeight: 1,
              layoutMode: 'HORIZONTAL', itemSpacing: 10, padding: { top: 12, right: 14, bottom: 12, left: 14 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'Sparkle', width: 24, height: 24, fill: '#7C3AED' },
                { type: 'TEXT', name: 'AiTitle', width: 220, height: 22, text: 'AI Calendar Assistant', fontSize: 15, fontWeight: 'Bold', fill: '#a78bfa' },
                { type: 'RECTANGLE', name: 'ClearBtn', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
                { type: 'RECTANGLE', name: 'CloseBtn', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
              ],
            },
            // Messages area
            {
              type: 'FRAME', name: 'Messages', width: 400, height: 880,
              layoutMode: 'VERTICAL', itemSpacing: 14, padding: 14,
              children: [
                // Suggestions
                {
                  type: 'FRAME', name: 'SugSection', width: 372, height: 120,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    { type: 'TEXT', name: 'TrySaying', width: 372, height: 16, text: 'Try saying:', fontSize: 12, fill: C.mutedForeground },
                    ...['Mark me available except where I am busy', 'Only mark mornings (9 AM - 12 PM)', 'Remove weekends from my availability', 'Set hours to business hours'].map(s => ({
                      type: 'FRAME' as const, name: `Sug-${s.slice(0,20)}`, width: 372, height: 28,
                      fill: C.muted, stroke: C.primary, strokeWeight: 1, cornerRadius: 9999,
                      padding: { top: 6, right: 12, bottom: 6, left: 12 },
                      children: [{ type: 'TEXT' as const, name: `SL-${s.slice(0,10)}`, width: 348, height: 14, text: s, fontSize: 11, fill: C.primary }],
                    })),
                  ],
                },
                // User message
                {
                  type: 'FRAME', name: 'UserMsg1', width: 372, height: 50,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'MAX',
                  children: [{
                    type: 'FRAME', name: 'UserBubble1', width: 280, height: 50,
                    fill: C.primary, cornerRadius: 12, padding: 10,
                    children: [{ type: 'TEXT', name: 'UT1', width: 260, height: 30, text: 'Set hours to business hours and skip weekends', fontSize: 13, fill: '#ffffff' }],
                  }],
                },
                // AI response
                {
                  type: 'FRAME', name: 'AiMsg1', width: 372, height: 80,
                  fill: C.muted, cornerRadius: 12, padding: 10,
                  children: [{ type: 'TEXT', name: 'AT1', width: 352, height: 60, text: 'Done! I have set the time range to 9:00 AM - 5:00 PM and skipped Saturday and Sunday. The calendar grid has been updated.', fontSize: 13, fill: C.foreground }],
                },
                // Sentiment feedback EXPANDED for AI message
                {
                  type: 'FRAME', name: 'SentimentExpanded', width: 372, height: 220,
                  fill: '#1a0a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 10,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 12,
                  children: [
                    { type: 'TEXT', name: 'SentTitle', width: 348, height: 16, text: 'Rate this response (Oversight)', fontSize: 12, fontWeight: 'Medium', fill: '#a78bfa' },
                    // Sentiment grid (5x5 placeholder)
                    {
                      type: 'FRAME', name: 'SentGrid', width: 200, height: 120,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                      layoutMode: 'VERTICAL', itemSpacing: 0,
                      children: [
                        { type: 'TEXT', name: 'YAxis', width: 200, height: 14, text: 'Good', fontSize: 10, fill: '#4ade80' },
                        {
                          type: 'FRAME', name: 'GridArea', width: 200, height: 80,
                          layoutMode: 'VERTICAL', itemSpacing: 0,
                          children: Array.from({ length: 5 }, (_, r) => ({
                            type: 'FRAME' as const, name: `SR-${r}`, width: 200, height: 16,
                            layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                            children: Array.from({ length: 5 }, (_, c) => {
                              const isSelected = r === 1 && c === 3
                              return {
                                type: 'RECTANGLE' as const, name: `SC-${r}-${c}`, width: 40, height: 16,
                                fill: isSelected ? '#16a34a' : (r < 2 && c > 2) ? '#14532d' : C.muted,
                                stroke: C.border, strokeWeight: 0.5,
                              }
                            }),
                          })),
                        },
                        {
                          type: 'FRAME', name: 'XLabels', width: 200, height: 14,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'SPACE_BETWEEN',
                          children: [
                            { type: 'TEXT', name: 'XL', width: 60, height: 12, text: 'Untrust', fontSize: 9, fill: '#fca5a5' },
                            { type: 'TEXT', name: 'XR', width: 60, height: 12, text: 'Trust', fontSize: 9, fill: '#4ade80' },
                          ],
                        },
                      ],
                    },
                    { type: 'TEXT', name: 'SentResult', width: 348, height: 14, text: 'Current: Good + Trust', fontSize: 11, fill: '#4ade80' },
                    { type: 'RECTANGLE', name: 'FeedbackInput', width: 348, height: 32, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6 },
                  ],
                },
                // System prompt EXPANDED
                {
                  type: 'FRAME', name: 'SystemPrompt', width: 372, height: 100,
                  fill: '#1a1a0e', stroke: '#92400e', strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 6, padding: 10,
                  children: [
                    { type: 'TEXT', name: 'SPTitle', width: 352, height: 14, text: 'System Prompt (Oversight)', fontSize: 11, fontWeight: 'Medium', fill: '#fbbf24' },
                    { type: 'TEXT', name: 'SPBody', width: 352, height: 60, text: 'You are an AI calendar assistant. Help the user configure their coordination calendar. Available actions: setTimeRange, skipDays, setInterval, renameEvent...', fontSize: 10, fill: '#fde68a' },
                  ],
                },
                // Second user message
                {
                  type: 'FRAME', name: 'UserMsg2', width: 372, height: 40,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'MAX',
                  children: [{
                    type: 'FRAME', name: 'UserBubble2', width: 260, height: 40,
                    fill: C.primary, cornerRadius: 12, padding: 10,
                    children: [{ type: 'TEXT', name: 'UT2', width: 240, height: 18, text: 'Call it Weekly Standup and make it public', fontSize: 13, fill: '#ffffff' }],
                  }],
                },
                // Second AI response
                {
                  type: 'FRAME', name: 'AiMsg2', width: 372, height: 60,
                  fill: C.muted, cornerRadius: 12, padding: 10,
                  children: [{ type: 'TEXT', name: 'AT2', width: 352, height: 40, text: 'Updated! Calendar renamed to "Weekly Standup" and visibility set to public. Anyone with the link can now join.', fontSize: 13, fill: C.foreground }],
                },
              ],
            },
            // Input bar
            {
              type: 'FRAME', name: 'InputBar', width: 400, height: 56,
              stroke: C.border, strokeWeight: 1,
              layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: { top: 8, right: 12, bottom: 8, left: 12 },
              counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'Input', width: 330, height: 40,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 20,
                  padding: { top: 10, right: 16, bottom: 10, left: 16 },
                  children: [{ type: 'TEXT', name: 'Placeholder', width: 298, height: 16, text: 'Ask the AI assistant...', fontSize: 13, fill: C.placeholder }],
                },
                {
                  type: 'FRAME', name: 'SendBtn', width: 36, height: 36, fill: C.primary, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'SendIcon', width: 14, height: 14, text: '>', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' }],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function pu05_AnnouncementsCompose(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-05 Announcements Compose',
    description: 'Full compose form with AI context, channels table, poll expanded, schedule, preview',
    transitionLabel: 'templates/scheduled',
    frame: {
      type: 'FRAME', name: 'PU-AnnCompose', width: PW, height: 1600, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1536, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 14,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            // Header
            {
              type: 'FRAME', name: 'Header', width: 1280, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PageTitle', width: 300, height: 28, text: 'Create Announcement', fontSize: 22, fontWeight: 'Bold', fill: C.foreground },
              ],
            },
            // Tabs (Compose active, Templates, Scheduled, Discord)
            {
              type: 'FRAME', name: 'Tabs', width: 1280, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              children: ['Compose', 'Templates', 'Scheduled', 'Discord'].map((t, i) => ({
                type: 'FRAME' as const, name: `Tab-${t}`, width: 160, height: 40,
                stroke: i === 0 ? C.primary : C.border, strokeWeight: i === 0 ? 2 : 1,
                layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                children: [{ type: 'TEXT' as const, name: `TL-${t}`, width: 120, height: 16, text: t, fontSize: 13, fontWeight: i === 0 ? 'Bold' as const : 'Regular' as const, fill: i === 0 ? C.primary : C.mutedForeground }],
              })),
            },
            // AI Context summary
            {
              type: 'FRAME', name: 'AiContext', width: 1280, height: 60,
              fill: '#1a0a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'VERTICAL', itemSpacing: 4, padding: 12,
              children: [
                { type: 'TEXT', name: 'AiContextTitle', width: 1256, height: 16, text: 'AI Context', fontSize: 12, fontWeight: 'Bold', fill: '#a78bfa' },
                { type: 'TEXT', name: 'AiContextBody', width: 1256, height: 24, text: 'Calendar: "Weekly Team Standup" with 5 participants. 2 confirmed meetings. Recurrence: weekly on Wednesday.', fontSize: 12, fill: '#c4b5fd' },
              ],
            },
            // Title + Body
            inputField('Announcement Title', 1280),
            {
              type: 'FRAME', name: 'BodyField', width: 1280, height: 140,
              layoutMode: 'VERTICAL', itemSpacing: 6,
              children: [
                { type: 'TEXT', name: 'BodyLabel', width: 1280, height: 18, text: 'Message Body', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                { type: 'RECTANGLE', name: 'BodyTextarea', width: 1280, height: 110, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8 },
              ],
            },
            // Calendar selector
            {
              type: 'FRAME', name: 'CalSelector', width: 1280, height: 70,
              layoutMode: 'VERTICAL', itemSpacing: 6,
              children: [
                { type: 'TEXT', name: 'CalLabel', width: 1280, height: 18, text: 'Source Calendar', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                {
                  type: 'FRAME', name: 'CalDropdown', width: 400, height: 40,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 10, right: 12, bottom: 10, left: 12 },
                  children: [{ type: 'TEXT', name: 'CalVal', width: 376, height: 16, text: 'Weekly Team Standup', fontSize: 13, fill: C.foreground }],
                },
              ],
            },
            // Meeting checkboxes
            {
              type: 'FRAME', name: 'MeetingChecks', width: 1280, height: 80,
              layoutMode: 'VERTICAL', itemSpacing: 8,
              children: [
                { type: 'TEXT', name: 'MeetLabel', width: 1280, height: 18, text: 'Include Meetings', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                ...['Group A - Wed 10:00-12:00 (Weekly)', 'Group B - Thu 14:00-16:00 (Biweekly)'].map(m => ({
                  type: 'FRAME' as const, name: `MC-${m.slice(0,10)}`, width: 600, height: 24,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 8, counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    { type: 'RECTANGLE' as const, name: `CB-${m.slice(0,5)}`, width: 18, height: 18, fill: C.primary, cornerRadius: 4, stroke: C.border, strokeWeight: 1 },
                    { type: 'TEXT' as const, name: `ML-${m.slice(0,10)}`, width: 560, height: 16, text: m, fontSize: 13, fill: C.foreground },
                  ],
                })),
              ],
            },
            // Distribution channels table
            {
              type: 'FRAME', name: 'ChannelsSection', width: 1280, height: 240,
              layoutMode: 'VERTICAL', itemSpacing: 8,
              children: [
                { type: 'TEXT', name: 'ChTitle', width: 1280, height: 18, text: 'Distribution Channels', fontSize: 13, fontWeight: 'Bold', fill: C.foreground },
                // Table header
                {
                  type: 'FRAME', name: 'ChHeader', width: 1280, height: 36,
                  fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, padding: { top: 8, right: 12, bottom: 8, left: 12 },
                  children: [
                    { type: 'TEXT', name: 'H-En', width: 60, height: 16, text: 'Enable', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Ch', width: 200, height: 16, text: 'Channel', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Srv', width: 200, height: 16, text: 'Server', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Type', width: 100, height: 16, text: 'Type', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Perm', width: 200, height: 16, text: 'Permission', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Status', width: 120, height: 16, text: 'Status', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                  ],
                },
                // Channel rows
                ...[
                  ['#general', 'DAO Server', 'Text', 'Admin', 'Connected'],
                  ['#announcements', 'DAO Server', 'Announcement', 'Manage', 'Connected'],
                  ['#dev-updates', 'Dev Server', 'Text', 'Send', 'Connected'],
                  ['DM All Participants', '--', 'DM', 'Bot', 'Ready'],
                ].map(([ch, srv, tp, perm, stat], i) => ({
                  type: 'FRAME' as const, name: `ChRow-${i}`, width: 1280, height: 36,
                  fill: i % 2 === 0 ? C.card : C.background, stroke: C.border, strokeWeight: 0.5,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, padding: { top: 8, right: 12, bottom: 8, left: 12 },
                  counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    { type: 'RECTANGLE' as const, name: `CE-${i}`, width: 18, height: 18, fill: i < 3 ? C.primary : C.muted, cornerRadius: 4 },
                    { type: 'TEXT' as const, name: `CC-${i}`, width: 200, height: 16, text: ch, fontSize: 12, fill: C.foreground },
                    { type: 'TEXT' as const, name: `CS-${i}`, width: 200, height: 16, text: srv, fontSize: 12, fill: C.mutedForeground },
                    { type: 'TEXT' as const, name: `CT-${i}`, width: 100, height: 16, text: tp, fontSize: 12, fill: C.mutedForeground },
                    { type: 'TEXT' as const, name: `CP-${i}`, width: 200, height: 14, text: perm, fontSize: 11, fill: '#93c5fd' },
                    _statusBadge(stat, stat === 'Connected' ? '#16a34a' : '#2563eb'),
                  ],
                })),
              ],
            },
            // DM opt-out toggle
            {
              type: 'FRAME', name: 'DmOptOut', width: 1280, height: 36,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                _toggleSwitch(true),
                { type: 'TEXT', name: 'DmLabel', width: 400, height: 16, text: 'Respect DM opt-out preferences (2 users opted out)', fontSize: 13, fill: C.foreground },
              ],
            },
            // Poll section EXPANDED
            {
              type: 'FRAME', name: 'PollExpanded', width: 1280, height: 200,
              fill: C.card, stroke: C.primary, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 10, padding: 16,
              children: [
                {
                  type: 'FRAME', name: 'PollHeader', width: 1248, height: 24,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                  children: [
                    _toggleSwitch(true),
                    { type: 'TEXT', name: 'PollTitle', width: 200, height: 18, text: 'Include Poll', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'PollCollapse', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                  ],
                },
                inputField('Poll Question', 1248),
                // Poll options
                {
                  type: 'FRAME', name: 'PollOptions', width: 1248, height: 100,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    { type: 'TEXT', name: 'OptLabel', width: 1248, height: 14, text: 'Options:', fontSize: 12, fontWeight: 'Medium', fill: C.foreground },
                    ...['Option 1: Yes, sounds great!', 'Option 2: Need to check my schedule', 'Option 3: Cannot attend'].map((opt, i) => ({
                      type: 'FRAME' as const, name: `PO-${i}`, width: 600, height: 28,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 6, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'TEXT' as const, name: `PON-${i}`, width: 20, height: 14, text: `${i + 1}.`, fontSize: 12, fill: C.mutedForeground },
                        {
                          type: 'FRAME' as const, name: `POI-${i}`, width: 500, height: 28,
                          fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                          padding: { top: 6, right: 8, bottom: 6, left: 8 },
                          children: [{ type: 'TEXT' as const, name: `POV-${i}`, width: 480, height: 14, text: opt.split(': ')[1], fontSize: 12, fill: C.foreground }],
                        },
                        { type: 'RECTANGLE' as const, name: `POD-${i}`, width: 20, height: 20, fill: '#7f1d1d', cornerRadius: 4 },
                      ],
                    })),
                  ],
                },
              ],
            },
            // Schedule picker
            {
              type: 'FRAME', name: 'ScheduleRow', width: 1280, height: 60,
              layoutMode: 'VERTICAL', itemSpacing: 6,
              children: [
                { type: 'TEXT', name: 'SchedLabel', width: 1280, height: 18, text: 'Schedule', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                {
                  type: 'FRAME', name: 'SchedOpts', width: 1280, height: 32,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                  children: [
                    _toggleSwitch(false),
                    { type: 'TEXT', name: 'Immediate', width: 100, height: 14, text: 'Send Now', fontSize: 13, fill: C.foreground },
                    {
                      type: 'FRAME', name: 'DatePicker', width: 200, height: 32,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                      padding: { top: 6, right: 10, bottom: 6, left: 10 },
                      children: [{ type: 'TEXT', name: 'DateVal', width: 180, height: 16, text: 'Mar 19, 2026 09:00', fontSize: 12, fill: C.mutedForeground }],
                    },
                  ],
                },
              ],
            },
            // Preview panel
            {
              type: 'FRAME', name: 'Preview', width: 1280, height: 160,
              fill: '#1e1e2e', stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 8, padding: 16,
              children: [
                { type: 'TEXT', name: 'PreviewTitle', width: 1248, height: 18, text: 'Message Preview', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                { type: 'RECTANGLE', name: 'PreviewContent', width: 1248, height: 100, fill: C.background, cornerRadius: 8, stroke: C.border, strokeWeight: 1 },
              ],
            },
            // Action buttons
            {
              type: 'FRAME', name: 'AnnActions', width: 1280, height: 48,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, primaryAxisAlignItems: 'MAX',
              children: [
                button('Save as Template', 'secondary'),
                button('Schedule', 'secondary'),
                {
                  type: 'FRAME', name: 'SendBtn', width: 180, height: 44,
                  fill: '#16a34a', cornerRadius: 10,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'SendL', width: 100, height: 16, text: 'Send Now', fontSize: 14, fontWeight: 'Bold', fill: '#ffffff' }],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _toggleSwitch(on: boolean): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Toggle-${on}`, width: 44, height: 24,
    fill: on ? C.primary : C.muted, cornerRadius: 9999, stroke: C.border, strokeWeight: 1,
    children: [
      { type: 'ELLIPSE', name: 'Knob', width: 18, height: 18,
        x: on ? 22 : 4, y: 3, fill: '#ffffff' },
    ],
  }
}

function _statusBadge(label: string, color: string): WireframeNode {
  return {
    type: 'FRAME', name: `Status-${label}`, width: 120, height: 22,
    fill: color + '22', cornerRadius: 9999,
    layoutMode: 'HORIZONTAL', itemSpacing: 4, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
    children: [
      { type: 'ELLIPSE', name: `SI-${label}`, width: 6, height: 6, fill: color },
      { type: 'TEXT', name: `SL-${label}`, width: 80, height: 12, text: label, fontSize: 10, fill: color },
    ],
  }
}

function pu06_AnnouncementsTemplatesScheduled(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-06 Templates + Scheduled',
    description: 'Templates list with cards + scheduled announcements table with delivery details expanded',
    transitionLabel: 'Discord setup',
    frame: {
      type: 'FRAME', name: 'PU-AnnTemplSched', width: PW, height: 1300, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1236, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 20,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            // Tabs (Templates active)
            {
              type: 'FRAME', name: 'Tabs', width: 1280, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              children: ['Compose', 'Templates', 'Scheduled', 'Discord'].map((t, i) => ({
                type: 'FRAME' as const, name: `Tab-${t}`, width: 160, height: 40,
                stroke: i === 1 ? C.primary : C.border, strokeWeight: i === 1 ? 2 : 1,
                layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                children: [{ type: 'TEXT' as const, name: `TL-${t}`, width: 120, height: 16, text: t, fontSize: 13, fontWeight: i === 1 ? 'Bold' as const : 'Regular' as const, fill: i === 1 ? C.primary : C.mutedForeground }],
              })),
            },
            // Templates section
            { type: 'TEXT', name: 'TTitle', width: 1280, height: 24, text: 'Saved Templates (3)', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
            {
              type: 'FRAME', name: 'TemplateCards', width: 1280, height: 180,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                _templateCard('Weekly Update', 'Standard weekly meeting announcement with agenda', 'Used 12 times'),
                _templateCard('Sprint Recap', 'End-of-sprint summary with metrics and highlights', 'Used 8 times'),
                _templateCard('Governance Vote', 'Proposal notification with voting details and deadline', 'Used 3 times'),
              ],
            },
            // Divider
            { type: 'RECTANGLE', name: 'Div', width: 1280, height: 1, fill: C.border },
            // Scheduled section
            { type: 'TEXT', name: 'STitle', width: 1280, height: 24, text: 'Scheduled & Sent Announcements', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
            // Scheduled table
            {
              type: 'FRAME', name: 'SchedTable', width: 1280, height: 320,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children: [
                // Header
                {
                  type: 'FRAME', name: 'STHeader', width: 1280, height: 40,
                  fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, padding: { top: 10, right: 16, bottom: 10, left: 16 },
                  children: [
                    { type: 'TEXT', name: 'H-Title', width: 280, height: 16, text: 'Title', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Date', width: 180, height: 16, text: 'Scheduled / Sent', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Channels', width: 200, height: 16, text: 'Channels', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Status', width: 120, height: 16, text: 'Status', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Actions', width: 100, height: 16, text: 'Actions', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                  ],
                },
                // Rows
                ...[
                  ['Weekly Update #12', 'Mar 19, 09:00', '#general, DM', 'Pending', '#eab308'],
                  ['Sprint Recap Q1', 'Mar 15, 10:00', '#announcements', 'Sent', '#16a34a'],
                  ['Governance Vote #7', 'Mar 10, 14:00', '#general, #gov', 'Sent', '#16a34a'],
                  ['Meeting Reminder', 'Mar 8, 08:00', 'DM Only', 'Failed', '#dc2626'],
                ].map(([title, date, channels, status, color], i) => ({
                  type: 'FRAME' as const, name: `STR-${i}`, width: 1280, height: 40,
                  fill: i % 2 === 0 ? C.card : C.background, stroke: C.border, strokeWeight: 0.5,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, padding: { top: 10, right: 16, bottom: 10, left: 16 },
                  counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    { type: 'TEXT' as const, name: `RT-${i}`, width: 280, height: 16, text: title, fontSize: 12, fill: C.foreground },
                    { type: 'TEXT' as const, name: `RD-${i}`, width: 180, height: 16, text: date, fontSize: 12, fill: C.mutedForeground },
                    { type: 'TEXT' as const, name: `RC-${i}`, width: 200, height: 16, text: channels, fontSize: 12, fill: C.mutedForeground },
                    _statusBadge(status, color),
                    { type: 'TEXT' as const, name: `RA-${i}`, width: 100, height: 14, text: 'Details', fontSize: 11, fill: C.primary },
                  ],
                })),
                // Expanded delivery details for row 1 (Sent)
                {
                  type: 'FRAME', name: 'DeliveryExpanded', width: 1280, height: 100,
                  fill: '#0f1f0f', stroke: '#16a34a', strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 6, padding: 14,
                  children: [
                    { type: 'TEXT', name: 'DelTitle', width: 1252, height: 16, text: 'Delivery Details - Sprint Recap Q1', fontSize: 13, fontWeight: 'Bold', fill: '#4ade80' },
                    {
                      type: 'FRAME', name: 'DelStats', width: 1252, height: 50,
                      layoutMode: 'HORIZONTAL', itemSpacing: 20,
                      children: [
                        _deliveryStat('Channel Messages', '2 / 2 delivered'),
                        _deliveryStat('DM Sent', '12 / 14 (2 opted out)'),
                        _deliveryStat('Errors', '0'),
                        _deliveryStat('Delivery Time', '3.2 seconds'),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _templateCard(title: string, desc: string, usage: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Tmpl-${title}`, width: 416, height: 180,
    fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
    layoutMode: 'VERTICAL', itemSpacing: 10, padding: 18,
    children: [
      { type: 'TEXT', name: `TN-${title}`, width: 380, height: 20, text: title, fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
      { type: 'TEXT', name: `TD-${title}`, width: 380, height: 36, text: desc, fontSize: 13, fill: C.mutedForeground },
      { type: 'TEXT', name: `TU-${title}`, width: 380, height: 14, text: usage, fontSize: 11, fill: C.mutedForeground },
      {
        type: 'FRAME', name: `TA-${title}`, width: 380, height: 36,
        layoutMode: 'HORIZONTAL', itemSpacing: 8,
        children: [button('Use'), button('Edit', 'secondary'), button('Delete', 'secondary')],
      },
    ],
  }
}

function _deliveryStat(label: string, value: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `DS-${label}`, width: 200, height: 44,
    layoutMode: 'VERTICAL', itemSpacing: 4,
    children: [
      { type: 'TEXT', name: `DSL-${label}`, width: 200, height: 14, text: label, fontSize: 11, fill: C.mutedForeground },
      { type: 'TEXT', name: `DSV-${label}`, width: 200, height: 18, text: value, fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
    ],
  }
}

function pu07_AnnouncementsDiscord(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-07 Discord Integration',
    description: 'Discord setup with OAuth, link key, connected servers, per-channel toggles, permissions',
    transitionLabel: 'opens Settings',
    frame: {
      type: 'FRAME', name: 'PU-Discord', width: PW, height: 1200, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1136, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            // Tabs (Discord active)
            {
              type: 'FRAME', name: 'Tabs', width: 1280, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              children: ['Compose', 'Templates', 'Scheduled', 'Discord'].map((t, i) => ({
                type: 'FRAME' as const, name: `Tab-${t}`, width: 160, height: 40,
                stroke: i === 3 ? C.primary : C.border, strokeWeight: i === 3 ? 2 : 1,
                layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                children: [{ type: 'TEXT' as const, name: `TL-${t}`, width: 120, height: 16, text: t, fontSize: 13, fontWeight: i === 3 ? 'Bold' as const : 'Regular' as const, fill: i === 3 ? C.primary : C.mutedForeground }],
              })),
            },
            // Connection status
            {
              type: 'FRAME', name: 'ConnStatus', width: 1280, height: 60,
              fill: '#0f1f0f', stroke: '#16a34a', strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 16,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'ConnDot', width: 12, height: 12, fill: '#4ade80' },
                { type: 'TEXT', name: 'ConnText', width: 300, height: 18, text: 'Discord Bot Connected', fontSize: 14, fontWeight: 'Bold', fill: '#4ade80' },
                { type: 'TEXT', name: 'BotName', width: 200, height: 14, text: 'CoordinationBot#1234', fontSize: 12, fill: C.mutedForeground },
                button('Disconnect', 'secondary'),
              ],
            },
            // Link key section
            {
              type: 'FRAME', name: 'LinkKey', width: 1280, height: 110,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 8, padding: 16,
              children: [
                { type: 'TEXT', name: 'LKTitle', width: 1248, height: 18, text: 'Link Key', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                { type: 'TEXT', name: 'LKDesc', width: 1248, height: 14, text: 'Use this key to link Discord channels with the /ccm-link command', fontSize: 12, fill: C.mutedForeground },
                {
                  type: 'FRAME', name: 'LKRow', width: 1248, height: 40,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                  children: [
                    {
                      type: 'FRAME', name: 'LKInput', width: 400, height: 36,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                      padding: { top: 8, right: 12, bottom: 8, left: 12 },
                      children: [{ type: 'TEXT', name: 'LKVal', width: 376, height: 16, text: 'ccm-k3x7-m9p2-f5n1', fontSize: 13, fill: C.foreground }],
                    },
                    button('Copy'),
                    button('Regenerate', 'secondary'),
                  ],
                },
              ],
            },
            // Connected servers expandable
            {
              type: 'FRAME', name: 'Servers', width: 1280, height: 600,
              layoutMode: 'VERTICAL', itemSpacing: 16,
              children: [
                { type: 'TEXT', name: 'SrvTitle', width: 1280, height: 24, text: 'Connected Servers (2)', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                // Server 1 expanded
                {
                  type: 'FRAME', name: 'Server1', width: 1280, height: 280,
                  fill: C.card, stroke: C.primary, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 16,
                  children: [
                    {
                      type: 'FRAME', name: 'S1Header', width: 1248, height: 32,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'ELLIPSE', name: 'S1Icon', width: 28, height: 28, fill: '#5865F2' },
                        { type: 'TEXT', name: 'S1Name', width: 300, height: 22, text: 'DAO Governance Server', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                        _statusBadge('Connected', '#16a34a'),
                        { type: 'TEXT', name: 'S1Col', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                      ],
                    },
                    // Channel toggles
                    ...[
                      ['#general', true, 'text'], ['#announcements', true, 'announcement'],
                      ['#governance', true, 'text'], ['#dev-updates', false, 'text'],
                      ['#off-topic', false, 'text'], ['#voice-chat', false, 'voice'],
                    ].map(([ch, enabled, chType]) => ({
                      type: 'FRAME' as const, name: `Ch-${ch}`, width: 1248, height: 32,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 12, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        _toggleSwitch(enabled as boolean),
                        { type: 'TEXT' as const, name: `CL-${ch}`, width: 200, height: 16, text: `# ${(ch as string).slice(1)}`, fontSize: 13, fill: enabled ? C.foreground : C.mutedForeground },
                        {
                          type: 'FRAME' as const, name: `CT-${ch}`, width: 80, height: 20,
                          fill: C.muted, cornerRadius: 9999, padding: { top: 2, right: 8, bottom: 2, left: 8 },
                          layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                          children: [{ type: 'TEXT' as const, name: `CTL-${ch}`, width: 60, height: 12, text: chType as string, fontSize: 10, fill: C.mutedForeground }],
                        },
                        { type: 'TEXT' as const, name: `CP-${ch}`, width: 160, height: 14, text: enabled ? 'Send Messages' : 'No permission', fontSize: 11, fill: enabled ? '#93c5fd' : C.mutedForeground },
                      ],
                    })),
                  ],
                },
                // Server 2 collapsed
                {
                  type: 'FRAME', name: 'Server2', width: 1280, height: 60,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 16,
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'S2Icon', width: 28, height: 28, fill: '#5865F2' },
                    { type: 'TEXT', name: 'S2Name', width: 300, height: 20, text: 'Development Server', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    _statusBadge('Connected', '#16a34a'),
                    { type: 'TEXT', name: 'S2Chans', width: 140, height: 14, text: '3 channels enabled', fontSize: 12, fill: C.mutedForeground },
                    { type: 'TEXT', name: 'S2Expand', width: 60, height: 14, text: 'Expand', fontSize: 11, fill: C.primary },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function pu08_SettingsProfileAppearance(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-08 Settings: Profile + Appearance',
    description: 'Profile form, role badges, preset themes grid, custom slots, theme editor expanded with color pickers',
    transitionLabel: 'Calendar/AI settings',
    frame: {
      type: 'FRAME', name: 'PU-SettingsProfile', width: PW, height: 1700, fill: C.background,
      layoutMode: 'HORIZONTAL', itemSpacing: 0,
      children: [
        // Settings sidebar
        {
          type: 'FRAME', name: 'SettingsNav', width: 220, height: 1700,
          fill: C.card, stroke: C.border, strokeWeight: 1,
          layoutMode: 'VERTICAL', itemSpacing: 4, padding: { top: 80, right: 12, bottom: 20, left: 12 },
          children: ['Profile', 'Notifications', 'Calendar', 'AI', 'Privacy'].map((t, i) => ({
            type: 'FRAME' as const, name: `Nav-${t}`, width: 196, height: 40,
            fill: i === 0 ? C.primary : C.background, cornerRadius: 8,
            layoutMode: 'HORIZONTAL' as const, itemSpacing: 8, padding: { top: 10, right: 14, bottom: 10, left: 14 },
            counterAxisAlignItems: 'CENTER' as const,
            children: [{ type: 'TEXT' as const, name: `NL-${t}`, width: 140, height: 16, text: t, fontSize: 14, fontWeight: i === 0 ? 'Bold' as const : 'Regular' as const, fill: i === 0 ? '#ffffff' : C.mutedForeground }],
          })),
        },
        // Main content
        {
          type: 'FRAME', name: 'MainContent', width: PW - 220, height: 1700,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            navbar(),
            {
              type: 'FRAME', name: 'Content', width: PW - 220, height: 1636,
              layoutMode: 'VERTICAL', itemSpacing: 24,
              padding: { top: 24, right: 60, bottom: 24, left: 60 },
              children: [
                { type: 'TEXT', name: 'PageTitle', width: 1100, height: 32, text: 'Settings', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
                // Profile section
                {
                  type: 'FRAME', name: 'ProfileSection', width: 1100, height: 360,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'ProfileTitle', width: 1052, height: 24, text: 'Profile Information', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                    // Avatar + name row
                    {
                      type: 'FRAME', name: 'AvatarRow', width: 1052, height: 80,
                      layoutMode: 'HORIZONTAL', itemSpacing: 20, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'ELLIPSE', name: 'Avatar', width: 72, height: 72, fill: C.primary },
                        {
                          type: 'FRAME', name: 'AvatarActions', width: 200, height: 70,
                          layoutMode: 'VERTICAL', itemSpacing: 8,
                          children: [
                            { type: 'TEXT', name: 'AvatarLabel', width: 200, height: 14, text: 'Profile Photo', fontSize: 12, fill: C.mutedForeground },
                            {
                              type: 'FRAME', name: 'AvatarBtns', width: 200, height: 32,
                              layoutMode: 'HORIZONTAL', itemSpacing: 8,
                              children: [button('Upload'), button('Remove', 'secondary')],
                            },
                          ],
                        },
                      ],
                    },
                    // Form fields (2 columns)
                    {
                      type: 'FRAME', name: 'FormGrid', width: 1052, height: 120,
                      layoutMode: 'HORIZONTAL', itemSpacing: 24,
                      children: [
                        {
                          type: 'FRAME', name: 'Col1', width: 514, height: 120,
                          layoutMode: 'VERTICAL', itemSpacing: 12,
                          children: [inputField('Display Name', 514), inputField('Email', 514)],
                        },
                        {
                          type: 'FRAME', name: 'Col2', width: 514, height: 120,
                          layoutMode: 'VERTICAL', itemSpacing: 12,
                          children: [
                            inputField('Timezone', 514),
                            // Bio
                            {
                              type: 'FRAME', name: 'BioField', width: 514, height: 50,
                              layoutMode: 'VERTICAL', itemSpacing: 6,
                              children: [
                                { type: 'TEXT', name: 'BioLabel', width: 514, height: 14, text: 'Bio', fontSize: 12, fontWeight: 'Medium', fill: C.foreground },
                                { type: 'RECTANGLE', name: 'BioInput', width: 514, height: 28, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6 },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    // Role badges
                    {
                      type: 'FRAME', name: 'Roles', width: 1052, height: 40,
                      layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'RoleLabel', width: 60, height: 16, text: 'Roles:', fontSize: 13, fill: C.mutedForeground },
                        ...['Admin', 'Facilitator', 'Ambassador'].map((r, i) => ({
                          type: 'FRAME' as const, name: `Role-${r}`, width: 100, height: 28,
                          fill: [C.primary, '#0891b2', '#d97706'][i], cornerRadius: 9999,
                          layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                          children: [{ type: 'TEXT' as const, name: `RL-${r}`, width: 80, height: 14, text: r, fontSize: 11, fontWeight: 'Medium' as const, fill: '#ffffff' }],
                        })),
                      ],
                    },
                    button('Save Changes'),
                  ],
                },
                // Appearance section
                {
                  type: 'FRAME', name: 'AppearanceSection', width: 1100, height: 280,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 14, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'AppTitle', width: 1052, height: 24, text: 'Appearance', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                    // Preset themes grid (2x3)
                    { type: 'TEXT', name: 'PresetLabel', width: 1052, height: 16, text: 'Preset Themes', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'PresetsGrid', width: 1052, height: 160,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12,
                      children: [
                        _themePreset('Default Dark', '#0a0a0f', '#6d28d9', true),
                        _themePreset('Ocean Blue', '#0a1628', '#2563eb', false),
                        _themePreset('Emerald', '#0a1f0a', '#059669', false),
                        _themePreset('Sunset', '#1f0a0a', '#dc2626', false),
                        _themePreset('Amber', '#1a1500', '#d97706', false),
                        _themePreset('Light Mode', '#f9fafb', '#6d28d9', false),
                      ],
                    },
                  ],
                },
                // Custom Theme Slots
                {
                  type: 'FRAME', name: 'CustomSlots', width: 1100, height: 120,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'CSTitle', width: 1052, height: 18, text: 'Custom Theme Slots (2 / 3)', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'Slots', width: 1052, height: 56,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12,
                      children: [
                        _customSlot('My Dark Theme', '#0d0d1a', '#8b5cf6'),
                        _customSlot('Cardano Blue', '#0a1628', '#3b82f6'),
                        {
                          type: 'FRAME', name: 'EmptySlot', width: 180, height: 56,
                          fill: C.background, stroke: C.border, strokeWeight: 2, cornerRadius: 10,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'Plus', width: 20, height: 20, text: '+', fontSize: 18, fill: C.mutedForeground }],
                        },
                      ],
                    },
                  ],
                },
                // Theme Editor EXPANDED
                {
                  type: 'FRAME', name: 'ThemeEditor', width: 1100, height: 480,
                  fill: C.card, stroke: C.primary, strokeWeight: 2, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24,
                  children: [
                    {
                      type: 'FRAME', name: 'TEHeader', width: 1052, height: 28,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'TETitle', width: 300, height: 22, text: 'Theme Editor: My Dark Theme', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                        { type: 'TEXT', name: 'TECollapse', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                      ],
                    },
                    inputField('Theme Name', 400),
                    // Color groups (accordion - first group open)
                    {
                      type: 'FRAME', name: 'ColorGroups', width: 1052, height: 340,
                      layoutMode: 'VERTICAL', itemSpacing: 8,
                      children: [
                        // Base Colors - EXPANDED
                        {
                          type: 'FRAME', name: 'BaseColors', width: 1052, height: 200,
                          fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                          layoutMode: 'VERTICAL', itemSpacing: 10, padding: 14,
                          children: [
                            { type: 'TEXT', name: 'BCTitle', width: 1024, height: 18, text: 'Base Colors (expanded)', fontSize: 13, fontWeight: 'Bold', fill: C.foreground },
                            {
                              type: 'FRAME', name: 'BCGrid', width: 1024, height: 140,
                              layoutMode: 'HORIZONTAL', itemSpacing: 16,
                              children: [
                                _colorPicker('Background', '#0d0d1a'),
                                _colorPicker('Foreground', '#e4e4e7'),
                                _colorPicker('Card', '#1a1a2e'),
                                _colorPicker('Primary', '#8b5cf6'),
                                _colorPicker('Muted', '#27272a'),
                                _colorPicker('Border', '#3f3f46'),
                              ],
                            },
                          ],
                        },
                        // Interactive Colors - collapsed
                        {
                          type: 'FRAME', name: 'IntColors', width: 1052, height: 44,
                          fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, padding: { top: 12, right: 14, bottom: 12, left: 14 },
                          counterAxisAlignItems: 'CENTER',
                          children: [
                            { type: 'TEXT', name: 'ICTitle', width: 800, height: 18, text: 'Interactive Colors (collapsed - Destructive, Accent, Ring, ...)', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                            { type: 'TEXT', name: 'ICExp', width: 60, height: 14, text: 'Expand', fontSize: 11, fill: C.primary },
                          ],
                        },
                        // Semantic Colors - collapsed
                        {
                          type: 'FRAME', name: 'SemColors', width: 1052, height: 44,
                          fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, padding: { top: 12, right: 14, bottom: 12, left: 14 },
                          counterAxisAlignItems: 'CENTER',
                          children: [
                            { type: 'TEXT', name: 'SCTitle', width: 800, height: 18, text: 'Semantic Colors (collapsed - Success, Warning, Info, ...)', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                            { type: 'TEXT', name: 'SCExp', width: 60, height: 14, text: 'Expand', fontSize: 11, fill: C.primary },
                          ],
                        },
                      ],
                    },
                    // Save / Reset
                    {
                      type: 'FRAME', name: 'TEActions', width: 1052, height: 40,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12,
                      children: [button('Save Theme'), button('Reset to Default', 'secondary'), button('Delete Theme', 'secondary')],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _themePreset(name: string, bg: string, accent: string, active: boolean): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Theme-${name}`, width: 168, height: 160,
    fill: bg, cornerRadius: 12,
    stroke: active ? accent : C.border, strokeWeight: active ? 3 : 1,
    layoutMode: 'VERTICAL', itemSpacing: 8, padding: 12,
    children: [
      { type: 'RECTANGLE', name: `TBg-${name}`, width: 144, height: 80, fill: accent, cornerRadius: 8 },
      { type: 'TEXT', name: `TN-${name}`, width: 144, height: 16, text: name, fontSize: 12, fontWeight: 'Medium', fill: active ? accent : '#a1a1aa' },
      active ? _statusBadge('Active', accent) : { type: 'TEXT', name: `TA-${name}`, width: 144, height: 14, text: 'Apply', fontSize: 11, fill: '#a1a1aa' },
    ],
  }
}

function _customSlot(name: string, bg: string, accent: string): WireframeNode {
  return {
    type: 'FRAME', name: `CSlot-${name}`, width: 180, height: 56,
    fill: bg, cornerRadius: 10, stroke: accent, strokeWeight: 1,
    layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: 10,
    counterAxisAlignItems: 'CENTER',
    children: [
      { type: 'RECTANGLE', name: `CSP-${name}`, width: 28, height: 28, fill: accent, cornerRadius: 6 },
      { type: 'TEXT', name: `CSN-${name}`, width: 110, height: 14, text: name, fontSize: 12, fill: '#e4e4e7' },
    ],
  }
}

function _colorPicker(label: string, color: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `CP-${label}`, width: 160, height: 140,
    layoutMode: 'VERTICAL', itemSpacing: 6,
    children: [
      { type: 'TEXT', name: `CPL-${label}`, width: 160, height: 14, text: label, fontSize: 11, fontWeight: 'Medium', fill: C.foreground },
      { type: 'RECTANGLE', name: `CPC-${label}`, width: 160, height: 60, fill: color, cornerRadius: 8, stroke: C.border, strokeWeight: 1 },
      {
        type: 'FRAME', name: `CPV-${label}`, width: 160, height: 28,
        fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
        padding: { top: 6, right: 8, bottom: 6, left: 8 },
        children: [{ type: 'TEXT', name: `CPH-${label}`, width: 140, height: 14, text: color, fontSize: 12, fill: C.foreground }],
      },
      { type: 'TEXT', name: `CPI-${label}`, width: 160, height: 12, text: 'Click to edit', fontSize: 10, fill: C.mutedForeground },
    ],
  }
}

function pu09_SettingsCalendarAI(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-09 Settings: Calendar + AI',
    description: 'Google sources, Zoom/Luma/Figma integrations, default params, AI model, usage, API keys expanded',
    transitionLabel: 'Notifications/Privacy',
    frame: {
      type: 'FRAME', name: 'PU-SettingsCalAI', width: PW, height: 1600, fill: C.background,
      layoutMode: 'HORIZONTAL', itemSpacing: 0,
      children: [
        // Settings sidebar
        {
          type: 'FRAME', name: 'SettingsNav', width: 220, height: 1600,
          fill: C.card, stroke: C.border, strokeWeight: 1,
          layoutMode: 'VERTICAL', itemSpacing: 4, padding: { top: 80, right: 12, bottom: 20, left: 12 },
          children: ['Profile', 'Notifications', 'Calendar', 'AI', 'Privacy'].map((t, i) => ({
            type: 'FRAME' as const, name: `Nav-${t}`, width: 196, height: 40,
            fill: i === 2 ? C.primary : C.background, cornerRadius: 8,
            layoutMode: 'HORIZONTAL' as const, itemSpacing: 8, padding: { top: 10, right: 14, bottom: 10, left: 14 },
            counterAxisAlignItems: 'CENTER' as const,
            children: [{ type: 'TEXT' as const, name: `NL-${t}`, width: 140, height: 16, text: t, fontSize: 14, fontWeight: i === 2 ? 'Bold' as const : 'Regular' as const, fill: i === 2 ? '#ffffff' : C.mutedForeground }],
          })),
        },
        {
          type: 'FRAME', name: 'MainContent', width: PW - 220, height: 1600,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            navbar(),
            {
              type: 'FRAME', name: 'Content', width: PW - 220, height: 1536,
              layoutMode: 'VERTICAL', itemSpacing: 24,
              padding: { top: 24, right: 60, bottom: 24, left: 60 },
              children: [
                { type: 'TEXT', name: 'PageTitle', width: 1100, height: 32, text: 'Calendar Settings', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
                // Google Calendar Sources
                {
                  type: 'FRAME', name: 'GoogleSources', width: 1100, height: 280,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 12, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'GSTitle', width: 1052, height: 22, text: 'Google Calendar Sources', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'GSDesc', width: 1052, height: 14, text: 'Import availability from your Google Calendar. Busy times will be marked as unavailable.', fontSize: 12, fill: C.mutedForeground },
                    // Connected account
                    {
                      type: 'FRAME', name: 'GoogleAccount', width: 1052, height: 52,
                      fill: '#0f1f0f', stroke: '#16a34a', strokeWeight: 1, cornerRadius: 8,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 12,
                      counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'ELLIPSE', name: 'GIcon', width: 24, height: 24, fill: '#4285f4' },
                        { type: 'TEXT', name: 'GEmail', width: 250, height: 16, text: 'tevo@example.com', fontSize: 13, fill: C.foreground },
                        _statusBadge('Connected', '#16a34a'),
                        button('Disconnect', 'secondary'),
                      ],
                    },
                    // Calendar list with toggles
                    {
                      type: 'FRAME', name: 'CalList', width: 1052, height: 120,
                      layoutMode: 'VERTICAL', itemSpacing: 6,
                      children: [
                        { type: 'TEXT', name: 'CLTitle', width: 1052, height: 16, text: 'Calendars to import:', fontSize: 12, fontWeight: 'Medium', fill: C.foreground },
                        ...[['Primary Calendar', true], ['Work Events', true], ['Holidays', false], ['Personal', false]].map(([name, on]) => ({
                          type: 'FRAME' as const, name: `GC-${name}`, width: 600, height: 24,
                          layoutMode: 'HORIZONTAL' as const, itemSpacing: 10, counterAxisAlignItems: 'CENTER' as const,
                          children: [
                            _toggleSwitch(on as boolean),
                            { type: 'TEXT' as const, name: `GCL-${name}`, width: 250, height: 16, text: name as string, fontSize: 13, fill: on ? C.foreground : C.mutedForeground },
                          ],
                        })),
                      ],
                    },
                  ],
                },
                // Meeting Integrations
                {
                  type: 'FRAME', name: 'Integrations', width: 1100, height: 220,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 12, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'IntTitle', width: 1052, height: 22, text: 'Meeting Integrations', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'IntGrid', width: 1052, height: 140,
                      layoutMode: 'HORIZONTAL', itemSpacing: 16,
                      children: [
                        _integrationCard('Google Meet', 'Connected', '#16a34a', '#4285f4'),
                        _integrationCard('Zoom', 'Not connected', '#eab308', '#2d8cff'),
                        _integrationCard('Luma', 'Connected', '#16a34a', '#d946ef'),
                        _integrationCard('Figma', 'Not connected', '#eab308', '#f24e1e'),
                      ],
                    },
                  ],
                },
                // Default Parameters
                {
                  type: 'FRAME', name: 'DefaultParams', width: 1100, height: 200,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 12, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'DPTitle', width: 1052, height: 22, text: 'Default Calendar Parameters', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'DPGrid', width: 1052, height: 120,
                      layoutMode: 'HORIZONTAL', itemSpacing: 24,
                      children: [
                        inputField('Default Time Interval', 240),
                        inputField('Default Hour Range Start', 240),
                        inputField('Default Hour Range End', 240),
                        inputField('Week Start Day', 240),
                      ],
                    },
                  ],
                },
                // AI Settings section
                { type: 'RECTANGLE', name: 'Divider', width: 1100, height: 1, fill: C.border },
                { type: 'TEXT', name: 'AITitle', width: 1100, height: 32, text: 'AI Settings', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
                // Model selector
                {
                  type: 'FRAME', name: 'ModelSection', width: 1100, height: 140,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 12, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'ModTitle', width: 1052, height: 18, text: 'AI Model', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'ModelDropdown', width: 400, height: 40,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                      padding: { top: 10, right: 12, bottom: 10, left: 12 },
                      layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'ModVal', width: 300, height: 16, text: 'GPT-4o (recommended)', fontSize: 13, fill: C.foreground },
                        { type: 'TEXT', name: 'ModArrow', width: 12, height: 16, text: 'v', fontSize: 12, fill: C.mutedForeground },
                      ],
                    },
                    // Usage display
                    {
                      type: 'FRAME', name: 'Usage', width: 1052, height: 32,
                      layoutMode: 'HORIZONTAL', itemSpacing: 24, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'UsageLabel', width: 200, height: 16, text: 'Monthly usage: 1,247 tokens', fontSize: 12, fill: C.mutedForeground },
                        { type: 'TEXT', name: 'CostLabel', width: 200, height: 16, text: 'Estimated cost: $0.14', fontSize: 12, fill: C.mutedForeground },
                      ],
                    },
                  ],
                },
                // Agent API Keys EXPANDED
                {
                  type: 'FRAME', name: 'APIKeys', width: 1100, height: 340,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 12, padding: 24,
                  children: [
                    {
                      type: 'FRAME', name: 'AKHeader', width: 1052, height: 28,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'AKTitle', width: 300, height: 22, text: 'Agent API Keys (2)', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                        button('Create New Key'),
                      ],
                    },
                    // Key 1 expanded
                    {
                      type: 'FRAME', name: 'Key1', width: 1052, height: 180,
                      fill: C.background, stroke: C.primary, strokeWeight: 1, cornerRadius: 10,
                      layoutMode: 'VERTICAL', itemSpacing: 8, padding: 14,
                      children: [
                        {
                          type: 'FRAME', name: 'K1Header', width: 1024, height: 24,
                          layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                          children: [
                            { type: 'TEXT', name: 'K1Name', width: 200, height: 18, text: 'Meeting Scheduler Agent', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                            _statusBadge('Active', '#16a34a'),
                            { type: 'TEXT', name: 'K1Collapse', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                          ],
                        },
                        {
                          type: 'FRAME', name: 'K1Value', width: 1024, height: 32,
                          fill: C.muted, cornerRadius: 6, padding: { top: 8, right: 10, bottom: 8, left: 10 },
                          children: [{ type: 'TEXT', name: 'K1V', width: 1004, height: 14, text: 'ccm_sk_live_a1b2c3d4e5...', fontSize: 12, fill: C.mutedForeground }],
                        },
                        // Scopes expanded
                        {
                          type: 'FRAME', name: 'K1Scopes', width: 1024, height: 80,
                          layoutMode: 'VERTICAL', itemSpacing: 4,
                          children: [
                            { type: 'TEXT', name: 'K1SLabel', width: 1024, height: 14, text: 'Scopes:', fontSize: 11, fontWeight: 'Medium', fill: C.foreground },
                            {
                              type: 'FRAME', name: 'K1ScopeList', width: 1024, height: 56,
                              layoutMode: 'HORIZONTAL', itemSpacing: 8,
                              children: ['calendars:read', 'calendars:write', 'meetings:create', 'announcements:send'].map(s => ({
                                type: 'FRAME' as const, name: `Sc-${s}`, width: 140, height: 24,
                                fill: '#1a0a2e', cornerRadius: 9999, padding: { top: 4, right: 10, bottom: 4, left: 10 },
                                layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                                children: [{ type: 'TEXT' as const, name: `SL-${s}`, width: 120, height: 12, text: s, fontSize: 10, fill: '#a78bfa' }],
                              })),
                            },
                          ],
                        },
                        {
                          type: 'FRAME', name: 'K1Actions', width: 1024, height: 28,
                          layoutMode: 'HORIZONTAL', itemSpacing: 8,
                          children: [button('Copy Key', 'secondary'), button('Revoke', 'secondary')],
                        },
                      ],
                    },
                    // Key 2 collapsed
                    {
                      type: 'FRAME', name: 'Key2', width: 1052, height: 52,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 10,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 14,
                      counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'K2Name', width: 200, height: 16, text: 'Feedback Bot', fontSize: 13, fontWeight: 'Medium', fill: C.foreground },
                        _statusBadge('Active', '#16a34a'),
                        { type: 'TEXT', name: 'K2Scopes', width: 200, height: 14, text: '2 scopes', fontSize: 12, fill: C.mutedForeground },
                        { type: 'TEXT', name: 'K2Expand', width: 60, height: 14, text: 'Expand', fontSize: 11, fill: C.primary },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _integrationCard(name: string, status: string, statusColor: string, brandColor: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Int-${name}`, width: 248, height: 140,
    fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
    layoutMode: 'VERTICAL', itemSpacing: 10, padding: 16,
    children: [
      {
        type: 'FRAME', name: `IH-${name}`, width: 216, height: 32,
        layoutMode: 'HORIZONTAL', itemSpacing: 10, counterAxisAlignItems: 'CENTER',
        children: [
          { type: 'ELLIPSE', name: `II-${name}`, width: 28, height: 28, fill: brandColor },
          { type: 'TEXT', name: `IN-${name}`, width: 160, height: 20, text: name, fontSize: 15, fontWeight: 'Bold', fill: C.foreground },
        ],
      },
      _statusBadge(status, statusColor),
      button(status === 'Connected' ? 'Settings' : 'Connect', status === 'Connected' ? 'secondary' : 'primary'),
    ],
  }
}

function pu10_SettingsNotificationsPrivacy(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-10 Settings: Notifications + Privacy',
    description: 'Discord channels, reminders, email vis, Cardano wallet, account linking, legal, delete account',
    transitionLabel: 'opens Feedback',
    frame: {
      type: 'FRAME', name: 'PU-SettingsNotiPriv', width: PW, height: 1500, fill: C.background,
      layoutMode: 'HORIZONTAL', itemSpacing: 0,
      children: [
        // Settings sidebar
        {
          type: 'FRAME', name: 'SettingsNav', width: 220, height: 1500,
          fill: C.card, stroke: C.border, strokeWeight: 1,
          layoutMode: 'VERTICAL', itemSpacing: 4, padding: { top: 80, right: 12, bottom: 20, left: 12 },
          children: ['Profile', 'Notifications', 'Calendar', 'AI', 'Privacy'].map((t, i) => ({
            type: 'FRAME' as const, name: `Nav-${t}`, width: 196, height: 40,
            fill: i === 1 ? C.primary : C.background, cornerRadius: 8,
            layoutMode: 'HORIZONTAL' as const, itemSpacing: 8, padding: { top: 10, right: 14, bottom: 10, left: 14 },
            counterAxisAlignItems: 'CENTER' as const,
            children: [{ type: 'TEXT' as const, name: `NL-${t}`, width: 140, height: 16, text: t, fontSize: 14, fontWeight: i === 1 ? 'Bold' as const : 'Regular' as const, fill: i === 1 ? '#ffffff' : C.mutedForeground }],
          })),
        },
        {
          type: 'FRAME', name: 'MainContent', width: PW - 220, height: 1500,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          children: [
            navbar(),
            {
              type: 'FRAME', name: 'Content', width: PW - 220, height: 1436,
              layoutMode: 'VERTICAL', itemSpacing: 24,
              padding: { top: 24, right: 60, bottom: 24, left: 60 },
              children: [
                { type: 'TEXT', name: 'NTitle', width: 1100, height: 32, text: 'Notification Settings', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
                // Discord notification channels
                {
                  type: 'FRAME', name: 'DiscordNotif', width: 1100, height: 240,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 12, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'DNTitle', width: 1052, height: 22, text: 'Discord Notifications', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'DiscordConn', width: 1052, height: 44,
                      fill: '#0f1f0f', stroke: '#16a34a', strokeWeight: 1, cornerRadius: 8,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 10, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'ELLIPSE', name: 'DIcon', width: 20, height: 20, fill: '#5865F2' },
                        { type: 'TEXT', name: 'DUser', width: 200, height: 16, text: 'Tevo#4567', fontSize: 13, fill: C.foreground },
                        _statusBadge('Connected', '#16a34a'),
                      ],
                    },
                    // Channel toggles
                    {
                      type: 'FRAME', name: 'NotifToggles', width: 1052, height: 120,
                      layoutMode: 'VERTICAL', itemSpacing: 8,
                      children: [
                        ...['Meeting confirmations', 'Availability reminders', 'Announcement delivery reports', 'Calendar updates', 'Weekly summary digest'].map((n, i) => ({
                          type: 'FRAME' as const, name: `NT-${i}`, width: 600, height: 20,
                          layoutMode: 'HORIZONTAL' as const, itemSpacing: 12, counterAxisAlignItems: 'CENTER' as const,
                          children: [
                            _toggleSwitch(i < 3),
                            { type: 'TEXT' as const, name: `NTL-${i}`, width: 350, height: 16, text: n, fontSize: 13, fill: i < 3 ? C.foreground : C.mutedForeground },
                          ],
                        })),
                      ],
                    },
                  ],
                },
                // Reminders
                {
                  type: 'FRAME', name: 'Reminders', width: 1100, height: 120,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 24,
                  children: [
                    { type: 'TEXT', name: 'RemTitle', width: 1052, height: 18, text: 'Meeting Reminders', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'RemOptions', width: 1052, height: 32,
                      layoutMode: 'HORIZONTAL', itemSpacing: 8,
                      children: ['5 min', '15 min', '30 min', '1 hour', '1 day'].map((t, i) => ({
                        type: 'FRAME' as const, name: `Rem-${t}`, width: 80, height: 32,
                        fill: i === 1 || i === 2 ? C.primary : C.muted, cornerRadius: 8,
                        layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                        children: [{ type: 'TEXT' as const, name: `RL-${t}`, width: 60, height: 14, text: t, fontSize: 12, fill: i === 1 || i === 2 ? '#ffffff' : C.foreground }],
                      })),
                    },
                    { type: 'TEXT', name: 'RemInfo', width: 1052, height: 14, text: 'Selected: 15 minutes, 30 minutes before meetings', fontSize: 11, fill: C.mutedForeground },
                  ],
                },
                // Privacy section
                { type: 'RECTANGLE', name: 'Divider', width: 1100, height: 1, fill: C.border },
                { type: 'TEXT', name: 'PTitle', width: 1100, height: 32, text: 'Privacy Settings', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
                // Email visibility
                {
                  type: 'FRAME', name: 'EmailVis', width: 1100, height: 60,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 20,
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    _toggleSwitch(false),
                    { type: 'TEXT', name: 'EVLabel', width: 300, height: 16, text: 'Show email address publicly', fontSize: 14, fill: C.foreground },
                    { type: 'TEXT', name: 'EVInfo', width: 400, height: 14, text: 'When off, only admins can see your email', fontSize: 12, fill: C.mutedForeground },
                  ],
                },
                // Cardano wallet
                {
                  type: 'FRAME', name: 'CardanoWallet', width: 1100, height: 130,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 20,
                  children: [
                    { type: 'TEXT', name: 'CWTitle', width: 1060, height: 22, text: 'Cardano Wallet', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'CWConnected', width: 1060, height: 52,
                      fill: '#0f1f0f', stroke: '#16a34a', strokeWeight: 1, cornerRadius: 8,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 12,
                      counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'ELLIPSE', name: 'CWIcon', width: 24, height: 24, fill: '#2563eb' },
                        { type: 'TEXT', name: 'CWAddr', width: 400, height: 14, text: 'addr1qxy2...z3kf (Nami)', fontSize: 12, fill: C.foreground },
                        _statusBadge('Linked', '#16a34a'),
                        button('Unlink', 'secondary'),
                      ],
                    },
                  ],
                },
                // Account linking
                {
                  type: 'FRAME', name: 'AccountLink', width: 1100, height: 100,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 20,
                  children: [
                    { type: 'TEXT', name: 'ALTitle', width: 1060, height: 18, text: 'Linked Accounts', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'ALList', width: 1060, height: 40,
                      layoutMode: 'HORIZONTAL', itemSpacing: 16,
                      children: [
                        _linkedAccount('Google', '#4285f4', true),
                        _linkedAccount('Discord', '#5865F2', true),
                        _linkedAccount('GitHub', '#333333', false),
                      ],
                    },
                  ],
                },
                // Profile visibility
                {
                  type: 'FRAME', name: 'ProfileVis', width: 1100, height: 80,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 20,
                  children: [
                    { type: 'TEXT', name: 'PVTitle', width: 1060, height: 18, text: 'Profile Visibility', fontSize: 14, fontWeight: 'Bold', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'PVOptions', width: 1060, height: 28,
                      layoutMode: 'HORIZONTAL', itemSpacing: 8,
                      children: ['Public', 'Members Only', 'Private'].map((v, i) => ({
                        type: 'FRAME' as const, name: `PV-${v}`, width: 120, height: 28,
                        fill: i === 1 ? C.primary : C.muted, cornerRadius: 6,
                        layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                        children: [{ type: 'TEXT' as const, name: `PVL-${v}`, width: 100, height: 14, text: v, fontSize: 12, fill: i === 1 ? '#ffffff' : C.foreground }],
                      })),
                    },
                  ],
                },
                // Legal links + data sharing
                {
                  type: 'FRAME', name: 'LegalSection', width: 1100, height: 80,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'HORIZONTAL', itemSpacing: 20, padding: 20,
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'LegalLabel', width: 60, height: 16, text: 'Legal:', fontSize: 13, fill: C.mutedForeground },
                    { type: 'TEXT', name: 'TOS', width: 120, height: 16, text: 'Terms of Service', fontSize: 13, fill: C.primary },
                    { type: 'TEXT', name: 'PP', width: 120, height: 16, text: 'Privacy Policy', fontSize: 13, fill: C.primary },
                    { type: 'TEXT', name: 'DataReq', width: 160, height: 16, text: 'Request Data Export', fontSize: 13, fill: C.primary },
                  ],
                },
                // Delete account (danger zone)
                {
                  type: 'FRAME', name: 'DangerZone', width: 1100, height: 100,
                  fill: '#1f0a0a', stroke: '#dc2626', strokeWeight: 1, cornerRadius: 12,
                  layoutMode: 'VERTICAL', itemSpacing: 10, padding: 20,
                  children: [
                    { type: 'TEXT', name: 'DZTitle', width: 1060, height: 22, text: 'Danger Zone', fontSize: 18, fontWeight: 'Bold', fill: '#fca5a5' },
                    {
                      type: 'FRAME', name: 'DZRow', width: 1060, height: 36,
                      layoutMode: 'HORIZONTAL', itemSpacing: 16, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'DZDesc', width: 600, height: 14, text: 'Permanently delete your account and all associated data', fontSize: 13, fill: '#fca5a5' },
                        {
                          type: 'FRAME', name: 'DeleteBtn', width: 160, height: 36,
                          fill: '#dc2626', cornerRadius: 8,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'DelLabel', width: 120, height: 14, text: 'Delete Account', fontSize: 13, fontWeight: 'Bold', fill: '#ffffff' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _linkedAccount(name: string, color: string, connected: boolean): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `LA-${name}`, width: 200, height: 40,
    fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
    layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: { top: 8, right: 12, bottom: 8, left: 12 },
    counterAxisAlignItems: 'CENTER',
    children: [
      { type: 'ELLIPSE', name: `LAI-${name}`, width: 20, height: 20, fill: color },
      { type: 'TEXT', name: `LAN-${name}`, width: 80, height: 14, text: name, fontSize: 12, fill: C.foreground },
      { type: 'TEXT', name: `LAS-${name}`, width: 60, height: 12, text: connected ? 'Linked' : 'Link', fontSize: 11, fill: connected ? '#4ade80' : C.primary },
    ],
  }
}

function pu11_FeedbackFull(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-11 Feedback (Full Admin)',
    description: 'Submit form, filters, expanded item with admin response, status buttons, sentiment, AI tab',
    transitionLabel: 'opens Events Calendar',
    frame: {
      type: 'FRAME', name: 'PU-Feedback', width: PW, height: 1500, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1436, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1280, height: 32, text: 'Feedback', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
            // Tabs: User Feedback | AI Feedback
            {
              type: 'FRAME', name: 'FBTabs', width: 1280, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              children: ['User Feedback', 'AI Feedback'].map((t, i) => ({
                type: 'FRAME' as const, name: `FBTab-${t}`, width: 200, height: 40,
                stroke: i === 0 ? C.primary : C.border, strokeWeight: i === 0 ? 2 : 1,
                layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                children: [{ type: 'TEXT' as const, name: `FBL-${t}`, width: 160, height: 16, text: t, fontSize: 13, fontWeight: i === 0 ? 'Bold' as const : 'Regular' as const, fill: i === 0 ? C.primary : C.mutedForeground }],
              })),
            },
            // Submit form
            {
              type: 'FRAME', name: 'SubmitForm', width: 1280, height: 200,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 12, padding: 20,
              children: [
                { type: 'TEXT', name: 'SFTitle', width: 1240, height: 22, text: 'Submit Feedback', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                inputField('Category (select)', 400),
                {
                  type: 'FRAME', name: 'SFBody', width: 1240, height: 70,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    { type: 'TEXT', name: 'SFBLabel', width: 1240, height: 14, text: 'Your Feedback', fontSize: 12, fontWeight: 'Medium', fill: C.foreground },
                    { type: 'RECTANGLE', name: 'SFBArea', width: 1240, height: 50, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8 },
                  ],
                },
                {
                  type: 'FRAME', name: 'SFActions', width: 1240, height: 36,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12,
                  children: [
                    _toggleSwitch(false),
                    { type: 'TEXT', name: 'AnonLabel', width: 160, height: 14, text: 'Submit anonymously', fontSize: 13, fill: C.foreground },
                    button('Submit Feedback'),
                  ],
                },
              ],
            },
            // Filters
            {
              type: 'FRAME', name: 'Filters', width: 1280, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'StatusFilter', width: 200, height: 36,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 8, right: 10, bottom: 8, left: 10 },
                  children: [{ type: 'TEXT', name: 'SFVal', width: 180, height: 16, text: 'All Statuses', fontSize: 12, fill: C.foreground }],
                },
                {
                  type: 'FRAME', name: 'CatFilter', width: 200, height: 36,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 8, right: 10, bottom: 8, left: 10 },
                  children: [{ type: 'TEXT', name: 'CFVal', width: 180, height: 16, text: 'All Categories', fontSize: 12, fill: C.foreground }],
                },
                {
                  type: 'FRAME', name: 'SortToggle', width: 160, height: 36,
                  fill: C.muted, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'SortLabel', width: 100, height: 14, text: 'Sort: Newest', fontSize: 12, fill: C.foreground }],
                },
                { type: 'TEXT', name: 'Count', width: 160, height: 14, text: '14 feedback items', fontSize: 12, fill: C.mutedForeground },
              ],
            },
            // Feedback list
            // Item 1: collapsed
            {
              type: 'FRAME', name: 'FBItem1', width: 1280, height: 80,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 16,
              counterAxisAlignItems: 'CENTER',
              children: [
                _statusBadge('Open', '#eab308'),
                {
                  type: 'FRAME', name: 'FBI1Content', width: 900, height: 48,
                  layoutMode: 'VERTICAL', itemSpacing: 4,
                  children: [
                    { type: 'TEXT', name: 'FBI1Title', width: 900, height: 18, text: 'Feature Request: Export calendar data as CSV', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                    { type: 'TEXT', name: 'FBI1Meta', width: 900, height: 14, text: 'Tevo - Mar 14, 2026 - Bug Report', fontSize: 11, fill: C.mutedForeground },
                  ],
                },
                { type: 'TEXT', name: 'FBI1Exp', width: 60, height: 14, text: 'Expand', fontSize: 11, fill: C.primary },
              ],
            },
            // Item 2: EXPANDED with admin response
            {
              type: 'FRAME', name: 'FBItem2Expanded', width: 1280, height: 400,
              fill: C.card, stroke: C.primary, strokeWeight: 2, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 12, padding: 20,
              children: [
                {
                  type: 'FRAME', name: 'FBI2Header', width: 1240, height: 28,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                  children: [
                    _statusBadge('In Review', '#3b82f6'),
                    { type: 'TEXT', name: 'FBI2Title', width: 600, height: 20, text: 'Timezone display is confusing in calendar grid', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'FBI2Col', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                  ],
                },
                { type: 'TEXT', name: 'FBI2Meta', width: 1240, height: 14, text: 'Alice - Mar 12, 2026 - UX Improvement - Source: Web App', fontSize: 11, fill: C.mutedForeground },
                // Full message
                {
                  type: 'FRAME', name: 'FBI2Body', width: 1240, height: 60,
                  fill: C.background, cornerRadius: 8, padding: 12,
                  children: [{ type: 'TEXT', name: 'FBI2Text', width: 1216, height: 36, text: 'The timezone labels on the calendar grid are hard to read. They overlap with the time labels and the contrast is too low. Also, when switching between timezones, the grid does not immediately update.', fontSize: 13, fill: C.foreground }],
                },
                // Admin response field
                {
                  type: 'FRAME', name: 'AdminResponse', width: 1240, height: 100,
                  fill: '#1e3a5f', stroke: '#2563eb', strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 6, padding: 12,
                  children: [
                    { type: 'TEXT', name: 'ARLabel', width: 1216, height: 16, text: 'Admin Response', fontSize: 12, fontWeight: 'Bold', fill: '#93c5fd' },
                    { type: 'RECTANGLE', name: 'ARInput', width: 1216, height: 40, fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6 },
                    { type: 'TEXT', name: 'ARInfo', width: 1216, height: 12, text: 'Previous response by Tevo on Mar 13: "Thanks for the report, looking into this."', fontSize: 10, fill: '#bfdbfe' },
                  ],
                },
                // Status progression buttons
                {
                  type: 'FRAME', name: 'StatusButtons', width: 1240, height: 36,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8,
                  children: [
                    { type: 'TEXT', name: 'SBLabel', width: 80, height: 14, text: 'Set Status:', fontSize: 12, fill: C.mutedForeground },
                    ...['Open', 'In Review', 'Planned', 'In Progress', 'Completed', 'Declined'].map((s, i) => {
                      const colors = ['#eab308', '#3b82f6', '#8b5cf6', '#0891b2', '#16a34a', '#dc2626']
                      return {
                        type: 'FRAME' as const, name: `SB-${s}`, width: 100, height: 32,
                        fill: i === 1 ? colors[i] : C.background, stroke: colors[i], strokeWeight: 1, cornerRadius: 6,
                        layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                        children: [{ type: 'TEXT' as const, name: `SBL-${s}`, width: 80, height: 12, text: s, fontSize: 10, fill: i === 1 ? '#ffffff' : colors[i] }],
                      }
                    }),
                  ],
                },
                // Sentiment visualisation
                {
                  type: 'FRAME', name: 'SentimentVis', width: 1240, height: 80,
                  fill: '#1a0a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 20, padding: 14,
                  counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'SVLabel', width: 80, height: 14, text: 'Sentiment:', fontSize: 12, fontWeight: 'Medium', fill: '#a78bfa' },
                    {
                      type: 'FRAME', name: 'SentGridMini', width: 100, height: 60,
                      fill: C.background, cornerRadius: 6, stroke: C.border, strokeWeight: 1,
                      layoutMode: 'VERTICAL', itemSpacing: 0,
                      children: Array.from({ length: 5 }, (_, r) => ({
                        type: 'FRAME' as const, name: `SM-${r}`, width: 100, height: 12,
                        layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                        children: Array.from({ length: 5 }, (_, c) => ({
                          type: 'RECTANGLE' as const, name: `SMC-${r}-${c}`, width: 20, height: 12,
                          fill: (r === 1 && c === 3) ? '#16a34a' : C.muted,
                          stroke: C.border, strokeWeight: 0.5,
                        })),
                      })),
                    },
                    { type: 'TEXT', name: 'SVResult', width: 200, height: 14, text: 'Good + Trust (avg from 3 votes)', fontSize: 12, fill: '#4ade80' },
                  ],
                },
              ],
            },
            // Item 3: Completed (collapsed)
            {
              type: 'FRAME', name: 'FBItem3', width: 1280, height: 80,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 16,
              counterAxisAlignItems: 'CENTER',
              children: [
                _statusBadge('Completed', '#16a34a'),
                {
                  type: 'FRAME', name: 'FBI3Content', width: 900, height: 48,
                  layoutMode: 'VERTICAL', itemSpacing: 4,
                  children: [
                    { type: 'TEXT', name: 'FBI3Title', width: 900, height: 18, text: 'Add dark mode toggle to landing page', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                    { type: 'TEXT', name: 'FBI3Meta', width: 900, height: 14, text: 'Bob - Mar 8, 2026 - Feature Request', fontSize: 11, fill: C.mutedForeground },
                  ],
                },
                { type: 'TEXT', name: 'FBI3Exp', width: 60, height: 14, text: 'Expand', fontSize: 11, fill: C.primary },
              ],
            },
            // AI Feedback section preview
            {
              type: 'FRAME', name: 'AIFeedbackSection', width: 1280, height: 200,
              fill: '#1a0a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 12, padding: 20,
              children: [
                { type: 'TEXT', name: 'AIFBTitle', width: 1240, height: 22, text: 'AI Feedback (Oversight)', fontSize: 16, fontWeight: 'Bold', fill: '#a78bfa' },
                { type: 'TEXT', name: 'AIFBDesc', width: 1240, height: 14, text: 'Rate AI responses across conversations to improve model behavior', fontSize: 12, fill: '#c4b5fd' },
                {
                  type: 'FRAME', name: 'AIFBItem', width: 1240, height: 100,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 6, padding: 12,
                  children: [
                    { type: 'TEXT', name: 'AIFBQ', width: 1216, height: 14, text: 'Q: "Set my availability to business hours" - Calendar AI', fontSize: 12, fill: C.foreground },
                    { type: 'TEXT', name: 'AIFBA', width: 1216, height: 14, text: 'A: "Done! Time range set to 9:00-17:00 and weekends skipped."', fontSize: 12, fill: C.mutedForeground },
                    {
                      type: 'FRAME', name: 'AIFBRating', width: 1216, height: 32,
                      layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'RateLabel', width: 60, height: 14, text: 'Rating:', fontSize: 12, fill: C.mutedForeground },
                        {
                          type: 'FRAME', name: 'RateMini', width: 80, height: 28,
                          fill: '#14532d', cornerRadius: 6, stroke: '#16a34a', strokeWeight: 1,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'RateVal', width: 60, height: 14, text: 'Good', fontSize: 12, fill: '#4ade80' }],
                        },
                        { type: 'TEXT', name: 'RateDetail', width: 200, height: 12, text: 'Trust: High | Context: Calendar', fontSize: 10, fill: C.mutedForeground },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function pu12_EventsCalendar(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-12 Events Calendar',
    description: 'Weekly grid with events, details panel expanded, Google sync picker, overflow popover, network filter',
    transitionLabel: 'Events Discovery',
    frame: {
      type: 'FRAME', name: 'PU-EventsCal', width: PW, height: 1200, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1136,
          layoutMode: 'HORIZONTAL', itemSpacing: 0,
          children: [
            // Main calendar area
            {
              type: 'FRAME', name: 'CalArea', width: PW - 400, height: 1136,
              layoutMode: 'VERTICAL', itemSpacing: 12,
              padding: { top: 16, right: 20, bottom: 16, left: 60 },
              children: [
                // Header
                {
                  type: 'FRAME', name: 'Header', width: 960, height: 44,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'Title', width: 200, height: 28, text: 'Events Calendar', fontSize: 22, fontWeight: 'Bold', fill: C.foreground },
                    // Week nav
                    { type: 'RECTANGLE', name: 'Prev', width: 32, height: 32, fill: C.muted, cornerRadius: 8 },
                    { type: 'TEXT', name: 'WeekLabel', width: 200, height: 20, text: 'Mar 16 - Mar 22, 2026', fontSize: 14, fontWeight: 'Medium', fill: C.foreground },
                    { type: 'RECTANGLE', name: 'Next', width: 32, height: 32, fill: C.muted, cornerRadius: 8 },
                    button('Today', 'secondary'),
                    // UTC clock
                    {
                      type: 'FRAME', name: 'UTCClock', width: 120, height: 28,
                      fill: '#1a1a2e', cornerRadius: 9999, padding: { top: 4, right: 12, bottom: 4, left: 12 },
                      layoutMode: 'HORIZONTAL', itemSpacing: 4, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'ELLIPSE', name: 'ClockDot', width: 6, height: 6, fill: '#4ade80' },
                        { type: 'TEXT', name: 'ClockVal', width: 80, height: 14, text: '14:32 UTC', fontSize: 11, fontWeight: 'Medium', fill: C.foreground },
                      ],
                    },
                  ],
                },
                // Network filter
                {
                  type: 'FRAME', name: 'NetworkFilter', width: 960, height: 32,
                  layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'NFLabel', width: 70, height: 14, text: 'Networks:', fontSize: 12, fill: C.mutedForeground },
                    ...['All', 'Cardano', 'Ethereum', 'Polkadot', 'Other'].map((n, i) => ({
                      type: 'FRAME' as const, name: `NF-${n}`, width: 80, height: 28,
                      fill: i === 0 ? C.primary : C.muted, cornerRadius: 9999,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                      children: [{ type: 'TEXT' as const, name: `NFL-${n}`, width: 60, height: 12, text: n, fontSize: 11, fill: i === 0 ? '#ffffff' : C.foreground }],
                    })),
                  ],
                },
                // Weekly grid
                {
                  type: 'FRAME', name: 'WeekGrid', width: 960, height: 840,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 0,
                  children: [
                    // Day headers
                    {
                      type: 'FRAME', name: 'DayHeaders', width: 960, height: 44,
                      fill: C.muted, stroke: C.border, strokeWeight: 1,
                      layoutMode: 'HORIZONTAL', itemSpacing: 0,
                      children: [
                        { type: 'FRAME', name: 'TimeColH', width: 60, height: 44, children: [] },
                        ...['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20', 'Sat 21', 'Sun 22'].map(d => ({
                          type: 'FRAME' as const, name: `DH-${d}`, width: 128, height: 44,
                          stroke: C.border, strokeWeight: 0.5,
                          layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                          children: [{ type: 'TEXT' as const, name: `DHL-${d}`, width: 60, height: 16, text: d, fontSize: 12, fontWeight: 'Medium' as const, fill: C.foreground }],
                        })),
                      ],
                    },
                    // Time rows with event blocks
                    ...['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((time, rowIdx) => ({
                      type: 'FRAME' as const, name: `TR-${time}`, width: 960, height: 60,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                      children: [
                        { type: 'TEXT' as const, name: `TL-${time}`, width: 60, height: 60, text: time, fontSize: 10, fill: C.mutedForeground },
                        ...Array.from({ length: 7 }, (_, colIdx) => {
                          // Place some events
                          const hasEvent = (colIdx === 2 && rowIdx === 2) || (colIdx === 4 && rowIdx === 6)
                          return {
                            type: 'FRAME' as const, name: `Cell-${time}-${colIdx}`, width: 128, height: 60,
                            stroke: C.border, strokeWeight: 0.5,
                            children: hasEvent ? [{
                              type: 'FRAME' as const, name: `Ev-${time}-${colIdx}`, width: 120, height: 52,
                              x: 4, y: 4,
                              fill: colIdx === 2 ? '#1e3a5f' : '#2d1f0f', cornerRadius: 6,
                              stroke: colIdx === 2 ? '#3b82f6' : '#d97706', strokeWeight: 1,
                              padding: 6,
                              children: [
                                { type: 'TEXT' as const, name: `EvT-${time}-${colIdx}`, width: 108, height: 14, text: colIdx === 2 ? 'Governance Call' : 'Hackathon', fontSize: 10, fontWeight: 'Bold' as const, fill: colIdx === 2 ? '#93c5fd' : '#fbbf24' },
                                { type: 'TEXT' as const, name: `EvN-${time}-${colIdx}`, width: 108, height: 12, text: colIdx === 2 ? 'Cardano' : 'Multi-chain', fontSize: 9, fill: C.mutedForeground },
                              ],
                            }] : [],
                          }
                        }),
                      ],
                    })),
                  ],
                },
                // Overflow popover
                {
                  type: 'FRAME', name: 'OverflowPopover', width: 200, height: 100,
                  fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'VERTICAL', itemSpacing: 4, padding: 8,
                  children: [
                    { type: 'TEXT', name: 'OPTitle', width: 184, height: 14, text: 'Wed 18 - 3 more events:', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    ...['DAO Review 11:00', 'Tech Talk 13:00', 'Social Hour 17:00'].map(e => ({
                      type: 'TEXT' as const, name: `OP-${e}`, width: 184, height: 16, text: e, fontSize: 11, fill: C.primary,
                    })),
                  ],
                },
              ],
            },
            // Event details panel (right)
            {
              type: 'FRAME', name: 'DetailsPanel', width: 400, height: 1136,
              fill: C.card, stroke: C.border, strokeWeight: 1,
              layoutMode: 'VERTICAL', itemSpacing: 14, padding: 20,
              children: [
                {
                  type: 'FRAME', name: 'DPHeader', width: 360, height: 28,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'DPTitle', width: 280, height: 22, text: 'Event Details', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'RECTANGLE', name: 'DPClose', width: 24, height: 24, fill: C.muted, cornerRadius: 6 },
                  ],
                },
                { type: 'RECTANGLE', name: 'DPDiv', width: 360, height: 1, fill: C.border },
                // Event info
                { type: 'TEXT', name: 'EvName', width: 360, height: 24, text: 'Governance Call', fontSize: 18, fontWeight: 'Bold', fill: C.foreground },
                {
                  type: 'FRAME', name: 'EvNetBadge', width: 100, height: 24,
                  fill: '#1e3a5f', cornerRadius: 9999, padding: { top: 4, right: 10, bottom: 4, left: 10 },
                  layoutMode: 'HORIZONTAL', itemSpacing: 4, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'NBI', width: 8, height: 8, fill: '#3b82f6' },
                    { type: 'TEXT', name: 'NBL', width: 60, height: 12, text: 'Cardano', fontSize: 10, fill: '#93c5fd' },
                  ],
                },
                { type: 'TEXT', name: 'EvDate', width: 360, height: 16, text: 'Wednesday, March 18, 2026', fontSize: 13, fill: C.mutedForeground },
                { type: 'TEXT', name: 'EvTime', width: 360, height: 16, text: '10:00 - 11:30 UTC (1h 30m)', fontSize: 13, fill: C.foreground },
                // Description
                {
                  type: 'FRAME', name: 'EvDesc', width: 360, height: 80,
                  fill: C.background, cornerRadius: 8, padding: 12,
                  children: [
                    { type: 'TEXT', name: 'EvDescText', width: 336, height: 56, text: 'Monthly governance review meeting to discuss proposals, vote on catalyst funding, and review community metrics.', fontSize: 12, fill: C.foreground },
                  ],
                },
                // Link
                {
                  type: 'FRAME', name: 'EvLink', width: 360, height: 36,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 8, right: 12, bottom: 8, left: 12 },
                  children: [{ type: 'TEXT', name: 'EvLinkText', width: 336, height: 14, text: 'https://meet.google.com/abc-def-ghi', fontSize: 11, fill: C.primary }],
                },
                // Action buttons
                button('Add to Google Calendar', 'secondary'),
                button('Download .ics', 'secondary'),
                // Google sync picker EXPANDED
                {
                  type: 'FRAME', name: 'SyncPicker', width: 360, height: 160,
                  fill: '#0f1f0f', stroke: '#16a34a', strokeWeight: 1, cornerRadius: 10,
                  layoutMode: 'VERTICAL', itemSpacing: 8, padding: 14,
                  children: [
                    { type: 'TEXT', name: 'SyncTitle', width: 332, height: 16, text: 'Sync to Google Calendar', fontSize: 13, fontWeight: 'Bold', fill: '#4ade80' },
                    { type: 'TEXT', name: 'SyncDesc', width: 332, height: 14, text: 'Select calendars to add this event:', fontSize: 11, fill: '#bbf7d0' },
                    ...['Primary Calendar', 'Work Events', 'Shared Team Calendar'].map((cal, i) => ({
                      type: 'FRAME' as const, name: `Sync-${cal}`, width: 332, height: 24,
                      layoutMode: 'HORIZONTAL' as const, itemSpacing: 8, counterAxisAlignItems: 'CENTER' as const,
                      children: [
                        { type: 'RECTANGLE' as const, name: `SyncCB-${i}`, width: 18, height: 18, fill: i === 0 ? C.primary : C.muted, cornerRadius: 4, stroke: C.border, strokeWeight: 1 },
                        { type: 'TEXT' as const, name: `SyncCL-${i}`, width: 280, height: 14, text: cal, fontSize: 12, fill: C.foreground },
                      ],
                    })),
                    button('Sync Selected'),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function pu13_EventsDiscovery(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-13 Events Discovery',
    description: 'All 4 collapsible sections expanded with cards, search, month filter, learner guide',
    transitionLabel: 'opens AI Chat',
    frame: {
      type: 'FRAME', name: 'PU-EventsDisc', width: PW, height: 1800, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1736, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1280, height: 32, text: 'Events', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
            // Search + filters
            {
              type: 'FRAME', name: 'SearchRow', width: 1280, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'SearchInput', width: 400, height: 40,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 10, right: 12, bottom: 10, left: 12 },
                  children: [{ type: 'TEXT', name: 'SearchPH', width: 376, height: 16, text: 'Search events...', fontSize: 13, fill: C.placeholder }],
                },
                // Month filter
                {
                  type: 'FRAME', name: 'MonthFilter', width: 200, height: 40,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 10, right: 12, bottom: 10, left: 12 },
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'TEXT', name: 'MonthVal', width: 140, height: 16, text: 'March 2026', fontSize: 13, fill: C.foreground },
                    { type: 'TEXT', name: 'MonthArrow', width: 12, height: 16, text: 'v', fontSize: 12, fill: C.mutedForeground },
                  ],
                },
                button('Calendar View', 'secondary'),
              ],
            },
            // Learner guide
            {
              type: 'FRAME', name: 'LearnerGuide', width: 1280, height: 60,
              fill: '#1e3a5f', stroke: '#2563eb', strokeWeight: 1, cornerRadius: 10,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: 16,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'InfoIcon', width: 20, height: 20, fill: '#3b82f6' },
                { type: 'TEXT', name: 'GuideText', width: 1100, height: 28, text: 'Browse active and public coordination calendars. Create your own calendar to start coordinating with your group. Past calendars are kept for reference and can be reactivated.', fontSize: 12, fill: '#bfdbfe' },
                { type: 'TEXT', name: 'Dismiss', width: 60, height: 14, text: 'Dismiss', fontSize: 11, fill: '#60a5fa' },
              ],
            },
            // Section 1: Your Active Calendars (expanded)
            _eventsSection('Your Active Calendars', 'expanded', [
              _eventDiscoveryCard('Weekly Team Standup', '5 participants', 'Wed 10:00', 'Active', '#16a34a'),
              _eventDiscoveryCard('Sprint Planning', '6 participants', 'Mon 09:00', 'Active', '#16a34a'),
              _eventDiscoveryCard('1:1 Check-ins', '2 participants', 'Flexible', 'Active', '#16a34a'),
            ]),
            // Section 2: Public Calendars (expanded)
            _eventsSection('Public Calendars', 'expanded', [
              _eventDiscoveryCard('DAO Governance', '12 participants', 'Tue, Thu 14:00', 'Public', '#3b82f6'),
              _eventDiscoveryCard('Community Call', '8 participants', 'Sat 16:00', 'Public', '#3b82f6'),
              _eventDiscoveryCard('Ambassador Hours', '4 participants', 'Fri 11:00', 'Public', '#3b82f6'),
            ]),
            // Section 3: Your Past Calendars (expanded)
            _eventsSection('Your Past Calendars', 'expanded', [
              _eventDiscoveryCard('Q4 Retrospective', '7 participants', 'Completed Dec 2025', 'Archived', '#71717a'),
              _eventDiscoveryCard('Holiday Planning', '3 participants', 'Completed Jan 2026', 'Archived', '#71717a'),
            ]),
            // Section 4: Public Past Calendars (expanded)
            _eventsSection('Public Past Calendars', 'expanded', [
              _eventDiscoveryCard('Summit 2025', '45 participants', 'Completed Nov 2025', 'Archived', '#71717a'),
              _eventDiscoveryCard('Hackathon Q3', '22 participants', 'Completed Sep 2025', 'Archived', '#71717a'),
            ]),
          ],
        },
      ],
    },
  }
}

function _eventsSection(title: string, state: string, cards: WireframeNode[]): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  const cardH = 200
  return {
    type: 'FRAME', name: `Sec-${title}`, width: 1280, height: state === 'expanded' ? 60 + cardH : 50,
    layoutMode: 'VERTICAL', itemSpacing: 10,
    children: [
      {
        type: 'FRAME', name: `SH-${title}`, width: 1280, height: 32,
        layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
        children: [
          { type: 'TEXT', name: `ST-${title}`, width: 400, height: 22, text: `${title} (${cards.length})`, fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
          { type: 'TEXT', name: `SC-${title}`, width: 60, height: 14, text: state === 'expanded' ? 'Collapse' : 'Expand', fontSize: 11, fill: C.primary },
        ],
      },
      ...(state === 'expanded' ? [{
        type: 'FRAME' as const, name: `SCards-${title}`, width: 1280, height: cardH,
        layoutMode: 'HORIZONTAL' as const, itemSpacing: 16,
        children: cards,
      }] : []),
    ],
  }
}

function _eventDiscoveryCard(title: string, participants: string, schedule: string, status: string, statusColor: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `EDC-${title}`, width: 400, height: 200,
    fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
    layoutMode: 'VERTICAL', itemSpacing: 8, padding: 16,
    children: [
      {
        type: 'FRAME', name: `EDCH-${title}`, width: 368, height: 28,
        layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
        children: [
          { type: 'TEXT', name: `EDCN-${title}`, width: 240, height: 20, text: title, fontSize: 15, fontWeight: 'Bold', fill: C.foreground },
          _statusBadge(status, statusColor),
        ],
      },
      { type: 'TEXT', name: `EDCP-${title}`, width: 368, height: 16, text: participants, fontSize: 12, fill: C.mutedForeground },
      { type: 'TEXT', name: `EDCS-${title}`, width: 368, height: 16, text: schedule, fontSize: 12, fill: '#93c5fd' },
      { type: 'RECTANGLE', name: `EDCHeat-${title}`, width: 368, height: 48, fill: '#0d1a0d', cornerRadius: 6, stroke: C.border, strokeWeight: 1 },
      {
        type: 'FRAME', name: `EDCA-${title}`, width: 368, height: 32,
        layoutMode: 'HORIZONTAL', itemSpacing: 8,
        children: [button('Open'), button('Details', 'secondary')],
      },
    ],
  }
}

function pu14_AiChat(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-14 AI Chat',
    description: 'Full AI chat with status banner, system prompt expanded, sentiment feedback expanded, messages, clear',
    transitionLabel: 'opens Guardian',
    frame: {
      type: 'FRAME', name: 'PU-AiChat', width: PW, height: 1400, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1336, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 0,
          padding: { top: 16, right: 120, bottom: 16, left: 120 },
          children: [
            // Header
            {
              type: 'FRAME', name: 'ChatHeader', width: 1200, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'AiIcon', width: 32, height: 32, fill: C.primary },
                { type: 'TEXT', name: 'ChatTitle', width: 200, height: 24, text: 'AI Assistant', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
                // Status badge
                {
                  type: 'FRAME', name: 'StatusBadge', width: 120, height: 28,
                  fill: '#14532d', cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL', itemSpacing: 4, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [
                    { type: 'ELLIPSE', name: 'StatusDot', width: 8, height: 8, fill: '#4ade80' },
                    { type: 'TEXT', name: 'StatusLabel', width: 80, height: 12, text: 'Online', fontSize: 11, fill: '#4ade80' },
                  ],
                },
                // Quota display
                { type: 'TEXT', name: 'Quota', width: 200, height: 14, text: 'Quota: 47 / 100 messages today', fontSize: 11, fill: C.mutedForeground },
                button('Clear History', 'secondary'),
              ],
            },
            // Status alert banner
            {
              type: 'FRAME', name: 'AlertBanner', width: 1200, height: 44,
              fill: '#1a1a0e', stroke: '#eab308', strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 8, padding: 12,
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'ELLIPSE', name: 'AlertIcon', width: 16, height: 16, fill: '#eab308' },
                { type: 'TEXT', name: 'AlertText', width: 1100, height: 16, text: 'AI responses are generated using GPT-4o. Please verify important information independently.', fontSize: 12, fill: '#fde68a' },
              ],
            },
            // Messages area
            {
              type: 'FRAME', name: 'MessagesArea', width: 1200, height: 1100,
              layoutMode: 'VERTICAL', itemSpacing: 16, padding: { top: 16, right: 0, bottom: 16, left: 0 },
              children: [
                // System prompt display EXPANDED
                {
                  type: 'FRAME', name: 'SystemPrompt', width: 1200, height: 100,
                  fill: '#1a1a0e', stroke: '#92400e', strokeWeight: 1, cornerRadius: 10,
                  layoutMode: 'VERTICAL', itemSpacing: 6, padding: 14,
                  children: [
                    {
                      type: 'FRAME', name: 'SPHeader', width: 1172, height: 18,
                      layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'SPTitle', width: 200, height: 16, text: 'System Prompt (Oversight)', fontSize: 12, fontWeight: 'Bold', fill: '#fbbf24' },
                        { type: 'TEXT', name: 'SPCollapse', width: 60, height: 12, text: 'Collapse', fontSize: 10, fill: '#fbbf24' },
                      ],
                    },
                    { type: 'TEXT', name: 'SPBody', width: 1172, height: 52, text: 'You are an AI assistant for the Coordination Manager platform. Help users with scheduling, announcements, feedback, and general coordination questions. You have access to calendar data, meeting records, and public event information. Always be helpful and concise.', fontSize: 11, fill: '#fde68a' },
                  ],
                },
                // Message 1: User
                {
                  type: 'FRAME', name: 'UserMsg1', width: 1200, height: 50,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'MAX',
                  children: [{
                    type: 'FRAME', name: 'UBubble1', width: 500, height: 50,
                    fill: C.primary, cornerRadius: 16, padding: 14,
                    children: [{ type: 'TEXT', name: 'UT1', width: 472, height: 22, text: 'What are the upcoming meetings for this week?', fontSize: 14, fill: '#ffffff' }],
                  }],
                },
                // Message 2: AI response
                {
                  type: 'FRAME', name: 'AiMsg1', width: 1200, height: 120,
                  layoutMode: 'VERTICAL', itemSpacing: 6,
                  children: [
                    {
                      type: 'FRAME', name: 'ABubble1', width: 700, height: 80,
                      fill: C.muted, cornerRadius: 16, padding: 14,
                      children: [{ type: 'TEXT', name: 'AT1', width: 672, height: 52, text: 'You have 2 meetings this week:\n1. Group A - Wed 10:00-12:00 (Weekly)\n2. Group B - Thu 14:00-16:00 (Biweekly)\nBoth are confirmed with Google Meet links.', fontSize: 13, fill: C.foreground }],
                    },
                    // Sentiment feedback EXPANDED
                    {
                      type: 'FRAME', name: 'SentExpanded1', width: 700, height: 30,
                      layoutMode: 'HORIZONTAL', itemSpacing: 8, counterAxisAlignItems: 'CENTER',
                      children: [
                        { type: 'TEXT', name: 'RateLabel1', width: 80, height: 14, text: 'Rate this:', fontSize: 11, fill: C.mutedForeground },
                        {
                          type: 'FRAME', name: 'ThumbUp1', width: 28, height: 28,
                          fill: '#14532d', cornerRadius: 6,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'TU1', width: 14, height: 14, text: '+', fontSize: 14, fill: '#4ade80' }],
                        },
                        {
                          type: 'FRAME', name: 'ThumbDown1', width: 28, height: 28,
                          fill: C.muted, cornerRadius: 6,
                          layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                          children: [{ type: 'TEXT', name: 'TD1', width: 14, height: 14, text: '-', fontSize: 14, fill: C.mutedForeground }],
                        },
                        { type: 'TEXT', name: 'SentExpand1', width: 100, height: 12, text: 'Expand Details', fontSize: 10, fill: C.primary },
                      ],
                    },
                  ],
                },
                // Message 3: User
                {
                  type: 'FRAME', name: 'UserMsg2', width: 1200, height: 50,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'MAX',
                  children: [{
                    type: 'FRAME', name: 'UBubble2', width: 450, height: 50,
                    fill: C.primary, cornerRadius: 16, padding: 14,
                    children: [{ type: 'TEXT', name: 'UT2', width: 422, height: 22, text: 'Send a reminder to all participants of Group A', fontSize: 14, fill: '#ffffff' }],
                  }],
                },
                // Message 4: AI response with FULL sentiment expanded
                {
                  type: 'FRAME', name: 'AiMsg2', width: 1200, height: 350,
                  layoutMode: 'VERTICAL', itemSpacing: 8,
                  children: [
                    {
                      type: 'FRAME', name: 'ABubble2', width: 700, height: 70,
                      fill: C.muted, cornerRadius: 16, padding: 14,
                      children: [{ type: 'TEXT', name: 'AT2', width: 672, height: 42, text: 'I have drafted a reminder announcement for the Group A meeting (Wed 10:00-12:00). I can send it via Discord #general and DM to all 5 participants. Would you like me to proceed?', fontSize: 13, fill: C.foreground }],
                    },
                    // Full sentiment grid expanded
                    {
                      type: 'FRAME', name: 'SentFullExpanded', width: 700, height: 260,
                      fill: '#1a0a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 12,
                      layoutMode: 'VERTICAL', itemSpacing: 10, padding: 14,
                      children: [
                        { type: 'TEXT', name: 'SFETitle', width: 672, height: 16, text: 'Rate this response (Oversight)', fontSize: 12, fontWeight: 'Bold', fill: '#a78bfa' },
                        // 5x5 sentiment grid
                        {
                          type: 'FRAME', name: 'FullSentGrid', width: 672, height: 140,
                          layoutMode: 'HORIZONTAL', itemSpacing: 12,
                          children: [
                            // Y axis label
                            {
                              type: 'FRAME', name: 'YAxis', width: 50, height: 140,
                              layoutMode: 'VERTICAL', itemSpacing: 0, primaryAxisAlignItems: 'SPACE_BETWEEN',
                              children: [
                                { type: 'TEXT', name: 'YTop', width: 50, height: 14, text: 'Good', fontSize: 10, fill: '#4ade80' },
                                { type: 'TEXT', name: 'YMid', width: 50, height: 14, text: 'Neutral', fontSize: 10, fill: C.mutedForeground },
                                { type: 'TEXT', name: 'YBot', width: 50, height: 14, text: 'Bad', fontSize: 10, fill: '#fca5a5' },
                              ],
                            },
                            // Grid
                            {
                              type: 'FRAME', name: 'GridContainer', width: 200, height: 140,
                              layoutMode: 'VERTICAL', itemSpacing: 0,
                              children: Array.from({ length: 5 }, (_, r) => ({
                                type: 'FRAME' as const, name: `SGR-${r}`, width: 200, height: 28,
                                layoutMode: 'HORIZONTAL' as const, itemSpacing: 0,
                                children: Array.from({ length: 5 }, (_, c) => {
                                  const isSelected = r === 0 && c === 4
                                  const inZone = r < 2 && c > 2
                                  return {
                                    type: 'RECTANGLE' as const, name: `SGC-${r}-${c}`, width: 40, height: 28,
                                    fill: isSelected ? '#16a34a' : inZone ? '#14532d' : C.muted,
                                    stroke: C.border, strokeWeight: 0.5, cornerRadius: 2,
                                  }
                                }),
                              })),
                            },
                            // X axis label
                            {
                              type: 'FRAME', name: 'XLabels', width: 200, height: 20,
                              layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'SPACE_BETWEEN',
                              children: [
                                { type: 'TEXT', name: 'XLeft', width: 60, height: 14, text: 'Untrust', fontSize: 10, fill: '#fca5a5' },
                                { type: 'TEXT', name: 'XRight', width: 60, height: 14, text: 'Trust', fontSize: 10, fill: '#4ade80' },
                              ],
                            },
                          ],
                        },
                        // Selected value
                        { type: 'TEXT', name: 'SelVal', width: 672, height: 14, text: 'Selected: Good + Trust', fontSize: 12, fontWeight: 'Medium', fill: '#4ade80' },
                        // Optional feedback text
                        {
                          type: 'FRAME', name: 'FBText', width: 672, height: 36,
                          fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                          padding: { top: 8, right: 12, bottom: 8, left: 12 },
                          children: [{ type: 'TEXT', name: 'FBPh', width: 648, height: 16, text: 'Optional: explain your rating...', fontSize: 12, fill: C.placeholder }],
                        },
                        button('Submit Rating'),
                      ],
                    },
                  ],
                },
                // Message 5: User confirmation
                {
                  type: 'FRAME', name: 'UserMsg3', width: 1200, height: 40,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'MAX',
                  children: [{
                    type: 'FRAME', name: 'UBubble3', width: 180, height: 40,
                    fill: C.primary, cornerRadius: 16, padding: 12,
                    children: [{ type: 'TEXT', name: 'UT3', width: 156, height: 16, text: 'Yes, please send it', fontSize: 14, fill: '#ffffff' }],
                  }],
                },
                // Message 6: AI confirmation
                {
                  type: 'FRAME', name: 'AiMsg3', width: 1200, height: 60,
                  children: [{
                    type: 'FRAME', name: 'ABubble3', width: 600, height: 60,
                    fill: C.muted, cornerRadius: 16, padding: 14,
                    children: [{ type: 'TEXT', name: 'AT3', width: 572, height: 32, text: 'Sent! Reminder delivered to #general and 5 DMs (2 opted out of DMs). All deliveries successful.', fontSize: 13, fill: C.foreground }],
                  }],
                },
              ],
            },
            // Input bar
            {
              type: 'FRAME', name: 'InputBar', width: 1200, height: 56,
              layoutMode: 'HORIZONTAL', itemSpacing: 10, counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'ChatInput', width: 1100, height: 48,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 24,
                  padding: { top: 14, right: 20, bottom: 14, left: 20 },
                  children: [{ type: 'TEXT', name: 'InputPH', width: 1060, height: 16, text: 'Type a message...', fontSize: 14, fill: C.placeholder }],
                },
                {
                  type: 'FRAME', name: 'SendBtn', width: 48, height: 48, fill: C.primary, cornerRadius: 9999,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'SendIcon', width: 16, height: 16, text: '>', fontSize: 16, fontWeight: 'Bold', fill: '#ffffff' }],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function pu15_Guardian(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-15 Guardian Dashboard + Config',
    description: 'Stats cards, flagged messages table, rule groups expanded, rule editor, pattern tester',
    transitionLabel: 'opens Users',
    frame: {
      type: 'FRAME', name: 'PU-Guardian', width: PW, height: 1700, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1636, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1280, height: 32, text: 'Guardian', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
            // Tabs: Dashboard | Configuration
            {
              type: 'FRAME', name: 'GuardTabs', width: 1280, height: 40,
              layoutMode: 'HORIZONTAL', itemSpacing: 0,
              children: ['Dashboard', 'Configuration'].map((t, i) => ({
                type: 'FRAME' as const, name: `GT-${t}`, width: 200, height: 40,
                stroke: i === 0 ? C.primary : C.border, strokeWeight: i === 0 ? 2 : 1,
                layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                children: [{ type: 'TEXT' as const, name: `GTL-${t}`, width: 140, height: 16, text: t, fontSize: 13, fontWeight: i === 0 ? 'Bold' as const : 'Regular' as const, fill: i === 0 ? C.primary : C.mutedForeground }],
              })),
            },
            // Stats cards row
            {
              type: 'FRAME', name: 'StatsRow', width: 1280, height: 100,
              layoutMode: 'HORIZONTAL', itemSpacing: 16,
              children: [
                _statCard('Messages 24h', '1,247', '#4ade80'),
                _statCard('Messages 7d', '8,341', '#93c5fd'),
                _statCard('Flagged 24h', '3', '#fbbf24'),
                _statCard('Flagged 7d', '12', '#fca5a5'),
                _statCard('Unique Users', '89', '#c4b5fd'),
              ],
            },
            // Flagged messages table
            {
              type: 'FRAME', name: 'FlaggedTable', width: 1280, height: 260,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children: [
                { type: 'TEXT', name: 'FTTitle', width: 1280, height: 24, text: 'Flagged Messages', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                // Table header
                {
                  type: 'FRAME', name: 'FTHeader', width: 1280, height: 40,
                  fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, padding: { top: 10, right: 16, bottom: 10, left: 16 },
                  children: [
                    { type: 'TEXT', name: 'FH-User', width: 150, height: 16, text: 'User', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'FH-Channel', width: 150, height: 16, text: 'Channel', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'FH-Message', width: 500, height: 16, text: 'Message (highlighted)', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'FH-Rule', width: 150, height: 16, text: 'Rule Matched', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'FH-Action', width: 100, height: 16, text: 'Action', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                  ],
                },
                // Flagged rows
                ...[
                  ['user123', '#general', 'Hey check out this [suspicious link removed]', 'Link Filter', 'Blocked'],
                  ['scammer42', '#off-topic', 'Free tokens! Go to [phishing attempt]', 'Spam Detect', 'Blocked+Ban'],
                  ['newuser88', '#governance', 'F*** this proposal is terrible', 'Profanity', 'Warned'],
                ].map(([user, channel, msg, rule, action], i) => ({
                  type: 'FRAME' as const, name: `FR-${i}`, width: 1280, height: 48,
                  fill: i % 2 === 0 ? '#1f0a0a' : C.card, stroke: '#dc262640', strokeWeight: 1,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, padding: { top: 12, right: 16, bottom: 12, left: 16 },
                  counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    { type: 'TEXT' as const, name: `FRU-${i}`, width: 150, height: 16, text: user, fontSize: 12, fill: C.foreground },
                    { type: 'TEXT' as const, name: `FRC-${i}`, width: 150, height: 16, text: channel, fontSize: 12, fill: C.mutedForeground },
                    { type: 'TEXT' as const, name: `FRM-${i}`, width: 500, height: 16, text: msg, fontSize: 12, fill: '#fca5a5' },
                    { type: 'TEXT' as const, name: `FRR-${i}`, width: 150, height: 14, text: rule, fontSize: 11, fill: '#fbbf24' },
                    _statusBadge(action, action.includes('Ban') ? '#dc2626' : '#eab308'),
                  ],
                })),
              ],
            },
            // Configuration section
            { type: 'RECTANGLE', name: 'Divider', width: 1280, height: 1, fill: C.border },
            { type: 'TEXT', name: 'ConfigTitle', width: 1280, height: 28, text: 'Rule Configuration', fontSize: 20, fontWeight: 'Bold', fill: C.foreground },
            // Rule Group 1: Anti-Spam (expanded)
            {
              type: 'FRAME', name: 'RuleGroup1', width: 1280, height: 300,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 10, padding: 18,
              children: [
                {
                  type: 'FRAME', name: 'RG1Header', width: 1244, height: 28,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                  children: [
                    _toggleSwitch(true),
                    { type: 'TEXT', name: 'RG1Title', width: 200, height: 20, text: 'Anti-Spam Rules', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'RG1Count', width: 60, height: 14, text: '3 rules', fontSize: 11, fill: C.mutedForeground },
                    { type: 'TEXT', name: 'RG1Col', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                  ],
                },
                // Rules list
                ...[
                  ['Link Filter', 'Regex', 'Block messages containing suspicious URLs', true],
                  ['Repeat Detection', 'Frequency', 'Flag users sending identical messages rapidly', true],
                  ['Invite Spam', 'Pattern', 'Block discord.gg invite links from non-admins', false],
                ].map(([name, type, desc, enabled]) => ({
                  type: 'FRAME' as const, name: `Rule-${name}`, width: 1244, height: 60,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 12, padding: 12,
                  counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    _toggleSwitch(enabled as boolean),
                    {
                      type: 'FRAME' as const, name: `RI-${name}`, width: 800, height: 40,
                      layoutMode: 'VERTICAL' as const, itemSpacing: 2,
                      children: [
                        { type: 'TEXT' as const, name: `RN-${name}`, width: 800, height: 18, text: name as string, fontSize: 14, fontWeight: 'Medium' as const, fill: enabled ? C.foreground : C.mutedForeground },
                        { type: 'TEXT' as const, name: `RD-${name}`, width: 800, height: 14, text: desc as string, fontSize: 11, fill: C.mutedForeground },
                      ],
                    },
                    _statusBadge(type as string, '#3b82f6'),
                    button('Edit', 'secondary'),
                  ],
                })),
                button('Add Rule', 'secondary'),
              ],
            },
            // Rule Group 2: Content Moderation (expanded)
            {
              type: 'FRAME', name: 'RuleGroup2', width: 1280, height: 200,
              fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 10, padding: 18,
              children: [
                {
                  type: 'FRAME', name: 'RG2Header', width: 1244, height: 28,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
                  children: [
                    _toggleSwitch(true),
                    { type: 'TEXT', name: 'RG2Title', width: 300, height: 20, text: 'Content Moderation', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'RG2Count', width: 60, height: 14, text: '2 rules', fontSize: 11, fill: C.mutedForeground },
                    { type: 'TEXT', name: 'RG2Col', width: 60, height: 14, text: 'Collapse', fontSize: 11, fill: C.primary },
                  ],
                },
                ...[
                  ['Profanity Filter', 'Wordlist', 'Warn on profanity usage', true],
                  ['Toxicity Detection', 'AI', 'Use AI to detect toxic language', true],
                ].map(([name, type, desc, enabled]) => ({
                  type: 'FRAME' as const, name: `CRule-${name}`, width: 1244, height: 60,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 12, padding: 12,
                  counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    _toggleSwitch(enabled as boolean),
                    {
                      type: 'FRAME' as const, name: `CRI-${name}`, width: 800, height: 40,
                      layoutMode: 'VERTICAL' as const, itemSpacing: 2,
                      children: [
                        { type: 'TEXT' as const, name: `CRN-${name}`, width: 800, height: 18, text: name as string, fontSize: 14, fontWeight: 'Medium' as const, fill: C.foreground },
                        { type: 'TEXT' as const, name: `CRD-${name}`, width: 800, height: 14, text: desc as string, fontSize: 11, fill: C.mutedForeground },
                      ],
                    },
                    _statusBadge(type as string, type === 'AI' ? '#8b5cf6' : '#3b82f6'),
                    button('Edit', 'secondary'),
                  ],
                })),
              ],
            },
            // Rule editor (open for Link Filter)
            {
              type: 'FRAME', name: 'RuleEditor', width: 1280, height: 200,
              fill: C.card, stroke: C.primary, strokeWeight: 2, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 12, padding: 18,
              children: [
                { type: 'TEXT', name: 'RETitle', width: 1244, height: 22, text: 'Edit Rule: Link Filter', fontSize: 16, fontWeight: 'Bold', fill: C.foreground },
                {
                  type: 'FRAME', name: 'REFields', width: 1244, height: 60,
                  layoutMode: 'HORIZONTAL', itemSpacing: 16,
                  children: [
                    inputField('Rule Name', 300),
                    inputField('Pattern Type', 200),
                    inputField('Action (Block/Warn/Log)', 200),
                    inputField('Severity (Low/Med/High)', 200),
                  ],
                },
                {
                  type: 'FRAME', name: 'REPattern', width: 1244, height: 50,
                  layoutMode: 'VERTICAL', itemSpacing: 4,
                  children: [
                    { type: 'TEXT', name: 'REPLabel', width: 1244, height: 14, text: 'Pattern (Regex)', fontSize: 12, fontWeight: 'Medium', fill: C.foreground },
                    {
                      type: 'FRAME', name: 'REPInput', width: 1244, height: 32,
                      fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                      padding: { top: 8, right: 10, bottom: 8, left: 10 },
                      children: [{ type: 'TEXT', name: 'REPVal', width: 1224, height: 14, text: 'https?://(?!discord\\.com|google\\.com|zoom\\.us)\\S+', fontSize: 12, fill: '#93c5fd' }],
                    },
                  ],
                },
                {
                  type: 'FRAME', name: 'REActions', width: 1244, height: 36,
                  layoutMode: 'HORIZONTAL', itemSpacing: 12,
                  children: [button('Save Rule'), button('Cancel', 'secondary'), button('Test Pattern', 'secondary')],
                },
              ],
            },
            // Pattern tester
            {
              type: 'FRAME', name: 'PatternTester', width: 1280, height: 160,
              fill: '#1e3a5f', stroke: '#2563eb', strokeWeight: 1, cornerRadius: 12,
              layoutMode: 'VERTICAL', itemSpacing: 10, padding: 16,
              children: [
                { type: 'TEXT', name: 'PTTitle', width: 1248, height: 18, text: 'Pattern Tester', fontSize: 14, fontWeight: 'Bold', fill: '#93c5fd' },
                {
                  type: 'FRAME', name: 'PTInput', width: 1248, height: 36,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 6,
                  padding: { top: 8, right: 10, bottom: 8, left: 10 },
                  children: [{ type: 'TEXT', name: 'PTVal', width: 1228, height: 16, text: 'Check out this link: https://scam-site.xyz/free-tokens', fontSize: 12, fill: C.foreground }],
                },
                {
                  type: 'FRAME', name: 'PTResult', width: 1248, height: 50,
                  fill: '#0f1f0f', stroke: '#16a34a', strokeWeight: 1, cornerRadius: 6,
                  layoutMode: 'VERTICAL', itemSpacing: 4, padding: 10,
                  children: [
                    { type: 'TEXT', name: 'PTRLabel', width: 1228, height: 14, text: 'Result: MATCH FOUND', fontSize: 12, fontWeight: 'Bold', fill: '#4ade80' },
                    { type: 'TEXT', name: 'PTRMatch', width: 1228, height: 14, text: 'Matched: "https://scam-site.xyz/free-tokens" at position 25', fontSize: 11, fill: '#bbf7d0' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function _statCard(label: string, value: string, color: string): WireframeNode {
  const C = DESIGN_SYSTEM.colors
  return {
    type: 'FRAME', name: `Stat-${label}`, width: 240, height: 100,
    fill: C.card, stroke: C.border, strokeWeight: 1, cornerRadius: 12,
    layoutMode: 'VERTICAL', itemSpacing: 8, padding: 18,
    children: [
      { type: 'TEXT', name: `SL-${label}`, width: 204, height: 14, text: label, fontSize: 12, fill: C.mutedForeground },
      { type: 'TEXT', name: `SV-${label}`, width: 204, height: 36, text: value, fontSize: 28, fontWeight: 'Bold', fill: color },
    ],
  }
}

function pu16_UserManagement(): WireframePage {
  const C = DESIGN_SYSTEM.colors
  return {
    name: 'PU-16 User Management',
    description: 'Search, role/status filters, users table with 6 rows, bulk actions, pagination',
    transitionLabel: '',
    frame: {
      type: 'FRAME', name: 'PU-Users', width: PW, height: 1200, fill: C.background,
      layoutMode: 'VERTICAL', itemSpacing: 0,
      children: [
        navbar(),
        {
          type: 'FRAME', name: 'Body', width: PW, height: 1136, fill: C.background,
          layoutMode: 'VERTICAL', itemSpacing: 16,
          padding: { top: 16, right: 80, bottom: 16, left: 80 },
          children: [
            { type: 'TEXT', name: 'PageTitle', width: 1280, height: 32, text: 'User Management', fontSize: 24, fontWeight: 'Bold', fill: C.foreground },
            // Search + filters
            {
              type: 'FRAME', name: 'FilterRow', width: 1280, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, counterAxisAlignItems: 'CENTER',
              children: [
                {
                  type: 'FRAME', name: 'SearchBox', width: 300, height: 40,
                  fill: C.background, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  padding: { top: 10, right: 12, bottom: 10, left: 12 },
                  children: [{ type: 'TEXT', name: 'SearchPH', width: 276, height: 16, text: 'Search users...', fontSize: 13, fill: C.placeholder }],
                },
                // Role filter
                ...['All Roles', 'Admin', 'Facilitator', 'User'].map((r, i) => ({
                  type: 'FRAME' as const, name: `RF-${r}`, width: 90, height: 32,
                  fill: i === 0 ? C.primary : C.muted, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                  children: [{ type: 'TEXT' as const, name: `RFL-${r}`, width: 70, height: 14, text: r, fontSize: 11, fill: i === 0 ? '#ffffff' : C.foreground }],
                })),
                // Account type filter
                {
                  type: 'FRAME', name: 'AccFilter', width: 140, height: 32,
                  fill: C.muted, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'AccFL', width: 110, height: 14, text: 'All Accounts', fontSize: 11, fill: C.foreground }],
                },
              ],
            },
            // Bulk actions bar
            {
              type: 'FRAME', name: 'BulkActions', width: 1280, height: 44,
              fill: '#1a0a2e', stroke: C.primary, strokeWeight: 1, cornerRadius: 8,
              layoutMode: 'HORIZONTAL', itemSpacing: 12, padding: { top: 8, right: 16, bottom: 8, left: 16 },
              counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'RECTANGLE', name: 'SelectAll', width: 18, height: 18, fill: C.primary, cornerRadius: 4 },
                { type: 'TEXT', name: 'BALabel', width: 120, height: 14, text: '3 users selected', fontSize: 12, fill: '#a78bfa' },
                button('Silence Selected', 'secondary'),
                button('Unsilence Selected', 'secondary'),
                button('Change Role', 'secondary'),
              ],
            },
            // Users table
            {
              type: 'FRAME', name: 'UsersTable', width: 1280, height: 540,
              layoutMode: 'VERTICAL', itemSpacing: 0,
              children: [
                // Header
                {
                  type: 'FRAME', name: 'UTHeader', width: 1280, height: 44,
                  fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 8,
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, padding: { top: 12, right: 16, bottom: 12, left: 16 },
                  children: [
                    { type: 'RECTANGLE', name: 'HCB', width: 18, height: 18, fill: C.muted, stroke: C.border, strokeWeight: 1, cornerRadius: 4 },
                    { type: 'TEXT', name: 'H-Avatar', width: 50, height: 16, text: '', fontSize: 11, fill: C.foreground },
                    { type: 'TEXT', name: 'H-Name', width: 200, height: 16, text: 'Name', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Email', width: 250, height: 16, text: 'Email', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Role', width: 120, height: 16, text: 'Role', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Account', width: 120, height: 16, text: 'Account', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Status', width: 120, height: 16, text: 'Status', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Joined', width: 140, height: 16, text: 'Joined', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                    { type: 'TEXT', name: 'H-Actions', width: 80, height: 16, text: 'Actions', fontSize: 11, fontWeight: 'Bold', fill: C.foreground },
                  ],
                },
                // User rows
                ...[
                  ['Tevo', 'tevo@example.com', 'Admin', 'Google', 'Active', 'Jan 2025', '#6d28d9', true],
                  ['Alice', 'alice@dao.org', 'Facilitator', 'Google', 'Active', 'Feb 2025', '#0891b2', true],
                  ['Bob', 'bob@crypto.io', 'User', 'Discord', 'Active', 'Mar 2025', '#059669', true],
                  ['Charlie', 'charlie@web3.dev', 'User', 'Traveler', 'Silenced', 'Mar 2025', '#d97706', false],
                  ['Diana', 'diana@gov.org', 'Facilitator', 'Google', 'Active', 'Apr 2025', '#dc2626', false],
                  ['Eve', 'eve@startup.co', 'User', 'Discord', 'Active', 'May 2025', '#2563eb', false],
                ].map(([name, email, role, account, status, joined, color, selected], i) => ({
                  type: 'FRAME' as const, name: `UR-${i}`, width: 1280, height: 56,
                  fill: selected ? '#1a0a2e' : (i % 2 === 0 ? C.card : C.background),
                  stroke: selected ? C.primary : C.border, strokeWeight: selected ? 1 : 0.5,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, padding: { top: 12, right: 16, bottom: 12, left: 16 },
                  counterAxisAlignItems: 'CENTER' as const,
                  children: [
                    { type: 'RECTANGLE' as const, name: `UCB-${i}`, width: 18, height: 18, fill: selected ? C.primary : C.muted, cornerRadius: 4, stroke: C.border, strokeWeight: 1 },
                    { type: 'ELLIPSE' as const, name: `UA-${i}`, width: 32, height: 32, fill: color as string },
                    { type: 'TEXT' as const, name: `UN-${i}`, width: 200, height: 16, text: name as string, fontSize: 13, fontWeight: 'Medium' as const, fill: C.foreground },
                    { type: 'TEXT' as const, name: `UE-${i}`, width: 250, height: 14, text: email as string, fontSize: 12, fill: C.mutedForeground },
                    _statusBadge(role as string, role === 'Admin' ? '#6d28d9' : role === 'Facilitator' ? '#0891b2' : '#71717a'),
                    _statusBadge(account as string, account === 'Google' ? '#4285f4' : account === 'Discord' ? '#5865F2' : '#f59e0b'),
                    _statusBadge(status as string, status === 'Active' ? '#16a34a' : '#dc2626'),
                    { type: 'TEXT' as const, name: `UJ-${i}`, width: 140, height: 14, text: joined as string, fontSize: 11, fill: C.mutedForeground },
                    { type: 'TEXT' as const, name: `UAct-${i}`, width: 80, height: 14, text: 'Manage', fontSize: 11, fill: C.primary },
                  ],
                })),
              ],
            },
            // Pagination
            {
              type: 'FRAME', name: 'Pagination', width: 1280, height: 44,
              layoutMode: 'HORIZONTAL', itemSpacing: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
              children: [
                { type: 'TEXT', name: 'PagInfo', width: 200, height: 14, text: 'Showing 1-6 of 89 users', fontSize: 12, fill: C.mutedForeground },
                { type: 'RECTANGLE', name: 'PrevPage', width: 32, height: 32, fill: C.muted, cornerRadius: 6 },
                ...['1', '2', '3', '...', '15'].map((p, i) => ({
                  type: 'FRAME' as const, name: `Page-${p}-${i}`, width: 32, height: 32,
                  fill: i === 0 ? C.primary : C.muted, cornerRadius: 6,
                  layoutMode: 'HORIZONTAL' as const, itemSpacing: 0, primaryAxisAlignItems: 'CENTER' as const, counterAxisAlignItems: 'CENTER' as const,
                  children: [{ type: 'TEXT' as const, name: `PL-${p}-${i}`, width: 14, height: 14, text: p, fontSize: 12, fontWeight: i === 0 ? 'Bold' as const : 'Regular' as const, fill: i === 0 ? '#ffffff' : C.foreground }],
                })),
                { type: 'RECTANGLE', name: 'NextPage', width: 32, height: 32, fill: C.muted, cornerRadius: 6 },
                // Per page selector
                {
                  type: 'FRAME', name: 'PerPage', width: 100, height: 32,
                  fill: C.muted, cornerRadius: 6, padding: { top: 6, right: 10, bottom: 6, left: 10 },
                  layoutMode: 'HORIZONTAL', itemSpacing: 0, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
                  children: [{ type: 'TEXT', name: 'PPVal', width: 80, height: 14, text: '6 / page', fontSize: 11, fill: C.foreground }],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

// ─── Registry ─────────────────────────────────────────────────────────

const PAGE_GENERATORS: Record<string, () => WireframePage> = {
  HomePage: homePage,
  CalendarPage: calendarPage,
  MeetingPage: meetingPage,
  AnnouncementsPage: announcementsPage,
  FeedbackPage: feedbackPage,
  SettingsPage: settingsPage,
  LoginPage: loginPage,
  AiChatPage: aiChatPage,
  EventsCalendarPage: eventsCalendarPage,
  GuardianPage: guardianPage,
  'GuestBooking-Step1': guestBookingStep1,
  'GuestBooking-Step2': guestBookingStep2,
  'GuestBooking-Step3': guestBookingStep3,
  'FJ-01-Home': fj01_HomeUnauthenticated,
  'FJ-02-CreateCalendar': fj02_CreateCalendar,
  'FJ-03-Login': fj03_LoginCardano,
  'FJ-04-ShareInvite': fj04_CalendarWithInvite,
  'FJ-05-Distribute': fj05_DistributeInvite,
  'FJ-06-Discord': fj06_DiscordIntegration,
  'FJ-07-Send': fj07_SendMessage,
  'FJ-08-Logs': fj08_CheckLogs,
  'FJ-09-CalendarFull': fj09_CalendarWithParticipants,
  'FJ-10-Suggestions': fj10_MeetingSuggestions,
  'FJ-11-MeetingPanel': fj11_MeetingSidePanel,
  'FJ-12-AiPanel': fj12_AiAssistant,
  'FJ-13-DistributeFinal': fj13_DistributeConfirmed,
  'PU-01-Home': pu01_HomePage,
  'PU-02-CalendarFull': pu02_CalendarFull,
  'PU-03-MeetingPanel': pu03_CalendarMeetingPanel,
  'PU-04-AiPanel': pu04_CalendarAiPanel,
  'PU-05-AnnounceCompose': pu05_AnnouncementsCompose,
  'PU-06-Templates': pu06_AnnouncementsTemplatesScheduled,
  'PU-07-Discord': pu07_AnnouncementsDiscord,
  'PU-08-SettingsProfile': pu08_SettingsProfileAppearance,
  'PU-09-SettingsCalendar': pu09_SettingsCalendarAI,
  'PU-10-SettingsNotify': pu10_SettingsNotificationsPrivacy,
  'PU-11-Feedback': pu11_FeedbackFull,
  'PU-12-EventsCalendar': pu12_EventsCalendar,
  'PU-13-EventsDiscovery': pu13_EventsDiscovery,
  'PU-14-AiChat': pu14_AiChat,
  'PU-15-Guardian': pu15_Guardian,
  'PU-16-Users': pu16_UserManagement,
}

export const AVAILABLE_PAGES = Object.keys(PAGE_GENERATORS)

export function generateWireframeSpec(pages: string[]): WireframeSpec {
  const validPages = pages.filter(p => PAGE_GENERATORS[p])
  if (validPages.length === 0) {
    throw new Error(
      `No valid pages requested. Available: ${AVAILABLE_PAGES.join(', ')}`
    )
  }

  return {
    projectName: 'Coordination Manager',
    generatedAt: new Date().toISOString(),
    designSystem: DESIGN_SYSTEM,
    pages: validPages.map(p => PAGE_GENERATORS[p]()),
  }
}
