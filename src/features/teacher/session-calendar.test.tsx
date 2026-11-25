import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TeacherTutoring, TutoringSession } from '@/lib/teacher-api'
import { SessionCalendar, sessionDateIssue } from './session-calendar'

afterEach(() => cleanup())

// Período del 1 de mayo al 31 de octubre de 2026; clase los lunes (y un jueves deshabilitado).
const tutoring: TeacherTutoring = {
  id: 40, subject_id: 30, subject_name: 'Calidad de software', cycle_id: 20, cycle_name: 'Segundo', career_id: 10, career_name: 'Software',
  period_id: 50, period_name: '2026-2', period_start_date: '2026-05-01', period_end_date: '2026-10-31', modality_id: 60, modality_name: 'Presencial',
  section_id: 1, section_name: 'A', teacher_id: 5, teacher_name: 'María López', teacher_is_active: true, is_active: true, can_manage: true, active_enrollment_count: 1,
  schedules: [
    { id: 1, tutoring_id: 40, day: 'lunes', start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: true },
    { id: 2, tutoring_id: 40, day: 'Jueves', start_time: '08:00', end_time: '10:00', room: 'Aula 1', is_active: false },
  ],
}
const session = (date: string): TutoringSession => ({ id: 1, tutoring_id: 40, number: 1, date, topics_covered: false, topics: [], attendance: [] })
const TODAY = '2026-09-29'

describe('sessionDateIssue', () => {
  it('aplica la misma regla que el servidor: días con clase del período hasta hoy', () => {
    expect(sessionDateIssue(tutoring, '2026-09-28', TODAY)).toBeNull()
    expect(sessionDateIssue(tutoring, '2026-10-05', TODAY)).toBe('No se pueden registrar sesiones de fechas futuras.')
    expect(sessionDateIssue(tutoring, '2026-04-27', TODAY)).toBe('La fecha está fuera del período académico de la tutoría.')
    expect(sessionDateIssue(tutoring, '2026-09-24', TODAY)).toBe('La tutoría no tiene clase ese día.')
    expect(sessionDateIssue({ ...tutoring, schedules: [] }, '2026-09-28', TODAY)).toBe('Registra el horario de la tutoría en la pestaña Horarios para poder tomar asistencia.')
  })
})

describe('SessionCalendar', () => {
  it('habilita solo los días con clase del período hasta hoy y marca los que tienen sesión', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SessionCalendar tutoring={tutoring} sessions={[session('2026-09-21')]} today={TODAY} onSelect={onSelect} />)

    expect(screen.getByRole('heading', { name: 'Septiembre de 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'lunes 21 de septiembre de 2026, sesión registrada' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'lunes 28 de septiembre de 2026' })).toBeEnabled()
    // Hoy es martes: sin clase. El jueves tiene un horario deshabilitado. El lunes 5 de octubre es futuro.
    expect(screen.getByRole('button', { name: 'martes 29 de septiembre de 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'jueves 24 de septiembre de 2026' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByRole('button', { name: 'lunes 5 de octubre de 2026' })).toBeDisabled()
    // No se navega antes del inicio del período.
    for (let index = 0; index < 4; index++) await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(screen.getByRole('heading', { name: 'Junio de 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(screen.getByRole('heading', { name: 'Mayo de 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'lunes 4 de mayo de 2026' }))
    expect(onSelect).toHaveBeenCalledWith('2026-05-04')
  })

  it('en modo consulta solo abre los días con una sesión registrada', () => {
    render(<SessionCalendar tutoring={{ ...tutoring, can_manage: false }} sessions={[session('2026-09-21')]} today={TODAY} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'lunes 21 de septiembre de 2026, sesión registrada' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'lunes 28 de septiembre de 2026' })).toBeDisabled()
  })
})
