import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2Icon, LinkIcon, SaveIcon, UserPlusIcon, XCircleIcon } from 'lucide-react'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { SelectField } from '@/components/ui/select-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { formatSubjectName, sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { tutoringApi, type AvailableTeacher, type Teacher } from '@/lib/tutoring-api'
import { cn } from '@/lib/utils'
import { FilterBar } from './filter-bar'
import { ErrorNotice } from '@/components/ui/error-notice'
import { useDetailParam } from '@/hooks/use-detail-param'
import { TeacherDetail } from './teacher-detail'
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
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkCareerId, setLinkCareerId] = useState('')
  const [linkSearch, setLinkSearch] = useState('')
  const [linkSelected, setLinkSelected] = useState<AvailableTeacher | null>(null)
  const [linkCandidates, setLinkCandidates] = useState<readonly AvailableTeacher[]>([])
  const [linkLoading, setLinkLoading] = useState(false)
  // El docente abierto vive en la URL (?docente=<id>) para que "Atrás" vuelva a la lista.
  const detail = useDetailParam('docente')
  const [openedTeacher, setOpenedTeacher] = useState<Teacher | null>(null)
  const detailTeacher = detail.id === null
    ? null
    : (openedTeacher?.id === detail.id ? openedTeacher : null) ?? list.data.find((teacher) => teacher.id === detail.id) ?? null

  function openTeacher(teacher: Teacher) {
    setOpenedTeacher(teacher)
    detail.open(teacher.id)
  }

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
    let updated: Teacher | null = null
    void operation.run(
      async () => {
        if (editing) updated = await tutoringApi.updateTeacher(editing.id, input)
        else await tutoringApi.createTeacher({ ...input, career_id: careerId })
      },
      editing ? 'Docente actualizado.' : 'Docente registrado.',
      async () => { setOpen(false); if (updated) setOpenedTeacher(updated); await list.reload() },
    )
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

  // Una fila por asignatura; los datos del docente abarcan todas sus filas.
  const teacherRows = list.data.flatMap((teacher) => {
    const tutorings = teacher.tutorings ?? []
    return (tutorings.length > 0 ? tutorings : [null]).map((tutoring, index, all) => ({
      id: `${teacher.id}-${tutoring?.id ?? 'none'}`,
      teacher,
      tutoring,
      span: index === 0 ? all.length : 0,
    }))
  })

  const teacherNotFound = detail.id !== null && !detailTeacher && !list.isFetching && !list.isInitialLoading

  return <section className="flex flex-col gap-6">
    {detailTeacher ? (
      <TeacherDetail
        teacher={detailTeacher}
        careers={catalogs.careers}
        pending={operation.pending}
        onBack={detail.close}
        onEdit={() => edit(detailTeacher)}
        onDeactivate={() => { operation.clearError(); setDeactivating(detailTeacher) }}
        onUnlink={(career) => { operation.clearError(); setUnlinking({ teacher: detailTeacher, careerId: career.id, careerName: career.name }) }}
      />
    ) : detail.id !== null ? (
      teacherNotFound ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">No encontramos este docente en la lista.</p>
          <Button type="button" variant="secondary" onClick={detail.close}>Volver a docentes</Button>
        </div>
      ) : <p role="status" className="text-sm text-muted-foreground">Cargando docente…</p>
    ) : <>
    <ModuleHeader title="Docentes" description="Registra a los docentes de tus carreras o vincula a uno que ya tiene cuenta. Haz clic en uno para abrirlo." createLabel="Registrar docente nuevo" onCreate={() => edit(null)} extraActions={<><BulkImportButton type="teachers" title="Carga masiva de docentes" description="Cada docente recibirá su contraseña provisional por correo y completará sus datos al ingresar." onFinished={list.reload} /><Button type="button" variant="secondary" onClick={openLink} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)}><LinkIcon data-icon="inline-start" />Vincular docente existente</Button></>} disabled={operation.pending || catalogs.loading || !catalogs.careers.some((career) => career.status)} />
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
        { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
      ]}
    />
    <ErrorNotice message={list.error} retry={list.reload} />
    <RecordTable rows={teacherRows} loading={list.isFetching || list.isInitialLoading} empty={list.searchInput || careerFilter || statusFilter ? 'No hay docentes con estos filtros.' : 'Aún no hay docentes registrados.'} onRowClick={({ teacher }) => openTeacher(teacher)} rowTitle={({ teacher }) => `Abrir a ${teacher.name}`} columns={[
      { label: 'Docente', span: ({ span }) => span, render: ({ teacher }) => <div className="flex flex-col gap-1"><span>{teacher.name}</span><span className="text-xs text-muted-foreground">{teacher.identification}</span></div> },
      { label: 'Contacto', span: ({ span }) => span, render: ({ teacher }) => <div className="flex flex-col gap-1"><span>{teacher.email}</span><span className="text-xs text-muted-foreground">{teacher.phone || 'Sin teléfono'}</span></div> },
      { label: 'Asignatura', render: ({ tutoring }) => tutoring ? <span className="leading-snug">{formatSubjectName(tutoring.subject_name)}</span> : <span className="text-sm text-muted-foreground">Sin tutorías</span> },
      { label: 'Ciclo', render: ({ tutoring }) => <span className="whitespace-nowrap text-muted-foreground">{tutoring?.cycle_number ?? '—'}</span> },
      { label: 'Paralelo', render: ({ tutoring }) => <span className="text-muted-foreground">{tutoring?.section_name ? tutoring.section_name.replace(/^Paralelo\s+/i, '') : '—'}</span> },
      { label: 'Estado', span: ({ span }) => span, render: ({ teacher }) => <StatusBadge active={teacher.is_active} /> },
    ]} />
    <CatalogPagination label="docentes" page={list.page} lastPage={list.meta?.last_page ?? 1} disabled={list.isFetching} onChange={list.setPage} />
    </>}
    <FormDialog open={linkOpen} title="Vincular docente existente" description="Busca un docente ya registrado y agrégalo a una de tus carreras. Un docente puede pertenecer a varias carreras." pending={operation.pending} error={operation.error} errorModal={operation.errorModal} onCloseErrorModal={operation.clearErrorModal} dirty={Boolean(linkSelected)} requireChanges={false} blockReason={!linkCareerId ? 'Selecciona la carrera.' : !linkSelected ? 'Selecciona el docente que vas a vincular.' : null} onClose={() => setLinkOpen(false)} onSubmit={submitLink} submitIcon={LinkIcon} submitLabel="Vincular docente">
      <SelectField
        id="link-teacher-career"
        label="Carrera"
        required
        value={linkCareerId}
        onValueChange={(value) => { setLinkCareerId(value); setLinkSelected(null) }}
        placeholder="Selecciona una carrera"
        options={catalogs.careers.filter((career) => career.status).map((career) => ({ value: String(career.id), label: career.name }))}
      />
      <FormField id="link-teacher-search" label="Docente" required tip="Solo aparecen docentes activos que todavía no pertenecen a la carrera elegida. Si no existe, regístralo como docente nuevo.">
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
      onClose={() => setOpen(false)}
      onSubmit={submit}
      submitIcon={editing ? SaveIcon : UserPlusIcon}
      submitLabel={editing ? 'Guardar cambios' : 'Registrar docente'}
    >
      <FormField id="teacher-name" label="Nombre completo" required counter={{ current: form.name.length, max: 150 }}>
        <Input id="teacher-name" value={form.name} onChange={(event) => setForm({ ...form, name: sanitizeLetters(event.target.value, 150) })} required maxLength={150} autoComplete="name" placeholder="Nombre y apellido del docente" />
      </FormField>
      <FormField
        id="teacher-identification"
        label="Cédula o pasaporte"
        required={!editing}
        tip={editing ? 'La cédula o pasaporte ya registrado no se puede modificar.' : undefined}
        counter={{ current: form.identification.length, max: identificationMaxLength(form.identification) }}
        error={editing ? null : (form.identification && shouldShowIdentificationStatus(form.identification) ? teacherErrors.identification : null)}
      >
        <div className="relative flex items-center">
          <Input id="teacher-identification" value={form.identification} onChange={(event) => setForm({ ...form, identification: sanitizeIdentification(event.target.value) })} required disabled={Boolean(editing)} maxLength={10} autoComplete="off" placeholder="0102030405 o AB1234567" className={cn(shouldShowIdentificationStatus(form.identification) && 'pr-9')} />
          {shouldShowIdentificationStatus(form.identification) && (
            isValidIdentification(form.identification)
              ? <CheckCircle2Icon className="absolute right-3 size-4 text-success" aria-label="Identificación válida" />
              : <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Identificación inválida" />
          )}
        </div>
      </FormField>
      <FormField id="teacher-email" label="Correo institucional" required tip="Utiliza una dirección de la Universidad Estatal de Bolívar (@ueb.edu.ec o @mailes.ueb.edu.ec)." counter={{ current: form.email.length, max: 150 }} error={form.email ? teacherErrors.email : null}>
        <Input id="teacher-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value.slice(0, 150) })} required maxLength={150} placeholder="docente@ueb.edu.ec" />
      </FormField>
      <FormField id="teacher-phone" label="Teléfono" required counter={{ current: form.phone.length, max: 10 }} error={form.phone ? teacherErrors.phone : null}>
        <Input id="teacher-phone" type="tel" inputMode="numeric" value={form.phone} onChange={(event) => setForm({ ...form, phone: sanitizeDigits(event.target.value, 10) })} required maxLength={10} placeholder="0991234567" />
      </FormField>
    </FormDialog>
    <ConfirmModal open={Boolean(unlinking)} title="¿Quitar docente de la carrera?" description={`«${unlinking?.teacher.name ?? ''}» dejará de estar vinculado a «${unlinking?.careerName ?? ''}». Su cuenta y sus otras carreras no cambian. Si tiene tutorías activas en esa carrera, primero debes reasignarlas.`} confirmLabel="Quitar de la carrera" pending={operation.pending} onClose={() => { if (!operation.pending) setUnlinking(null) }} onConfirm={() => {
      if (!unlinking) return
      let updated: Teacher | null = null
      void operation.run(async () => { updated = await tutoringApi.unlinkTeacherFromCareer(unlinking.teacher.id, unlinking.careerId) }, 'Docente quitado de la carrera.', async () => { setUnlinking(null); if (updated) setOpenedTeacher(updated); await list.reload() })
    }} />
    <ConfirmModal open={Boolean(deactivating)} title="¿Desactivar docente?" description={`La cuenta de «${deactivating?.name ?? ''}» perderá el acceso y no podrá recibir nuevas asignaciones de tutorías.`} confirmLabel="Desactivar docente" pending={operation.pending} onClose={() => { if (!operation.pending) setDeactivating(null) }} onConfirm={() => {
      if (!deactivating) return
      let updated: Teacher | null = null
      void operation.run(async () => { updated = await tutoringApi.deactivateTeacher(deactivating.id) }, 'Docente desactivado.', async () => { setDeactivating(null); setOpen(false); if (updated) setOpenedTeacher(updated); await list.reload() })
    }} />
  </section>
}
