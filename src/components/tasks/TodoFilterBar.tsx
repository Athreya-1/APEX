'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'

export interface TodoFilterState {
  dateStart: string | null
  dateEnd: string | null
  courses: string[]
  urgentOnly: boolean
}

interface TodoFilterBarProps {
  courses: Array<{ id: string; name: string; label?: string }>
  taskCounts: { byCourse: Record<string, number>; urgent: number }
  filters: TodoFilterState
  onChange: (next: TodoFilterState) => void
}

function hasActiveFilters(f: TodoFilterState): boolean {
  return Boolean(f.dateStart || f.dateEnd || f.courses.length || f.urgentOnly)
}

export function TodoFilterBar({ courses, taskCounts, filters, onChange }: TodoFilterBarProps) {
  const [datesOpen, setDatesOpen] = useState(false)
  const [coursesOpen, setCoursesOpen] = useState(false)
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()))
  const [pickStart, setPickStart] = useState<Date | null>(null)
  const datesRef = useRef<HTMLDivElement>(null)
  const coursesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (datesRef.current && !datesRef.current.contains(e.target as Node)) setDatesOpen(false)
      if (coursesRef.current && !coursesRef.current.contains(e.target as Node)) setCoursesOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const datesLabel = useMemo(() => {
    if (!filters.dateStart && !filters.dateEnd) return 'Dates'
    if (filters.dateStart && filters.dateEnd) {
      return `${format(new Date(filters.dateStart), 'MMM d')} – ${format(new Date(filters.dateEnd), 'MMM d')}`
    }
    if (filters.dateStart) return format(new Date(filters.dateStart), 'MMM d')
    return 'Dates'
  }, [filters.dateStart, filters.dateEnd])

  const courseLabel =
    filters.courses.length === 0
      ? 'All courses'
      : filters.courses.length === 1
        ? filters.courses[0]
        : `${filters.courses.length} courses`

  function clearAll() {
    onChange({ dateStart: null, dateEnd: null, courses: [], urgentOnly: false })
    setPickStart(null)
  }

  function applyRange(start: Date | null, end: Date | null) {
    onChange({
      ...filters,
      dateStart: start ? format(start, 'yyyy-MM-dd') : null,
      dateEnd: end ? format(end, 'yyyy-MM-dd') : null,
    })
    setDatesOpen(false)
    setPickStart(null)
  }

  function presetToday() {
    const d = new Date()
    applyRange(d, d)
  }

  function presetWeek() {
    const now = new Date()
    applyRange(startOfWeek(now, { weekStartsOn: 0 }), endOfWeek(now, { weekStartsOn: 0 }))
  }

  function presetNext7() {
    const now = new Date()
    applyRange(now, addDays(now, 6))
  }

  function presetMonth() {
    const now = new Date()
    applyRange(startOfMonth(now), endOfMonth(now))
  }

  function presetAnytime() {
    applyRange(null, null)
  }

  const anytimeActive = !filters.dateStart && !filters.dateEnd

  function onDayClick(day: Date) {
    if (!pickStart) {
      setPickStart(day)
      return
    }
    const [a, b] = pickStart <= day ? [pickStart, day] : [day, pickStart]
    applyRange(a, b)
  }

  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const rangeStart = filters.dateStart ? new Date(filters.dateStart) : null
  const rangeEnd = filters.dateEnd ? new Date(filters.dateEnd) : null

  function cellClass(day: Date): string {
    const empty = !isSameMonth(day, calMonth) ? ' empty' : ''
    const today = isSameDay(day, new Date()) ? ' today' : ''
    if (!rangeStart) return `cell${empty}${today}`
    const end = rangeEnd ?? rangeStart
    if (isSameDay(day, rangeStart) && isSameDay(day, end)) return `cell single${empty}${today}`
    if (isSameDay(day, rangeStart)) return `cell end1${empty}${today}`
    if (isSameDay(day, end)) return `cell end2${empty}${today}`
    if (isWithinInterval(day, { start: rangeStart, end: end })) return `cell inrange${empty}${today}`
    return `cell${empty}${today}`
  }

  function toggleCourse(name: string) {
    const next = filters.courses.includes(name)
      ? filters.courses.filter((c) => c !== name)
      : [...filters.courses, name]
    onChange({ ...filters, courses: next })
  }

  return (
    <div className="todo-filterbar">
      <div className="todo-fgroup" ref={datesRef}>
        <button
          type="button"
          className={`todo-fbtn${datesOpen || filters.dateStart ? ' active' : ''}${datesOpen ? ' open' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setDatesOpen((v) => !v)
            setCoursesOpen(false)
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          <span>{datesLabel}</span>
        </button>
        <div className={`todo-popover todo-cal${datesOpen ? ' show' : ''}`}>
          <div className="presets">
            <button type="button" className={`preset${anytimeActive ? ' on' : ''}`} onClick={presetAnytime}>
              Anytime
            </button>
            <button type="button" className="preset" onClick={presetToday}>
              Today
            </button>
            <button type="button" className="preset" onClick={presetWeek}>
              This week
            </button>
            <button type="button" className="preset" onClick={presetNext7}>
              Next 7 days
            </button>
            <button type="button" className="preset" onClick={presetMonth}>
              This month
            </button>
          </div>
          <div className="calhead">
            <button type="button" className="calnav" onClick={() => setCalMonth(subMonths(calMonth, 1))} aria-label="Previous month">
              ‹
            </button>
            <span>{format(calMonth, 'MMMM yyyy')}</span>
            <button type="button" className="calnav" onClick={() => setCalMonth(addMonths(calMonth, 1))} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="dow">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>
          <div className="grid">
            {days.map((day) => (
              <button
                key={day.toISOString()}
                type="button"
                className={cellClass(day)}
                onClick={() => !day || isSameMonth(day, calMonth) && onDayClick(day)}
                disabled={!isSameMonth(day, calMonth)}
              >
                {format(day, 'd')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="todo-fgroup" ref={coursesRef}>
        <button
          type="button"
          className={`todo-fbtn${filters.courses.length ? ' active' : ''}${coursesOpen ? ' open' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setCoursesOpen((v) => !v)
            setDatesOpen(false)
          }}
        >
          <span>{courseLabel}</span>
          <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div className={`todo-popover${coursesOpen ? ' show' : ''}`}>
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`popopt${filters.courses.includes(c.name) ? ' on' : ''}`}
              onClick={() => toggleCourse(c.name)}
            >
              {c.label ?? c.name}
              <span className="cnt">{taskCounts.byCourse[c.name] ?? 0}</span>
            </button>
          ))}
          {courses.length === 0 && (
            <div className="popopt" style={{ cursor: 'default' }}>
              No courses yet
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`todo-fbtn${filters.urgentOnly ? ' active' : ''}`}
        onClick={() => onChange({ ...filters, urgentOnly: !filters.urgentOnly })}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
        </svg>
        Urgent
      </button>

      <button
        type="button"
        className={`todo-fclear${hasActiveFilters(filters) ? ' show' : ''}`}
        onClick={clearAll}
      >
        Clear
      </button>
    </div>
  )
}

export function applyTodoFilters<T extends {
  status: string
  urgency_score: number
  topic?: string | null
  do_date?: string | null
  due_date?: string | null
}>(tasks: T[], filters: TodoFilterState): T[] {
  return tasks.filter((task) => {
    if (filters.urgentOnly && task.urgency_score <= 0.6) return false
    if (filters.courses.length) {
      const topic = (task.topic ?? '').toLowerCase()
      if (!filters.courses.some((c) => topic.includes(c.toLowerCase()))) return false
    }
    if (filters.dateStart || filters.dateEnd) {
      const start = filters.dateStart ? new Date(filters.dateStart) : null
      const end = filters.dateEnd ? new Date(filters.dateEnd) : start
      const dates = [task.do_date, task.due_date?.slice(0, 10)].filter(Boolean) as string[]
      if (!dates.length) return false
      const inRange = dates.some((d) => {
        const dt = new Date(d)
        if (start && end) return isWithinInterval(dt, { start, end })
        if (start) return isSameDay(dt, start)
        return true
      })
      if (!inRange) return false
    }
    return true
  })
}
