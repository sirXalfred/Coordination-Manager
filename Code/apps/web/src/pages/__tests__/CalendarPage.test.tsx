import '@testing-library/jest-dom'
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CalendarPage from '../CalendarPage'
import { apiClient } from '../../lib/api-client'

const mockUseAuth = vi.fn()
const mockUseLearnerMode = vi.fn()
const mockSetPageContext = vi.fn()
const mockShowToast = vi.fn()

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../contexts/LearnerModeContext', () => ({
  useLearnerMode: () => mockUseLearnerMode(),
}))

vi.mock('../../contexts/AiAssistantContext', () => ({
  useAiAssistant: () => ({
    setPageContext: mockSetPageContext,
  }),
}))

vi.mock('../../contexts/LayoutContext', () => ({
  LeftPanelPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

vi.mock('../../components/TimezoneSelector', () => ({
  default: () => <div data-testid="timezone-selector" />,
}))

vi.mock('../../components/DualThumbSlider', () => ({
  default: () => <div data-testid="dual-thumb-slider" />,
}))

vi.mock('../../components/LearnerHelpIcon', () => ({
  default: () => null,
}))

vi.mock('../../components/ImportAvailabilityModal', () => ({
  default: () => null,
}))

vi.mock('../../components/MeetingSidePanel', () => ({
  default: () => null,
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
    canAddMore: false,
    getEntry: vi.fn(),
  }),
}))

vi.mock('../../lib/timezone-data', () => ({
  findTimezone: () => undefined,
  convertUtcTimeToTimezone: (value: string) => value,
  getCurrentTimeInTimezone: () => '12:00',
  formatUtcTimeWithPeriodInTimezone: (value: string) => value,
  convertUtcTimeToTimezoneOnDate: (value: string) => value,
  detectDstTransitions: () => [],
}))

vi.mock('../../lib/calendar-utils', () => ({
  isSafeUrl: () => true,
}))

function mockCalendarResponse() {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/api/availability/user/past?exclude_hash=test-hash') {
      return { data: { entries: [] } }
    }

    if (url === '/api/calendars/test-hash') {
      return {
        data: {
          title: 'Team Calendar',
          visibility: 'unlisted',
          created_by: 'owner@example.com',
          creator_display_name: 'Owner',
          is_owner: true,
          has_edit_permission: true,
          permissions: { canEdit: [] },
          config: {
            eventName: 'Team Calendar',
            timeInterval: 30,
            hideDateNumbers: false,
            customStartDate: '2026-06-08',
            customEndDate: '2026-06-14',
          },
        },
      }
    }

    if (url === '/api/calendar-subscriptions/check/test-hash') {
      return { data: { subscribed: false } }
    }

    if (url === '/api/availability/test-hash') {
      return { data: [] }
    }

    if (url === '/api/meetings/test-hash') {
      return { data: [] }
    }

    if (url === '/api/calendar-sources') {
      return { data: { sources: [] } }
    }

    if (url === '/api/time-management/modes') {
      return {
        data: {
          activeModeId: 'mode-1',
          modes: [
            {
              id: 'mode-1',
              name: 'Focus',
              main_color: '#0EA5E9',
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
      return {
        data: {
          events: [
            {
              id: 'event-1',
              source_type: 'manual',
              source_id: 'mode-1',
              title: 'Secret Swarm planning session',
              start_time: '2026-06-10T10:00:00Z',
              end_time: '2026-06-10T11:00:00Z',
              recurrence_rule: null,
            },
          ],
        },
      }
    }

    throw new Error(`Unexpected GET ${url}`)
  })

  vi.mocked(apiClient.post).mockImplementation(async (url: string) => {
    throw new Error(`Unexpected POST ${url}`)
  })
}

function renderCalendarPage() {
  return render(
    <MemoryRouter initialEntries={["/calendar/test-hash"]}>
      <Routes>
        <Route path="/calendar/:hash" element={<CalendarPage />} />
      </Routes>
    </MemoryRouter>
  )
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function openCalendarSyncsPanel(): Promise<void> {
  const buttons = screen.getAllByRole('button', { name: 'Calendar Syncs' })
  for (const button of buttons) {
    fireEvent.click(button)
    await flushMicrotasks()
    if (screen.queryByText('Google Calendar')) {
      return
    }
  }
}

describe('CalendarPage Secret Swarm syncs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T12:00:00Z'))
    localStorage.clear()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      isAuthenticated: true,
      isTraveler: false,
      isCardano: false,
    })
    mockUseLearnerMode.mockReturnValue({ learnerMode: false })
    mockCalendarResponse()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows Secret Swarm only when time items exist, auto-selects it, and marks the busy slot', async () => {
    renderCalendarPage()

    await flushMicrotasks()
    await flushMicrotasks()

    expect(screen.getAllByRole('button', { name: 'Calendar Syncs' }).length).toBeGreaterThan(0)
    await openCalendarSyncsPanel()
    expect(screen.getByText('Secret Swarm')).toBeInTheDocument()

    const modeCheckbox = screen.getByRole('checkbox', { name: 'Focus mode' })
    expect(modeCheckbox).toBeChecked()

    const busyCell = document.querySelector('[data-cell-id="2026-06-10_10:00"]') as HTMLElement | null
    expect(busyCell).not.toBeNull()
    if (!busyCell) return

    expect(busyCell.querySelectorAll('div[style*="repeating-linear-gradient"]').length).toBeGreaterThan(0)

    expect(vi.mocked(apiClient.post)).not.toHaveBeenCalledWith('/api/calendar-sources/busy', expect.anything())
  })

  it('hides Secret Swarm when the user has no time items', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/api/availability/user/past?exclude_hash=test-hash') {
        return { data: { entries: [] } }
      }
      if (url === '/api/calendars/test-hash') {
        return {
          data: {
            title: 'Team Calendar',
            visibility: 'unlisted',
            created_by: 'owner@example.com',
            creator_display_name: 'Owner',
            is_owner: true,
            has_edit_permission: true,
            permissions: { canEdit: [] },
            config: {
              eventName: 'Team Calendar',
              timeInterval: 30,
              hideDateNumbers: false,
              customStartDate: '2026-06-08',
              customEndDate: '2026-06-14',
            },
          },
        }
      }
      if (url === '/api/calendar-subscriptions/check/test-hash') {
        return { data: { subscribed: false } }
      }
      if (url === '/api/availability/test-hash') {
        return { data: [] }
      }
      if (url === '/api/meetings/test-hash') {
        return { data: [] }
      }
      if (url === '/api/calendar-sources') {
        return { data: { sources: [] } }
      }
      if (url === '/api/time-management/modes') {
        return {
          data: {
            activeModeId: 'mode-1',
            modes: [
              {
                id: 'mode-1',
                name: 'Focus',
                main_color: '#0EA5E9',
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
      throw new Error(`Unexpected GET ${url}`)
    })

    renderCalendarPage()

    await flushMicrotasks()
    await flushMicrotasks()

    expect(screen.getAllByRole('button', { name: 'Calendar Syncs' }).length).toBeGreaterThan(0)
    await openCalendarSyncsPanel()
    expect(screen.queryByText('Secret Swarm')).not.toBeInTheDocument()
  })
})
