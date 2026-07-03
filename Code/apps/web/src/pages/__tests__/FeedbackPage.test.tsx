import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeedbackPage from '../FeedbackPage'
import { apiClient } from '../../lib/api-client'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      roles: [],
      accountType: 'google',
      themePreferences: null,
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Stub LearnerHelpIcon -- simple icon, not under test
vi.mock('../../components/LearnerHelpIcon', () => ({
  default: () => null,
}))

// Stub AiFeedbackPage -- large sub-page, not under test here
vi.mock('../AiFeedbackPage', () => ({
  default: () => <div data-testid="ai-feedback-stub" />,
}))

// ── Helpers ────────────────────────────────────────────────────────────────

const IMAGE_URL = 'https://example.com/screenshot.png'

function makeFeedbackResponse(attachments: string[] = []) {
  return {
    data: {
      feedback: [
        {
          id: 'fb-1',
          user_id: 'user-1',
          discord_user_id: null,
          discord_username: null,
          user_display_name: 'Test User',
          user_email: 'test@example.com',
          user_avatar_url: null,
          message: 'Test feedback message',
          source: 'web',
          status: 'open',
          created_at: '2026-04-19T10:00:00Z',
          attachments,
          feedback_responses: [],
        },
      ],
      total: 1,
      statusCounts: { open: 1, reviewed: 0 },
      isAdmin: false,
    },
  }
}

async function renderPage() {
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <FeedbackPage />
      </MemoryRouter>
    )
  })
  // Wait for the loading indicator to disappear
  await waitFor(
    () => expect(screen.queryByText('Loading feedback...')).not.toBeInTheDocument(),
    { timeout: 5000 }
  )
  return result
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('FeedbackPage -- image lightbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.get).mockResolvedValue(makeFeedbackResponse([IMAGE_URL]))
  })

  it('renders the feedback list with an attachment image', async () => {
    await renderPage()
    const img = await screen.findByAltText('Attachment 1')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', IMAGE_URL)
  })

  it('lightbox is not visible on initial render', async () => {
    await renderPage()
    expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument()
  })

  it('clicking an attachment image opens the lightbox', async () => {
    await renderPage()
    const thumb = await screen.findByAltText('Attachment 1')
    await act(async () => { fireEvent.click(thumb) })
    const preview = await screen.findByRole('img', { name: 'Preview' })
    expect(preview).toBeInTheDocument()
    expect(preview).toHaveAttribute('src', IMAGE_URL)
  })

  it('clicking the Enlarge button on the attachment also opens the lightbox', async () => {
    await renderPage()
    const enlargeBtn = await screen.findByTitle('Enlarge')
    await act(async () => { fireEvent.click(enlargeBtn) })
    const preview = await screen.findByRole('img', { name: 'Preview' })
    expect(preview).toBeInTheDocument()
  })

  it('pressing Escape while lightbox is open closes it', async () => {
    await renderPage()
    const thumb = await screen.findByAltText('Attachment 1')
    await act(async () => { fireEvent.click(thumb) })
    expect(await screen.findByRole('img', { name: 'Preview' })).toBeInTheDocument()
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument()
    })
  })

  it('clicking the Close button in the lightbox closes it', async () => {
    await renderPage()
    const thumb = await screen.findByAltText('Attachment 1')
    await act(async () => { fireEvent.click(thumb) })
    const closeBtn = await screen.findByTitle('Close')
    await act(async () => { fireEvent.click(closeBtn) })
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument()
    })
  })

  it('clicking the lightbox overlay closes it', async () => {
    await renderPage()
    const thumb = await screen.findByAltText('Attachment 1')
    await act(async () => { fireEvent.click(thumb) })
    const preview = await screen.findByRole('img', { name: 'Preview' })
    // The overlay is the grandparent of the preview image (overlay > button + img)
    const overlay = preview.parentElement as HTMLElement
    await act(async () => { fireEvent.click(overlay) })
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument()
    })
  })

  it('clicking the preview image itself does NOT close the lightbox', async () => {
    await renderPage()
    const thumb = await screen.findByAltText('Attachment 1')
    await act(async () => { fireEvent.click(thumb) })
    const preview = await screen.findByRole('img', { name: 'Preview' })
    // The image calls stopPropagation, so clicking it should keep lightbox open
    await act(async () => { fireEvent.click(preview) })
    expect(screen.getByRole('img', { name: 'Preview' })).toBeInTheDocument()
  })
})

describe('FeedbackPage -- attachment list (no attachments)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.get).mockResolvedValue(makeFeedbackResponse([]))
  })

  it('does not render attachment images when feedback has none', async () => {
    await renderPage()
    expect(screen.queryByAltText('Attachment 1')).not.toBeInTheDocument()
  })
})

describe('FeedbackPage -- page renders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.get).mockResolvedValue(makeFeedbackResponse([]))
  })

  it('renders the Feedback heading', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: /feedback/i })).toBeInTheDocument()
  })

  it('renders the Your Submissions section for non-admin users', async () => {
    await renderPage()
    expect(screen.getByText('Your Submissions')).toBeInTheDocument()
  })

  it('labels the order-by chip as Received for open feedback', async () => {
    await renderPage()
    const orderByRow = screen.getByText('Order by:').parentElement as HTMLElement
    expect(within(orderByRow).getByText('Received')).toBeInTheDocument()
  })

  it('shows the feedback submission form textarea', async () => {
    await renderPage()
    expect(
      screen.getByPlaceholderText(/report a bug, suggest a feature/i)
    ).toBeInTheDocument()
  })
})
