import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../app/stores/auth'
import {
  getUpcomingWorkbenchHolidays,
  normalizeWorkbenchHolidays,
  useWorkbenchDateCountdownStore,
  type WorkbenchHoliday
} from '../../app/stores/workbench-date-countdown'
import type { WebAuthPublicSession } from '../../app/types/hdx-auth'

const fetchHolidaysMock = vi.hoisted(() => vi.fn())
const authenticatedSession = {
  authenticated: true,
  csrfToken: 'a'.repeat(64),
  accessTokenExpiresAt: '2026-06-06T10:15:00Z',
  refreshTokenExpiresAt: '2026-06-13T10:00:00Z',
  sid: 'session-id',
  actorType: 'USER',
  subject: 'USER:1',
  user: {
    id: 1,
    displayName: '用户'
  },
  roles: ['USER'],
  permissions: ['workbench:read']
} satisfies WebAuthPublicSession

vi.mock('../../app/utils/hdx-api-client', () => ({
  fetchHolidays: fetchHolidaysMock
}))

describe('workbench date countdown store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchHolidaysMock.mockReset()
    fetchHolidaysMock.mockResolvedValue([
      holidayRecord(1, 'national-day', '国庆节', '2000-10-01', true, 20),
      holidayRecord(2, 'new-year', '元旦', '2000-01-01', true, 0)
    ])
  })

  it('loads holidays from backend and exposes upcoming countdowns', async () => {
    const store = useWorkbenchDateCountdownStore()

    const result = await store.loadHolidays()

    expect(result).toBe('success')
    expect(store.holidays.map(holiday => holiday.holidayKey)).toEqual(['new-year', 'national-day'])
  })

  it('normalizes invalid payloads to an empty list', () => {
    expect(normalizeWorkbenchHolidays([{ holidayKey: '' }])).toEqual([])
  })

  it('keeps today at zero days and skips past one-off holidays', () => {
    const holidays: WorkbenchHoliday[] = [
      holiday('today', '今天节日', '2026-01-01', false, 0),
      holiday('past', '过期节日', '2025-12-31', false, 1),
      holiday('new-year', '元旦', '2000-01-01', true, 2)
    ]

    const upcoming = getUpcomingWorkbenchHolidays(holidays, new Date(2026, 0, 1, 12).getTime())

    expect(upcoming.map(holiday => `${holiday.holidayKey}:${holiday.daysUntil}`))
      .toEqual(['today:0', 'new-year:0'])
  })

  it('marks auth as expired when holiday loading requires login', async () => {
    const auth = useAuthStore()
    auth.session = authenticatedSession
    fetchHolidaysMock.mockRejectedValueOnce({
      statusCode: 401,
      data: {
        code: 'auth-required'
      }
    })
    const store = useWorkbenchDateCountdownStore()

    const result = await store.loadHolidays()

    expect(result).toBe('auth-expired')
    expect(auth.authenticated).toBe(false)
    expect(store.unavailable).toBe(true)
  })
})

function holidayRecord(id: number, holidayKey: string, displayName: string, date: string, recurring: boolean, sortOrder: number) {
  return {
    id,
    holidayKey,
    displayName,
    description: null,
    date,
    recurring,
    sortOrder
  }
}

function holiday(holidayKey: string, displayName: string, date: string, recurring: boolean, sortOrder: number): WorkbenchHoliday {
  return {
    id: sortOrder + 1,
    holidayKey,
    displayName,
    description: null,
    date,
    recurring,
    sortOrder
  }
}
