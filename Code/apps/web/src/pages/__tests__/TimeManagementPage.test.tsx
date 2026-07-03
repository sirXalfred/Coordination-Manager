import '@testing-library/jest-dom'
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TimeManagementPage, {
  buildDiffuseTimeBackgroundFill,
  inferRequestedTimezoneForAiResponse,
  isExplicitPrimaryTimezoneChangeRequest,
} from '../TimeManagementPage'

const mockDedupedGet = vi.fn()
const mockUseAuth = vi.fn()
const mockApiPost = vi.fn()
const mockApiPut = vi.fn()
const mockApiPatch = vi.fn()
const mockApiDelete = vi.fn()
const mockComputeDayLayout = vi.fn()

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
  dedupedGet: (...args: unknown[]) => mockDedupedGet(...args),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../contexts/LayoutContext', () => ({
  LeftPanelPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/TimezoneSelector', () => ({
  default: () => <div data-testid="timezone-selector" />,
}))

vi.mock('../../components/ColorGridPicker', () => ({
  default: () => <div data-testid="color-grid-picker" />,
}))

vi.mock('../../lib/use-timezones', () => ({
  useTimezones: () => ({
    primary: 'UTC',
    additional: [],
    all: ['UTC'],
    setPrimary: vi.fn(),
    addTimezone: vi.fn(),
    removeTimezone: vi.fn(),
    replaceTimezone: vi.fn(),
    canAddMore: true,
    getEntry: vi.fn(),
  }),
}))

vi.mock('../../lib/timezone-data', () => ({
  convertUtcTimeToTimezone: (value: string) => value,
  getCurrentTimeInTimezone: () => '00:00',
  findTimezone: () => undefined,
}))

vi.mock('../../lib/calendarOverlapLayout', () => ({
  computeDayLayout: (...args: unknown[]) => mockComputeDayLayout(...args),
}))

vi.mock('@tiptap/react', () => ({
  EditorContent: () => <div data-testid="editor-content" />,
  Extension: {
    create: () => ({}),
  },
  useEditor: () => ({
    setEditable: vi.fn(),
    getMarkdown: () => '',
    view: {
      dom: document.createElement('div'),
    },
    commands: {
      setContent: vi.fn(),
      insertContent: vi.fn(),
    },
  }),
}))

vi.mock('@tiptap/markdown', () => ({
  Markdown: {},
}))

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: () => ({}),
  },
}))

vi.mock('@tiptap/extension-placeholder', () => ({
  Placeholder: {
    configure: () => ({}),
  },
}))

vi.mock('@tiptap/extension-list', () => ({
  TaskItem: {
    configure: () => ({}),
  },
  TaskList: {},
}))

vi.mock('@tiptap/extension-details', () => ({
  Details: {
    configure: () => ({}),
  },
  DetailsContent: {},
  DetailsSummary: {},
}))

function installDefaultApiMocks(): void {
  mockDedupedGet.mockImplementation(async (url: string) => {
    if (url === '/api/calendar-sources') {
      return { data: { sources: [] } }
    }
    if (url === '/api/time-management/modes') {
      return {
        data: {
          activeModeId: 'mode-main',
          modes: [
            {
              id: 'mode-main',
              name: 'Main',
              main_color: '#2563eb',
              slot_minutes: 30,
              sync_calendars: [],
              time_backgrounds: [],
              collapsed_background_ids: [],
              quick_templates: [],
              show_quick_templates_in_main: false,
            },
          ],
        },
      }
    }
    if (url === '/api/time-management/categories') {
      return { data: { categories: [] } }
    }
    if (url === '/api/user-events') {
      return { data: { events: [] } }
    }
    return { data: {} }
  })
}

describe('TimeManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
    mockComputeDayLayout.mockReturnValue({ eventSegments: [], overflowSegments: [] })
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      isTraveler: false,
    })
    mockApiPost.mockResolvedValue({ data: { inserted: 0, updated: 0, deleted: 0, syncedSources: 0 } })
    installDefaultApiMocks()
  })

  it('renders the page shell and fetches initial datasets', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Time Management' })).toBeInTheDocument()
    expect(await screen.findByText('Time Management Tools')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockDedupedGet).toHaveBeenCalledWith('/api/calendar-sources')
      expect(mockDedupedGet).toHaveBeenCalledWith('/api/time-management/prefs')
      expect(mockDedupedGet).toHaveBeenCalledWith('/api/time-management/categories')
      expect(mockDedupedGet).toHaveBeenCalledWith('/api/user-events')
    })
  })

  it('shows empty-state messaging when no meetings are returned', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('No meetings found on the selected calendars.')).toBeInTheDocument()
  })

  it('syncs enabled connected calendars for the visible week and refreshes events', async () => {
    mockDedupedGet.mockImplementation(async (url: string) => {
      if (url === '/api/calendar-sources') {
        return {
          data: {
            sources: [
              {
                id: 'google-1',
                source_type: 'google_oauth',
                google_email: 'user@example.com',
                public_url: null,
                display_name: 'Google Personal',
                color: '#34d399',
                is_active: true,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/modes') {
        return {
          data: {
            activeModeId: 'mode-main',
            modes: [
              {
                id: 'mode-main',
                name: 'Main',
                main_color: '#2563eb',
                slot_minutes: 30,
                sync_calendars: [],
                time_backgrounds: [],
                collapsed_background_ids: [],
                quick_templates: [],
                show_quick_templates_in_main: false,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/categories') {
        return { data: { categories: [] } }
      }
      if (url === '/api/user-events') {
        return { data: { events: [] } }
      }
      return { data: {} }
    })

    mockApiPost.mockResolvedValue({
      data: { inserted: 1, updated: 0, deleted: 0, syncedSources: 1 },
    })

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/user-events/sync-imports',
        expect.objectContaining({
          time_min: expect.any(String),
          time_max: expect.any(String),
          source_configs: [
            {
              source_type: 'google_oauth',
              source_id: 'google-1',
            },
          ],
        })
      )
    })

    expect(mockDedupedGet.mock.calls.filter((call) => call[0] === '/api/user-events').length).toBeGreaterThanOrEqual(2)
  })

  it('toggles hidden mode and updates the page title with a disable action', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    fireEvent.click(screen.getByTitle('Expand calendar modes'))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle hidden mode' }))

    await screen.findByRole('heading', { name: 'Content hidden Time Management mode' })
    fireEvent.click(screen.getByRole('button', { name: '(disable hidden mode)' }))

    await screen.findByRole('heading', { name: 'Time Management' })
  })

  it('keeps midnight-split time backgrounds solid at clipped edges', () => {
    const topClippedFill = buildDiffuseTimeBackgroundFill('#0ea5e9', 0.18, {
      fadeStart: true,
      fadeEnd: false,
    })
    const bottomClippedFill = buildDiffuseTimeBackgroundFill('#0ea5e9', 0.18, {
      fadeStart: false,
      fadeEnd: true,
    })

    expect(topClippedFill).toContain('rgba(14, 165, 233, 0.081) 0%')
    expect(topClippedFill).toContain('rgba(14, 165, 233, 0.18) 100%')
    expect(bottomClippedFill).toContain('rgba(14, 165, 233, 0.18) 0%')
    expect(bottomClippedFill).toContain('rgba(14, 165, 233, 0.081) 100%')
  })

  it('only treats explicit primary-timezone requests as primary changes', () => {
    expect(isExplicitPrimaryTimezoneChangeRequest('Create me a time background at the range of 22:00 UTC to 6 UTC and apply estonian timezone')).toBe(false)
    expect(isExplicitPrimaryTimezoneChangeRequest('Apply Estonian timezone and keep UTC primary')).toBe(false)
    expect(isExplicitPrimaryTimezoneChangeRequest('Set Europe/Tallinn as my primary timezone')).toBe(true)
    expect(isExplicitPrimaryTimezoneChangeRequest('Switch the main timezone to Europe/Tallinn')).toBe(true)
  })

  it('infers requested non-UTC timezone from user or AI text when action payload omits timezone', () => {
    expect(
      inferRequestedTimezoneForAiResponse(
        'keep the UTC still as primary UTC',
        'Background period created from 01:00 to 09:00 in Estonian time (Europe/Tallinn).',
        'Background created'
      )
    ).toBe('Europe/Tallinn')

    expect(
      inferRequestedTimezoneForAiResponse(
        'Create a background in Europe/Tallinn',
        'Created background period.',
        'Done'
      )
    ).toBe('Europe/Tallinn')

    expect(
      inferRequestedTimezoneForAiResponse(
        'Keep UTC primary and create a UTC window',
        'Created background in UTC.',
        'Done'
      )
    ).toBeNull()
  })

  it('cancels an active time selection when Escape is pressed', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    const dayColumn = document.querySelector<HTMLDivElement>('div[style*="background-image"]')
    expect(dayColumn).toBeTruthy()

    if (!dayColumn) {
      throw new Error('Expected at least one day column')
    }

    Object.defineProperty(dayColumn, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 100,
        bottom: 600,
        width: 100,
        height: 600,
        toJSON: () => ({}),
      }),
    })

    fireEvent.mouseDown(dayColumn, { button: 0, clientX: 20, clientY: 120 })
    fireEvent.mouseUp(window)

    await screen.findByText(/Selection:/)

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText(/Selection:/)).not.toBeInTheDocument()
      expect(screen.getByTitle('Hide left panel')).toBeInTheDocument()
    })
  })

  it('resizes a 15 minute item from the visible repeat without sticky-header drift', async () => {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))

    const eventStart = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 1, 0, 0)).toISOString()
    const eventEnd = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 1, 15, 0)).toISOString()

    mockDedupedGet.mockImplementation(async (url: string) => {
      if (url === '/api/calendar-sources') {
        return { data: { sources: [] } }
      }
      if (url === '/api/time-management/modes') {
        return {
          data: {
            activeModeId: 'mode-main',
            modes: [
              {
                id: 'mode-main',
                name: 'Main',
                main_color: '#2563eb',
                slot_minutes: 15,
                sync_calendars: [],
                time_backgrounds: [],
                collapsed_background_ids: [],
                quick_templates: [],
                show_quick_templates_in_main: false,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/categories') {
        return { data: { categories: [] } }
      }
      if (url === '/api/user-events') {
        return {
          data: {
            events: [
              {
                id: 'event-1',
                title: 'Quick item',
                description: null,
                meeting_link: null,
                location: null,
                start_time: eventStart,
                end_time: eventEnd,
                source_type: 'manual',
                source_id: 'coord-main',
                category_ids: [],
                recurrence_rule: { type: 'none' },
              },
            ],
          },
        }
      }
      return { data: {} }
    })

    mockComputeDayLayout.mockReturnValue({
      eventSegments: [
        {
          eventId: 'event-1',
          eventIndex: 0,
          top: 104,
          height: 26,
          leftPercent: 0,
          widthPercent: 100,
          isFirstSegment: true,
        },
      ],
      overflowSegments: [],
    })

    mockApiPut.mockResolvedValue({ data: {} })

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })
    await screen.findAllByText('Quick item')

    const dayColumns = Array.from(document.querySelectorAll<HTMLDivElement>('div[style*="background-image"]'))
    expect(dayColumns.length).toBeGreaterThanOrEqual(14)

    const visibleRepeatColumn = dayColumns[0]
    const middleRepeatColumn = dayColumns[7]

    if (!visibleRepeatColumn || !middleRepeatColumn) {
      throw new Error('Expected visible and middle repeat day columns')
    }

    Object.defineProperty(visibleRepeatColumn, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 100,
        bottom: 2496,
        width: 100,
        height: 2496,
        toJSON: () => ({}),
      }),
    })

    Object.defineProperty(middleRepeatColumn, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 2574,
        top: 2574,
        left: 0,
        right: 100,
        bottom: 5070,
        width: 100,
        height: 2496,
        toJSON: () => ({}),
      }),
    })

    fireEvent.mouseDown(visibleRepeatColumn, { button: 0, clientX: 20, clientY: 130 })
    fireEvent.mouseMove(window, { clientX: 20, clientY: 156 })

    await waitFor(() => {
      expect(screen.getAllByTitle(/01:00-01:30/).length).toBeGreaterThan(0)
    })

    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/user-events/event-1', {
        start_time: eventStart,
        end_time: new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 1, 30, 0)).toISOString(),
      })
    })
  })

  it('runs Escape side-panel actions one at a time by priority', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    const monthButton =
      screen.queryByTitle('Collapse month overview') ?? screen.queryByTitle('Expand month overview')
    expect(monthButton).toBeTruthy()

    if (!monthButton) {
      throw new Error('Expected month overview toggle button to be present')
    }

    if (monthButton.getAttribute('title') === 'Expand month overview') {
      fireEvent.click(monthButton)
      await waitFor(() => {
        expect(screen.getByTitle('Collapse month overview')).toBeInTheDocument()
      })
    }

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTitle('Hide left panel')).toBeInTheDocument()
      expect(screen.getByTitle('Expand month overview')).toBeInTheDocument()
    })

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTitle('Show left panel')).toBeInTheDocument()
    })

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTitle('Hide left panel')).toBeInTheDocument()
      expect(screen.getByTitle('Expand month overview')).toBeInTheDocument()
    })
  })

  it('closes the side panel when Escape is pressed with no active selection', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })
    expect(screen.getByTitle('Hide left panel')).toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTitle('Show left panel')).toBeInTheDocument()
    })
  })

  it('recenters the looped calendar scroll when it approaches an edge copy', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    const scrollContainer = screen.getByTestId('calendar-scroll-container') as HTMLDivElement
    const repeatHeight = 100
    const repeatCopy = document.createElement('div')

    Object.defineProperty(repeatCopy, 'offsetHeight', {
      configurable: true,
      value: repeatHeight,
    })
    Object.defineProperty(scrollContainer, 'firstElementChild', {
      configurable: true,
      value: repeatCopy,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    })

    fireEvent.scroll(scrollContainer)

    expect(scrollContainer.scrollTop).toBe(repeatHeight)
  })

  it('reopens the side panel when Escape is pressed while the panel is already closed', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    const monthButton =
      screen.queryByTitle('Collapse month overview') ?? screen.queryByTitle('Expand month overview')
    expect(monthButton).toBeTruthy()

    if (!monthButton) {
      throw new Error('Expected month overview toggle button to be present')
    }

    if (monthButton.getAttribute('title') === 'Expand month overview') {
      fireEvent.click(monthButton)
      await waitFor(() => {
        expect(screen.getByTitle('Collapse month overview')).toBeInTheDocument()
      })
    }

    fireEvent.click(screen.getByTitle('Hide left panel'))
    await waitFor(() => {
      expect(screen.getByTitle('Show left panel')).toBeInTheDocument()
    })

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTitle('Hide left panel')).toBeInTheDocument()
      expect(screen.getByTitle('Expand month overview')).toBeInTheDocument()
    })
  })

  it('collapses side panel sections when closed from the button', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    const monthButton =
      screen.queryByTitle('Collapse month overview') ?? screen.queryByTitle('Expand month overview')
    expect(monthButton).toBeTruthy()

    if (!monthButton) {
      throw new Error('Expected month overview toggle button to be present')
    }

    if (monthButton.getAttribute('title') === 'Expand month overview') {
      fireEvent.click(monthButton)
      await waitFor(() => {
        expect(screen.getByTitle('Collapse month overview')).toBeInTheDocument()
      })
    }

    fireEvent.click(screen.getByTitle('Close side panel'))

    await waitFor(() => {
      expect(screen.getByTitle('Show left panel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('Show left panel'))

    await waitFor(() => {
      expect(screen.getByTitle('Expand month overview')).toBeInTheDocument()
    })
  })

  it('closes the side panel when Escape is pressed from the full editor modal', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'Time Management' })

    fireEvent.click(screen.getByText('Full view'))

    await screen.findByText('Use the full view to draft long notes, templates, and checklists.')

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Use the full view to draft long notes, templates, and checklists.')).not.toBeInTheDocument()
      expect(screen.getByTitle('Hide left panel')).toBeInTheDocument()
    })
  })

  it('shows the API error when meeting retrieval fails', async () => {
    mockDedupedGet.mockImplementation(async (url: string) => {
      if (url === '/api/user-events') {
        throw new Error('Failed to load meetings for test')
      }
      if (url === '/api/calendar-sources') return { data: { sources: [] } }
      if (url === '/api/time-management/modes') {
        return {
          data: {
            activeModeId: 'mode-main',
            modes: [
              {
                id: 'mode-main',
                name: 'Main',
                main_color: '#2563eb',
                slot_minutes: 30,
                sync_calendars: [],
                time_backgrounds: [],
                collapsed_background_ids: [],
                quick_templates: [],
                show_quick_templates_in_main: false,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/categories') return { data: { categories: [] } }
      return { data: {} }
    })

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Failed to load meetings for test')).toBeInTheDocument()
  })

  it('allows traveler accounts to load personal time-management data, without sync sources', async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      isTraveler: true,
    })

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Time Management' })).toBeInTheDocument()

    await waitFor(() => {
      expect(mockDedupedGet).toHaveBeenCalled()
    })

    const calledUrls = mockDedupedGet.mock.calls.map((call) => String(call[0]))
    expect(calledUrls).toContain('/api/time-management/modes')
    expect(calledUrls).toContain('/api/time-management/categories')
    expect(calledUrls).toContain('/api/time-management/prefs')
    expect(calledUrls).toContain('/api/user-events')
    expect(calledUrls).not.toContain('/api/calendar-sources')
  })

  it('defaults new connected calendars to enabled when no preference exists', async () => {
    mockDedupedGet.mockImplementation(async (url: string) => {
      if (url === '/api/calendar-sources') {
        return {
          data: {
            sources: [
              {
                id: 'google-1',
                source_type: 'google_oauth',
                google_email: 'user@example.com',
                public_url: null,
                display_name: 'Google Personal',
                color: '#34d399',
                is_active: true,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/modes') {
        return {
          data: {
            activeModeId: 'mode-main',
            modes: [
              {
                id: 'mode-main',
                name: 'Main',
                main_color: '#2563eb',
                slot_minutes: 30,
                sync_calendars: [],
                time_backgrounds: [],
                collapsed_background_ids: [],
                quick_templates: [],
                show_quick_templates_in_main: false,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/categories') return { data: { categories: [] } }
      if (url === '/api/user-events') return { data: { events: [] } }
      return { data: {} }
    })

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockDedupedGet).toHaveBeenCalledWith('/api/calendar-sources')
    })

    // The connected source is merged into syncCalendars asynchronously, so wait for
    // the persisted preferences to include it. The built-in main calendar and any
    // newly connected calendar both default to enabled when no preference exists.
    await waitFor(() => {
      const raw = localStorage.getItem('time-management-v1')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw as string) as { syncCalendars: Array<{ id: string; enabled: boolean }> }
      expect(parsed.syncCalendars).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'coord-main', enabled: true }),
          expect.objectContaining({ id: 'google-1', enabled: true }),
        ])
      )
    })
  })

  it('keeps persisted source selections across auth loading transition', async () => {
    localStorage.setItem(
      'time-management-v1',
      JSON.stringify({
        syncCalendars: [
          {
            id: 'coord-main',
            name: 'Coordination Manager Main',
            color: '#2563eb',
            enabled: false,
            sourceType: 'app',
          },
          {
            id: 'google-1',
            name: 'Google Personal',
            color: '#34d399',
            enabled: true,
            sourceType: 'external',
            externalKind: 'google_oauth',
            secondaryLabel: 'user@example.com',
          },
        ],
        slotMinutes: 30,
        timeBackgrounds: [],
        collapsedBackgroundIds: [],
        quickTemplates: [],
        showQuickTemplatesInMain: false,
      })
    )

    const authState = {
      isLoading: true,
      isAuthenticated: false,
      isTraveler: false,
    }
    mockUseAuth.mockImplementation(() => authState)

    mockDedupedGet.mockImplementation(async (url: string) => {
      if (url === '/api/calendar-sources') {
        return {
          data: {
            sources: [
              {
                id: 'google-1',
                source_type: 'google_oauth',
                google_email: 'user@example.com',
                public_url: null,
                display_name: 'Google Personal',
                color: '#34d399',
                is_active: true,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/modes') {
        return {
          data: {
            activeModeId: 'mode-main',
            modes: [
              {
                id: 'mode-main',
                name: 'Main',
                main_color: '#2563eb',
                slot_minutes: 30,
                sync_calendars: [],
                time_backgrounds: [],
                collapsed_background_ids: [],
                quick_templates: [],
                show_quick_templates_in_main: false,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/categories') return { data: { categories: [] } }
      if (url === '/api/user-events') return { data: { events: [] } }
      return { data: {} }
    })

    const rendered = render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockDedupedGet).not.toHaveBeenCalledWith('/api/calendar-sources')
    })

    authState.isLoading = false
    authState.isAuthenticated = true
    rendered.rerender(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockDedupedGet).toHaveBeenCalledWith('/api/calendar-sources')
    })

    const raw = localStorage.getItem('time-management-v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string) as { syncCalendars: Array<{ id: string; enabled: boolean }> }

    expect(parsed.syncCalendars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'google-1', enabled: true }),
      ])
    )
  })

  it('uses the active mode slot width when persisted local width differs', async () => {
    localStorage.setItem(
      'time-management-v1',
      JSON.stringify({
        syncCalendars: [
          {
            id: 'coord-main',
            name: 'Coordination Manager Main',
            color: '#2563eb',
            enabled: false,
            sourceType: 'app',
          },
        ],
        slotMinutes: 15,
        timeBackgrounds: [],
        collapsedBackgroundIds: [],
        quickTemplates: [],
        showQuickTemplatesInMain: true,
      })
    )

    mockDedupedGet.mockImplementation(async (url: string) => {
      if (url === '/api/calendar-sources') {
        return { data: { sources: [] } }
      }
      if (url === '/api/time-management/modes') {
        return {
          data: {
            activeModeId: 'mode-main',
            modes: [
              {
                id: 'mode-main',
                name: 'Main',
                main_color: '#2563eb',
                slot_minutes: 60,
                sync_calendars: [],
                time_backgrounds: [],
                collapsed_background_ids: [],
                quick_templates: [],
                show_quick_templates_in_main: false,
              },
            ],
          },
        }
      }
      if (url === '/api/time-management/categories') return { data: { categories: [] } }
      if (url === '/api/user-events') return { data: { events: [] } }
      return { data: {} }
    })

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TimeManagementPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      const raw = localStorage.getItem('time-management-v1')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw as string) as { slotMinutes: number }
      expect(parsed.slotMinutes).toBe(60)
    })
  })
})
