import { ArrowLeftIcon, PencilIcon, UserMinusIcon } from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Career } from '@/lib/api'
import { formatSubjectName } from '@/lib/sanitize'
import type { Teacher } from '@/lib/tutoring-api'
import { RecordTable } from './tutoring-shared'

/**
 * Pantalla de un docente: se abre al pulsar su fila. Arriba su nombre, su estado y sus
 * acciones (editar, quitar de la carrera); debajo, sus asignaturas y sus datos.
 */
export function TeacherDetail({
  teacher,
  careers,
  pending,
  onBack,
  onEdit,
  onUnlink,
}: Readonly<{
  teacher: Teacher
  /** Carreras que coordina quien consulta. */
  careers: readonly Career[]
  pending: boolean
  onBack: () => void
  onEdit: () => void
  onUnlink: (career: Career) => void
}>) {
  const manageable = teacher.can_manage && teacher.is_active
  const coordinatedCareers = careers.filter((career) => teacher.career_ids.includes(career.id))
  const tutorings = teacher.tutorings ?? []

  return (
    <div className="flex flex-col gap-6" data-tour-view="detail">
      <div>
        <Button type="button" variant="tertiary" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a docentes
        </Button>
      </div>

      <AdminSectionHeader
        title={teacher.name}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge active={teacher.is_active} />
            {manageable && (
              <Button type="button" variant="tertiary" size="icon" aria-label="Editar docente" disabled={pending} onClick={onEdit}>
                <PencilIcon />
              </Button>
            )}
            {manageable && coordinatedCareers.length === 1 && (
              <Button type="button" variant="tertiary" size="icon" tone="destructive" aria-label={`Quitar de ${coordinatedCareers[0].name}`} disabled={pending} onClick={() => onUnlink(coordinatedCareers[0])}>
                <UserMinusIcon />
              </Button>
            )}
            {manageable && coordinatedCareers.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="tertiary" size="icon" tone="destructive" aria-label="Quitar de una carrera" disabled={pending}>
                    <UserMinusIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {coordinatedCareers.map((career) => (
                    <DropdownMenuItem key={career.id} variant="destructive" onSelect={() => onUnlink(career)}>Quitar de {career.name}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {!teacher.can_manage && (
        <p className="text-sm text-muted-foreground">Solo consulta: los cambios de este docente están a cargo de administración.</p>
      )}

      <Tabs defaultValue="tutorings">
        <TabsList aria-label="Secciones del docente">
          <TabsTrigger value="tutorings">Asignaturas</TabsTrigger>
          <TabsTrigger value="data">Datos</TabsTrigger>
        </TabsList>
        <TabsContent value="tutorings">
          <RecordTable
            rows={tutorings}
            loading={false}
            empty="No dicta tutorías vigentes en tus carreras."
            columns={[
              { label: 'Asignatura', render: (tutoring) => formatSubjectName(tutoring.subject_name) },
              { label: 'Ciclo', render: (tutoring) => tutoring.cycle_number ?? <span className="text-muted-foreground">—</span> },
              { label: 'Paralelo', render: (tutoring) => tutoring.section_name ? tutoring.section_name.replace(/^Paralelo\s+/i, '') : <span className="text-muted-foreground">—</span> },
            ]}
          />
        </TabsContent>
        <TabsContent value="data">
          <dl className="grid max-w-2xl gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Datum label="Cédula o pasaporte" value={teacher.identification ?? 'Sin registrar'} />
            <Datum label="Correo institucional" value={teacher.email} />
            <Datum label="Teléfono" value={teacher.phone || 'Sin teléfono'} />
          </dl>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Datum({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}
