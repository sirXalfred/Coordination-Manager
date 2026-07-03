import rateLimit from 'express-rate-limit'
import type express from 'express'

type LimiterMethod = 'use' | 'get' | 'post'

interface LimiterMount {
  method: LimiterMethod
  path: string
}

interface LimiterDefinition {
  windowMs: number
  max: number
  message: { error: string }
  mounts: LimiterMount[]
}

interface RegisterRateLimitersOptions {
  app: express.Express
  skipLocalhost: (req: express.Request) => boolean
}

function applyLimiter(app: express.Express, limiter: ReturnType<typeof rateLimit>, mount: LimiterMount): void {
  if (mount.method === 'use') app.use(mount.path, limiter)
  if (mount.method === 'get') app.get(mount.path, limiter)
  if (mount.method === 'post') app.post(mount.path, limiter)
}

function createLimiter(
  definition: Omit<LimiterDefinition, 'mounts'>,
  skipLocalhost: (req: express.Request) => boolean
): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: definition.windowMs,
    max: definition.max,
    skip: skipLocalhost,
    standardHeaders: true,
    legacyHeaders: false,
    message: definition.message,
  })
}

export function registerRateLimiters({ app, skipLocalhost }: RegisterRateLimitersOptions): void {
  const globalLimiter = createLimiter(
    {
      windowMs: 15 * 60 * 1000,
      max: 1200,
      message: { error: 'Too many requests, please try again later.' },
    },
    skipLocalhost
  )
  app.use(globalLimiter)

  const authActions: Array<{ path: string; label: string }> = [
    { path: '/api/auth/guest', label: 'login' },
    { path: '/api/auth/wallet', label: 'wallet' },
    { path: '/api/auth/logout', label: 'logout' },
    { path: '/api/auth/account', label: 'account' },
  ]

  authActions.forEach(({ path, label }) => {
    const limiter = createLimiter(
      {
        windowMs: 15 * 60 * 1000,
        max: 120,
        message: { error: `Too many ${label} attempts. Please wait 15 minutes before trying again.` },
      },
      skipLocalhost
    )
    app.use(path, limiter)
  })

  const limiterDefinitions: LimiterDefinition[] = [
    {
      windowMs: 15 * 60 * 1000,
      max: 240,
      message: { error: 'Too many requests, please try again later.' },
      mounts: [
        { method: 'use', path: '/api/auth/me' },
        { method: 'use', path: '/api/auth/profile' },
      ],
    },
    {
      windowMs: 60 * 60 * 1000,
      max: 20,
      message: { error: 'Too many key generation attempts.' },
      mounts: [{ method: 'use', path: '/api/discord/generate-key' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 80,
      message: { error: 'Too many announcement requests.' },
      mounts: [
        { method: 'use', path: '/api/announcements/send-now' },
        { method: 'post', path: '/api/announcements/schedules' },
      ],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 800,
      message: { error: 'Too many announcement status requests.' },
      mounts: [{ method: 'get', path: '/api/announcements/schedules/*' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 240,
      message: { error: 'Too many requests, please try again later.' },
      mounts: [
        { method: 'use', path: '/api/feedback' },
        { method: 'use', path: '/api/ai-feedback' },
      ],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 480,
      message: { error: 'Too many AI chat requests, please try again later.' },
      mounts: [{ method: 'use', path: '/api/ai-chat' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 240,
      message: { error: 'Too many Figma API requests, please try again later.' },
      mounts: [{ method: 'use', path: '/api/figma' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 120,
      message: { error: 'Too many email requests, please try again later.' },
      mounts: [
        { method: 'use', path: '/api/email-contacts' },
        { method: 'use', path: '/api/smtp-config' },
        { method: 'use', path: '/api/verified-emails' },
      ],
    },
    {
      windowMs: 60 * 60 * 1000,
      max: 20,
      message: { error: 'Too many SMTP test attempts. Please wait before trying again.' },
      mounts: [{ method: 'use', path: '/api/smtp-config/test' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 400,
      message: { error: 'Too many email send requests.' },
      mounts: [{ method: 'use', path: '/api/internal/send-email' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 60,
      message: { error: 'Too many Discord channel requests.' },
      mounts: [
        { method: 'post', path: '/api/discord/channels' },
        { method: 'post', path: '/api/discord/refresh-guilds' },
      ],
    },
    {
      windowMs: 60 * 60 * 1000,
      max: 20,
      message: { error: 'Too many invite generation requests. Please wait before trying again.' },
      mounts: [{ method: 'post', path: '/api/connections/invites' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { error: 'Too many Zoom meeting creation requests. Please wait before trying again.' },
      mounts: [{ method: 'post', path: '/api/zoom/create-meeting' }],
    },
    {
      windowMs: 15 * 60 * 1000,
      max: 240,
      message: { error: 'Too many time-management requests, please try again later.' },
      mounts: [{ method: 'use', path: '/api/time-management' }],
    },
  ]

  limiterDefinitions.forEach((definition) => {
    const limiter = createLimiter(definition, skipLocalhost)
    definition.mounts.forEach((mount) => applyLimiter(app, limiter, mount))
  })
}
