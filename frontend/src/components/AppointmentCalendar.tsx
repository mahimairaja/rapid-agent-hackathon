import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SessionSlot, SessionSlotsResponse } from '../types'
import { getClientTimeZone, getSessionSlots, postSessionBook } from '../api/client'

interface AppointmentCalendarProps {
  sessionId: string | null
  // Called after a successful booking so the app can refetch the session
  // context (timeline, dashboard, grounding panel all stay in sync).
  onBooked: () => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

const EMPTY_STATE_COPY: Record<string, string> = {
  unverified:
    'Say hi to your assistant first — once it knows you, your follow-up slots appear here.',
  none_required: 'Your plan does not require a follow-up visit. Nothing to book 🎉',
  no_window: 'Your plan has no follow-up window, so there are no slots to offer.',
  scheduler_unavailable: 'The scheduling system is not reachable right now — try again shortly.',
  already_booked: 'A follow-up was just booked in your conversation — schedule refreshed.',
}

/**
 * Cal.com-look booking widget: a month grid clamped to the follow-up window on
 * the left, the selected day's slot pills on the right. One click books (or
 * reschedules) through the session-scoped endpoints, so the follow-up window
 * and the appointment mirror are always respected.
 */
export function AppointmentCalendar({ sessionId, onBooked }: AppointmentCalendarProps) {
  // data === null means the slots are still loading.
  const [data, setData] = useState<SessionSlotsResponse | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<SessionSlot | null>(null)
  const [booking, setBooking] = useState(false)
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    if (!sessionId) return
    const result = await getSessionSlots(sessionId, getClientTimeZone())
    setData(result)
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!sessionId) return
      const result = await getSessionSlots(sessionId, getClientTimeZone())
      if (!cancelled) setData(result)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const slotsByDay = useMemo(() => {
    const map = new Map<string, SessionSlot[]>()
    for (const slot of data?.slots ?? []) {
      const key = dayKey(new Date(slot.start_iso))
      map.set(key, [...(map.get(key) ?? []), slot])
    }
    return map
  }, [data])

  // The month grid covers the follow-up window's month(s); clamp to one grid
  // anchored on the window start for simplicity (demo windows span days).
  const grid = useMemo(() => {
    if (!data?.window) return null
    const start = new Date(data.window.start_iso)
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1)
    const firstCell = new Date(monthStart)
    firstCell.setDate(1 - monthStart.getDay())
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstCell)
      d.setDate(firstCell.getDate() + i)
      cells.push(d)
    }
    return { monthStart, cells }
  }, [data])

  // The shown day defaults to the first day with slots; a user pick sticks
  // while that day still has availability (derived, not synced via effect).
  const firstDayWithSlots = slotsByDay.size > 0 ? [...slotsByDay.keys()].sort()[0] : null
  const effectiveDay = selectedDay && slotsByDay.has(selectedDay) ? selectedDay : firstDayWithSlots

  const book = async (slot: SessionSlot) => {
    if (!sessionId) return
    setBooking(true)
    setNotice('')
    const result = await postSessionBook(sessionId, {
      start_iso: slot.start_iso,
      time_zone: getClientTimeZone(),
    })
    setBooking(false)
    setConfirming(null)
    if (result.status === 'booked' || result.status === 'rescheduled') {
      setNotice(
        result.status === 'booked'
          ? `Booked: ${result.booking?.start_local ?? slot.start_local} ✓`
          : `Moved to ${result.booking?.start_local ?? slot.start_local} ✓`,
      )
      await refresh()
      onBooked()
    } else {
      setNotice(
        EMPTY_STATE_COPY[result.status] ?? 'That slot could not be booked — pick another one.',
      )
      await refresh()
    }
  }

  if (!sessionId || (data && data.status !== 'ok')) {
    const status = !sessionId ? 'unverified' : (data?.status ?? 'unverified')
    return (
      <div className="cal-widget card">
        <div className="cal-empty">
          {EMPTY_STATE_COPY[status] ?? 'Slots are unavailable right now.'}
          {status === 'scheduler_unavailable' && (
            <button type="button" className="suggestion-chip" onClick={() => void refresh()}>
              ↻ Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!data || !grid) {
    return (
      <div className="cal-widget card">
        <div className="cal-empty">Loading available slots…</div>
      </div>
    )
  }

  const monthLabel = grid.monthStart.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const currentBooking = data.current_booking
  const daySlots = effectiveDay ? (slotsByDay.get(effectiveDay) ?? []) : []
  const bookedDayKey = currentBooking?.start_iso ? dayKey(new Date(currentBooking.start_iso)) : null

  return (
    <div className="cal-widget card">
      <div className="cal-header">
        <div>
          <div className="card-title">📆 Book your follow-up</div>
          <div className="card-subtitle">
            {currentBooking
              ? `Currently booked: ${currentBooking.start_local} — pick a new slot to move it`
              : 'Pick any available slot inside your follow-up window'}
          </div>
        </div>
        {notice && <div className="cal-notice">{notice}</div>}
      </div>

      <div className="cal-body">
        {/* Month grid */}
        <div className="cal-month">
          <div className="cal-month-label">{monthLabel}</div>
          <div className="cal-grid">
            {WEEKDAYS.map((d) => (
              <div key={d} className="cal-weekday">
                {d}
              </div>
            ))}
            {grid.cells.map((d) => {
              const key = dayKey(d)
              const inMonth = d.getMonth() === grid.monthStart.getMonth()
              const hasSlots = slotsByDay.has(key)
              const isSelected = key === effectiveDay
              const isBooked = key === bookedDayKey
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'cal-day',
                    inMonth ? '' : 'cal-day-out',
                    hasSlots ? 'cal-day-active' : '',
                    isSelected ? 'cal-day-selected' : '',
                    isBooked ? 'cal-day-booked' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!hasSlots}
                  onClick={() => {
                    setSelectedDay(key)
                    setConfirming(null)
                  }}
                >
                  <span>{d.getDate()}</span>
                  {hasSlots && <span className="cal-day-dot" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Slot pills */}
        <div className="cal-slots">
          <div className="cal-slots-label">
            {effectiveDay
              ? new Date(`${effectiveDay}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Pick a day'}
          </div>
          {daySlots.length === 0 && (
            <div className="cal-slots-empty">No open times this day — pick a dotted day.</div>
          )}
          {daySlots.map((slot) => {
            const isHeld =
              currentBooking?.start_iso &&
              new Date(currentBooking.start_iso).getTime() === new Date(slot.start_iso).getTime()
            const isConfirming = confirming?.start_iso === slot.start_iso
            return (
              <button
                key={slot.start_iso}
                type="button"
                className={`cal-slot${isHeld ? ' cal-slot-held' : ''}${
                  isConfirming ? ' cal-slot-confirming' : ''
                }`}
                disabled={booking || Boolean(isHeld)}
                onClick={() => (isConfirming ? void book(slot) : setConfirming(slot))}
              >
                {isHeld
                  ? `✓ ${slot.start_local.split(' at ').pop() ?? slot.start_local} (yours)`
                  : isConfirming
                    ? booking
                      ? 'Booking…'
                      : `Confirm ${slot.start_local.split(' at ').pop() ?? ''}`
                    : (slot.start_local.split(' at ').pop() ?? slot.start_local)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
