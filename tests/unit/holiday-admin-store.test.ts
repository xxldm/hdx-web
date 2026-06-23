import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHolidayAdminStore } from '../../app/stores/holiday-admin'
import type { HolidayAdminRecord } from '../../app/types/hdx-api'

const fetchAdminHolidaysMock = vi.hoisted(() => vi.fn())
const createAdminHolidayMock = vi.hoisted(() => vi.fn())
const updateAdminHolidayMock = vi.hoisted(() => vi.fn())
const deleteAdminHolidayMock = vi.hoisted(() => vi.fn())

vi.mock('../../app/utils/hdx-api-client', () => ({
  fetchAdminHolidays: fetchAdminHolidaysMock,
  createAdminHoliday: createAdminHolidayMock,
  updateAdminHoliday: updateAdminHolidayMock,
  deleteAdminHoliday: deleteAdminHolidayMock
}))

describe('holiday admin store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchAdminHolidaysMock.mockReset()
    createAdminHolidayMock.mockReset()
    updateAdminHolidayMock.mockReset()
    deleteAdminHolidayMock.mockReset()
    fetchAdminHolidaysMock.mockResolvedValue([
      holidayRecord(2, 1, 'national-day', '国庆节', '2000-10-01', true, true, 20),
      holidayRecord(1, 1, 'new-year', '元旦', '2000-01-01', true, true, 0)
    ])
  })

  it('loads admin holidays ordered by sort order', async () => {
    const store = useHolidayAdminStore()

    const result = await store.loadHolidays()

    expect(result).toBe('success')
    expect(store.holidays.map(holiday => holiday.holidayKey)).toEqual(['new-year', 'national-day'])
  })

  it('upserts created holidays into the list', async () => {
    const store = useHolidayAdminStore()
    await store.loadHolidays()
    createAdminHolidayMock.mockResolvedValueOnce(holidayRecord(3, 1, 'demo', '测试', '2026-06-23', false, true, 10))

    const result = await store.createHoliday({
      holidayKey: 'demo',
      displayName: '测试',
      description: null,
      date: '2026-06-23',
      recurring: false,
      enabled: true,
      sortOrder: 10
    })

    expect(result).toBe('success')
    expect(store.holidays.map(holiday => holiday.holidayKey)).toEqual(['new-year', 'demo', 'national-day'])
  })

  it('applies server holiday when update conflicts', async () => {
    const store = useHolidayAdminStore()
    await store.loadHolidays()
    const serverHoliday = holidayRecord(1, 2, 'new-year', '服务器元旦', '2000-01-01', true, true, 0)
    updateAdminHolidayMock.mockRejectedValueOnce({
      statusCode: 409,
      data: {
        code: 'HOLIDAY_CONFLICT',
        message: '节日已在其他位置更新，请处理冲突。',
        resourceType: 'holiday',
        resourceId: 1,
        resourceLabel: '服务器元旦',
        baseVersion: 1,
        currentVersion: 2,
        updatedAt: '2026-06-23T12:00:00Z',
        updatedByUserId: 'USER:1',
        serverHoliday
      }
    })

    const result = await store.updateHoliday(1, {
      version: 1,
      displayName: '客户端元旦',
      description: null,
      date: '2000-01-01',
      recurring: true,
      enabled: true,
      sortOrder: 0
    })

    expect(result).toBe('conflict')
    expect(store.conflict?.serverHoliday.displayName).toBe('服务器元旦')
    expect(store.holidays[0]?.displayName).toBe('服务器元旦')
  })

  it('removes holidays after delete succeeds', async () => {
    const store = useHolidayAdminStore()
    await store.loadHolidays()
    deleteAdminHolidayMock.mockResolvedValueOnce(holidayRecord(1, 2, 'new-year', '元旦', '2000-01-01', true, true, 0))

    const result = await store.deleteHoliday(store.holidays[0]!)

    expect(result).toBe('success')
    expect(store.holidays.map(holiday => holiday.holidayKey)).toEqual(['national-day'])
  })
})

function holidayRecord(
  id: number,
  version: number,
  holidayKey: string,
  displayName: string,
  date: string,
  recurring: boolean,
  enabled: boolean,
  sortOrder: number
): HolidayAdminRecord {
  return {
    id,
    version,
    holidayKey,
    displayName,
    description: null,
    date,
    recurring,
    enabled,
    sortOrder,
    updatedAt: '2026-06-23T12:00:00Z',
    updatedByUserId: 'USER:1'
  }
}
