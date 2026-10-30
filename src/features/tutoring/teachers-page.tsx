import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2Icon, GraduationCapIcon, LinkIcon, MoreVerticalIcon, PowerOffIcon, SaveIcon, UserPlusIcon, XCircleIcon, XIcon } from 'lucide-react'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog } from '@/components/ui/dialog'
import { ErrorModal } from '@/components/ui/error-modal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { SelectField } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { tutoringApi, type AvailableTeacher, type Teacher } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { FilterBar } from './filter-bar'
import { RowActions } from './row-actions'
import { ErrorNotice } from '@/components/ui/error-notice'
import { ModuleHeader, RecordTable, ScopeNotice } from './tutoring-shared'
import { useOperation, useTutoringCatalogs } from './tutoring-hooks'

const EMPTY_FORM = { career_id: '', identification: '', name: '', email: '', phone: '' }

export function TutoringTeachersPage() {
  const catalogs = useTutoringCatalogs()
  const [careerFilter, setCareerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const list = usePaginatedCatalog(
    (page, search) => tutoringApi.teachers({
      page,
      search,
      career_id: Number(careerFilter) || undefined,
      status: statusFilter || undefined,
    }),
    `${careerFilter}|${statusFilter}`,
  )
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [deactivating, setDeactivating] = useState<Teacher | null>(null)
  const [unlinking, setUnlinking] = useState<{ teacher: Teacher; careerId: number; careerName: string } | null>(null)
  const [viewingCareersTeacher, setViewingCareersTeacher] = useState<Teacher | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkCareerId, setLinkCareerId] = useState('')
  const [linkSearch, setLinkSearch] = useState('')
  const [linkSelected, setLinkSelected] = useState<AvailableTeacher | null>(null)
  const [linkCandidates, setLinkCandidates] = useState<readonly AvailableTeacher[]>([])
  const [linkLoading, setLinkLoading] = useState(false)

  // Busca docentes que aún no pertenecen a la carrera elegida (con debounce al escribir).
  useEffect(() => {
    if (!linkOpen || !linkCareerId) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLinkLoading(true)
      tutoringApi.availableTeachers(linkSearch.trim(), Number(linkCareerId))
        .then((teachers) => { if (!cancelled) setLinkCandidates(teachers) })
        .catch(() => { if (!cancelled) setLinkCandidates([]) })
        .finally(() => { if (!cancelled) setLinkLoading(false) })
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [linkOpen, linkCareerId, linkSearch])

  function openLink() {
    const activeCareers = catalogs.careers.filter((career) => career.status)
    setLinkCareerId(activeCareers.length === 1 ? String(activeCareers[0].id) : '')
    setLinkSearch('')
    setLinkSelected(null)
    setLinkCandidates([])
    operation.clearError()
    setLinkOpen(true)
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void operation.run(() => tutoringApi.linkTeacherToCareer(linkSelected?.id ?? 0, Number(linkCareerId)), 'Docente vinculado a la carrera.', async () => { setLinkOpen(false); await list.reload() })
  }

  function edit(teacher: Teacher | null) {
    const defaultCareerId = (careerFilter && catalogs.careers.some((c) => String(c.id) === careerFilter))
      ? careerFilter
      : (catalogs.careers[0] ? String(catalogs.careers[0].id) : '')
    const next = teacher
      ? { career_id: String(teacher.career_ids[0] ?? defaultCareerId), identification: teacher.identification, name: teacher.name, email: teacher.email, phone: teacher.phone ?? '' }
      : { ...EMPTY_FORM, career_id: defaultCareerId }
    setEditing(teacher)
    setForm(next)
    setInitialForm(next)
    operation.clearError()
    setOpen(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const careerId = Number(form.career_id) || Number(careerFilter) || (catalogs.careers[0]?.id ?? 0)
    // La cédula de un docente ya registrado no se modifica.
    const input = { identification: editing ? editing.identification : form.identification.trim(), name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() }
    void operation.run(() => editing ? tutoringApi.updateTeacher(editing.id, input) : tutoringApi.createTeacher({ ...input, career_id: careerId }), editing ? 'Docente actualizado.' : 'Docente registrado.', async () => { setOpen(false); await list.reload() })
  }

  function clearFilters() {
    setCareerFilter('')
    setStatusFilter('')
  }

  // Errores de validación en vivo; el primero bloquea "Guardar" y se explica en su tooltip.
  const teacherErrors: Partial<Record<'identification' | 'name' | 'email' | 'phone', string>> = {}
  if (!editing) {
    if (!form.identification.trim()) teacherErrors.identification = 'La cédula o pasaporte es obligatoria.'
    else if (!isValidIdentification(form.identification)) teacherErrors.identification = 'La cédula o pasaporte no es válida.'
  }
  if (!form.name.trim()) teacherErrors.name = 'El nombre es obligatorio.'
  if (!form.email.trim()) teacherErrors.email = 'El correo institucional es obligatorio.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) teacherErrors.email = 'Escribe un correo electrónico válido.'
  if (!form.phone.trim()) teacherErrors.phone = 'El teléfono es obligatorio.'
  else if (!/^\d{10}$/.test(form.phone.trim())) teacherErrors.phone = 'El teléfono debe tener 10 dígitos numéricos.'

  return <section className="flex flex-col gap-6">
    <ModuleHeader title="Docentes" createLabel="Registrar docente nuevo" onCreate={() => edit(null)} extraActions={<><BulkImportButton type="teachers" title="Carga masiva de docentes" description="Cada docente recibirá su contraseña provisional por correo y completará sus datos al ingresar." onFinished={list.reload} /><Button type="button" variant="secondary" onClick={openLink} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)}><LinkIcon data-icon="inline-start" />Vincular docente existente</Button></>} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
    <ScopeNotice catalogs={catalogs} />
    <FilterBar
      id="teachers"
      search={list.searchInput}
      onSearch={list.setSearchInput}
      searchPlaceholder="Busca por nombre o correo…"
      onClear={clearFilters}
      filters={[
        ...(catalogs.careers.length > 1
          ? [{ id: 'career', label: 'Carrera', value: careerFilter, onChange: setCareerFilter, allLabel: 'Todas mis carreras', options: catalogs.careers.map((career) => ({ value: String(career.id), label: career.name })) }]
          : []),
        { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
      ]}
    />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={list.data} loading={list.isFetching || list.isInitialLoading} empty="No se encontraron docentes para esta búsqueda." onRowClick={(teacher) => { if (teacher.can_manage && teacher.is_active && !operation.pending) edit(teacher) }} rowTitle={(teacher) => teacher.can_manage && teacher.is_active ? `Editar ${teacher.name}` : ''} columns={[
      { label: 'Docente', render: (teacher) => <div className="flex flex-col gap-1"><span className="font-medium">{teacher.name}</span><span className="text-xs text-muted-foreground">{teacher.identification}</span></div> },
      { label: 'Contacto', render: (teacher) => <div className="flex flex-col gap-1"><span>{teacher.email}</span><span className="text-xs text-muted-foreground">{teacher.phone || 'Sin teléfono'}</span></div> },
      {
        label: 'Carreras', render: (teacher) => {
          if (teacher.career_ids.length === 0) return <span className="text-xs text-muted-foreground">Sin carreras</span>
          return (
            <RowActions>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setViewingCareersTeacher(teacher)}
                aria-label={`Ver carreras de ${teacher.name}`}
              >
                Carreras
              </Button>
            </RowActions>
          )
        },
      },
      { label: 'Estado', render: (teacher) => <StatusBadge active={teacher.is_active} /> },
      {
        label: 'Acciones', render: (teacher) => {
          if (!teacher.can_manage) return <span className="text-xs text-muted-foreground">Consulta · cambios a cargo de administración</span>
          if (!teacher.is_active) return <span className="text-muted-foreground">—</span>
          const coordinatedCareers = catalogs.careers.filter((c) => teacher.career_ids.includes(c.id))
          if (coordinatedCareers.length === 0) return <span className="text-muted-foreground">—</span>
          return <RowActions>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button type="button" variant="tertiary" size="icon" aria-label={`Más acciones para ${teacher.name}`} disabled={operation.pending}><MoreVerticalIcon /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {coordinatedCareers.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    aria-label={`Quitar ${c.name} de ${teacher.name}`}
                    onSelect={() => {
                      operation.clearError()
                      setUnlinking({ teacher, careerId: c.id, careerName: c.name })
                    }}
                  >
                    <XIcon />Quitar de {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </RowActions>
        },
      },
    ]} />
    <CatalogPagination label="docentes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    <FormDialog open={linkOpen} title="Vincular docente existente" description="Busca un docente ya registrado y agrégalo a una de tus carreras. Un docente puede pertenecer a varias carreras." pending={operation.pending} error={operation.error} errorModal={operation.errorModal} onCloseErrorModal={operation.clearErrorModal} dirty={Boolean(linkSelected)} requireChanges={false} blockReason={!linkCareerId ? 'Selecciona la carrera.' : !linkSelected ? 'Selecciona el docente que vas a vincular.' : null} onClose={() => setLinkOpen(false)} onSubmit={submitLink} submitIcon={LinkIcon} submitLabel="Vincular docente">
      <SelectField
        id="link-teacher-career"
        label="Carrera"
        value={linkCareerId}
        onValueChange={(value) => { setLinkCareerId(value); setLinkSelected(null) }}
        placeholder="Selecciona una carrera"
        options={catalogs.careers.filter((career) => career.status).map((career) => ({ value: String(career.id), label: career.name }))}
      />
      <FormField id="link-teacher-search" label="Docente" tip="Solo aparecen docentes activos que todavía no pertenecen a la carrera elegida. Si no existe, regístralo como docente nuevo.">
        <SearchSelect
          id="link-teacher-search"
          query={linkSearch}
          onQueryChange={setLinkSearch}
          options={linkCandidates.map((teacher) => ({ value: String(teacher.id), label: teacher.name, description: teacher.email }))}
          selected={linkSelected ? { value: String(linkSelected.id), label: linkSelected.name, description: linkSelected.email } : null}
          onSelect={(option) => setLinkSelected(option ? linkCandidates.find((teacher) => String(teacher.id) === option.value) ?? null : null)}
          loading={linkLoading}
          disabled={!linkCareerId}
          placeholder={linkCareerId ? 'Busca por nombre o correo…' : 'Primero selecciona una carrera'}
          emptyMessage="No hay docentes disponibles con esa búsqueda."
        />
      </FormField>
    </FormDialog>
    <FormDialog
      open={open}
      title={editing ? 'Editar docente' : 'Registrar docente'}
      description={editing ? undefined : 'Se enviará una contraseña provisional al correo institucional.'}
      pending={operation.pending}
      error={operation.error}
      errorModal={operation.errorModal}
      onCloseErrorModal={operation.clearErrorModal}
      dirty={JSON.stringify(form) !== JSON.stringify(initialForm)}
      blockReason={Object.values(teacherErrors)[0] ?? null}
      headerActions={editing ? <IconAction label="Desactivar docente" icon={PowerOffIcon} tone="destructive" disabled={operation.pending} onClick={() => { operation.clearError(); setDeactivating(editing) }} /> : undefined}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      submitIcon={editing ? SaveIcon : UserPlusIcon}
      submitLabel={editing ? 'Guardar cambios' : 'Registrar docente'}
    >
      <FormField
        id="teacher-identification"
        label="Cédula o pasaporte"
        tip={editing ? 'La cédula o pasaporte ya registrado no se puede modificar.' : undefined}
        counter={{ current: form.identification.length, max: identificationMaxLength(form.identification) }}
        error={editing ? null : (form.identification && shouldShowIdentificationStatus(form.identification) ? teacherErrors.identification : null)}
      >
        <div className="relative flex items-center">
          <Input id="teacher-identification" value={form.identification} onChange={(event) => setForm({ ...form, identification: sanitizeIdentification(event.target.value) })} required disabled={Boolean(editing)} maxLength={10} autoComplete="off" placeholder="0102030405 o AB1234567" className={cn(shouldShowIdentificationStatus(form.identification) && 'pr-9')} />
          {shouldShowIdentificationStatus(form.identification) && (
            isValidIdentification(form.identification)
              ? <CheckCircle2Icon className="absolute right-3 size-4 text-emerald-500" aria-label="Identificación válida" />
              : <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Identificación inválida" />
          )}
        </div>
      </FormField>
      <FormField id="teacher-name" label="Nombre completo" counter={{ current: form.name.length, max: 150 }}>
        <Input id="teacher-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })} required maxLength={150} autoComplete="name" placeholder="Nombre y apellido del docente" />
      </FormField>
      <FormField id="teacher-email" label="Correo institucional" tip="Utiliza una dirección de la Universidad Estatal de Bolívar (@ueb.edu.ec)." counter={{ current: form.email.length, max: 150 }} error={form.email ? teacherErrors.email : null}>
        <Input id="teacher-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value.slice(0, 150) })} required maxLength={150} placeholder="docente@ueb.edu.ec" />
      </FormField>
      <FormField id="teacher-phone" label="Teléfono" counter={{ current: form.phone.length, max: 10 }} error={form.phone ? teacherErrors.phone : null}>
        <Input id="teacher-phone" type="tel" inputMode="numeric" value={form.phone} onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })} required maxLength={10} placeholder="0991234567" />
      </FormField>
    </FormDialog>
    <ConfirmModal open={Boolean(unlinking)} title="¿Quitar docente de la carrera?" description={`«${unlinking?.teacher.name ?? ''}» dejará de estar vinculado a «${unlinking?.careerName ?? ''}». Su cuenta y sus otras carreras no cambian. Si tiene tutorías activas en esa carrera, primero debes reasignarlas.`} confirmLabel="Quitar de la carrera" pending={operation.pending} onClose={() => { if (!operation.pending) setUnlinking(null) }} onConfirm={() => { if (unlinking) void operation.run(() => tutoringApi.unlinkTeacherFromCareer(unlinking.teacher.id, unlinking.careerId), 'Docente quitado de la carrera.', async () => { setUnlinking(null); await list.reload() }) }} />
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar docente?" description={`La cuenta de «${deactivating?.name ?? ''}» perderá el acceso y no podrá recibir nuevas asignaciones de tutorías.`} confirmLabel="Desactivar docente" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => { if (deactivating) void operation.run(() => tutoringApi.deactivateTeacher(deactivating.id), 'Docente desactivado.', async () => { setDeactivating(null); setOpen(false); await list.reload() }) }} />
    <ErrorModal open={Boolean(operation.errorModal && !open && !linkOpen)} onClose={operation.clearErrorModal} title={operation.errorModal?.title} description={operation.errorModal?.description} />
    <Dialog
      open={Boolean(viewingCareersTeacher)}
      title="Carreras asignadas"
      description={viewingCareersTeacher ? viewingCareersTeacher.name : ''}
      confirmClose={false}
      onClose={() => setViewingCareersTeacher(null)}
      maxWidth="max-w-md"
    >
      {viewingCareersTeacher && (() => {
        const teacherCareers = viewingCareersTeacher.career_ids.map((id) => {
          const career = catalogs.careers.find((item) => item.id === id)
          return { id, name: career?.name ?? `Carrera #${id}` }
        })

        return (
          <div className="flex flex-col gap-4">
            {teacherCareers.length > 0 ? (
              <div className="flex flex-col gap-2" role="list" aria-label="Lista de carreras">
                {teacherCareers.map((c) => (
                  <Card
                    key={c.id}
                    role="listitem"
                    className="flex items-center gap-2.5 p-3 shadow-xs transition-colors hover:border-primary/40"
                  >
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-sm shrink-0">
                      <GraduationCapIcon className="size-4" />
                    </div>
                    <span className="text-sm font-medium text-foreground leading-snug break-words">{c.name}</span>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/30 border border-dashed text-center">
                <p className="text-sm text-muted-foreground">Este docente no tiene carreras asignadas.</p>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setViewingCareersTeacher(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )
      })()}
    </Dialog>
  </section>
}
