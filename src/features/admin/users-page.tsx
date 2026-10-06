import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AwardIcon,
  BriefcaseIcon,
  CheckCircle2Icon,
  Edit2Icon,
  GraduationCapIcon,
  MailIcon,
  MoreVerticalIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
  UserXIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ErrorModal, getFriendlyError } from '@/components/ui/error-modal'
import { Field, FieldCounter, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useIsMobile } from '@/hooks/use-mobile'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type Career, type Faculty, type User, type UserPaginationMeta } from '@/lib/api'
import { isValidEcuadorianCedula } from '@/lib/cedula'
import { getInitials } from '@/lib/format'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { FilterBar } from '@/features/tutoring/filter-bar'

type UserForm = {
  identification: string
  name: string
  email: string
  phone: string
  role: string
  facultyId: string
  careerId: string
  password: string
  password_confirmation: string
}

type UserFormErrors = Partial<Record<keyof UserForm, string>>
type PendingAction = 'user' | 'toggle-user' | null
type ToggleTarget = { user: User; action: 'activate' | 'deactivate' }

type UserFormInput = {
  identification: string
  name: string
  email: string
  phone: string | null
  role: string
  faculty_id?: number | null
  career_id?: number | null
  password?: string
  password_confirmation?: string
}

const ROLE_OPTIONS = [
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'docente', label: 'Docente' },
  { value: 'coordinador_carrera', label: 'Coordinador de carrera' },
  { value: 'coordinador_titulacion', label: 'Coordinador de titulación' },
  { value: 'administrador', label: 'Administrador' },
] as const

const INITIAL_USER_FORM: UserForm = {
  identification: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  facultyId: '',
  careerId: '',
  password: '',
  password_confirmation: '',
}


function isRole(value: string): boolean {
  return ROLE_OPTIONS.some((option) => option.value === value)
}

function getPasswordRequirementHint(password: string): string | null {
  if (password.length < 8) return 'Debe tener al menos 8 caracteres.'
  if (!/[a-z]/.test(password)) return 'Debe incluir al menos una minúscula.'
  if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una mayúscula.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Debe incluir al menos un carácter especial.'
  return null
}

function getRoleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case 'administrador':
      return 'bg-destructive/10 text-destructive border-destructive/25'
    case 'docente':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
    case 'estudiante':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    case 'coordinador_carrera':
    case 'coordinador_titulacion':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
  }
}

function validateUserForm(form: UserForm, editing: boolean): UserFormErrors {
  const errors: UserFormErrors = {}
  const identification = form.identification.trim()
  const name = form.name.trim()
  const email = form.email.trim()
  const phone = form.phone.trim()

  if (!identification) errors.identification = 'La cédula es obligatoria.'
  else if (!/^\d{10}$/.test(identification)) errors.identification = 'La cédula debe tener 10 dígitos numéricos.'
  else if (!isValidEcuadorianCedula(identification)) errors.identification = 'La cédula ingresada no es válida.'

  if (!name) errors.name = 'El nombre es obligatorio.'
  else if (name.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'
  else if (!/^[\p{L}\s]+$/u.test(name)) errors.name = 'El nombre solo puede contener letras y espacios.'

  if (!email) errors.email = 'El correo electrónico es obligatorio.'
  else if (email.length > 150) errors.email = 'El correo electrónico no puede superar 150 caracteres.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Escribe un correo electrónico válido.'

  if (!phone) {
    if (!editing) {
      errors.phone = 'El teléfono es obligatorio.'
    }
  } else if (!/^\d{10}$/.test(phone)) {
    errors.phone = 'El teléfono debe tener 10 dígitos numéricos.'
  }

  if (!isRole(form.role)) errors.role = 'Selecciona un rol válido.'

  if (form.role && form.role !== 'administrador' && form.role !== 'docente') {
    if (!form.facultyId) errors.facultyId = 'Selecciona la facultad.'
    if (!form.careerId) errors.careerId = 'Selecciona la carrera.'
  }

  if (editing && form.password) {
    const passwordHint = getPasswordRequirementHint(form.password)
    if (passwordHint) errors.password = passwordHint
    if (form.password !== form.password_confirmation) {
      errors.password_confirmation = 'Las contraseñas no coinciden.'
    }
  }

  return errors
}

export function UsersPage() {
  const isMobile = useIsMobile()
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const [careerFilter, setCareerFilter] = useState('')
  const [filterCareers, setFilterCareers] = useState<readonly Career[]>([])
  useEffect(() => {
    void api.listActiveCareers().then(setFilterCareers).catch(() => setFilterCareers([]))
  }, [])
  const fetchUsers = useCallback(
    (page: number, search: string) => api.listUsers({ page, search, role: roleFilter || undefined, status: statusFilter || undefined, careerId: Number(careerFilter) || undefined }),
    [roleFilter, statusFilter, careerFilter],
  )
  const {
    data: users,
    meta,
    page,
    setPage,
    searchInput,
    setSearchInput,
    isInitialLoading,
    isFetching,
    error: pageError,
    reload,
  } = usePaginatedCatalog<User, UserPaginationMeta>(fetchUsers, `${roleFilter}|${statusFilter}|${careerFilter}`)

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState<UserForm>(INITIAL_USER_FORM)
  const [initialUserForm, setInitialUserForm] = useState<UserForm>(INITIAL_USER_FORM)
  const [userErrors, setUserErrors] = useState<UserFormErrors>({})
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; description: string } | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)

  // Catálogos institucionales
  const [faculties, setFaculties] = useState<readonly Faculty[]>([])
  const [careers, setCareers] = useState<readonly Career[]>([])
  const [catalogsLoading, setCatalogsLoading] = useState(false)

  const loadCatalogs = useCallback(async () => {
    try {
      setCatalogsLoading(true)
      const [facultiesData, careersData] = await Promise.all([
        api.listActiveFaculties(),
        api.listActiveCareers(),
      ])
      setFaculties(facultiesData)
      setCareers(careersData)
    } catch {
      // Omitir o mantener catálogos existentes si la API falla temporalmente
    } finally {
      setCatalogsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  const filteredCareers = useMemo(() => {
    if (!userForm.facultyId) return []
    return careers.filter((c) => String(c.faculty_id) === userForm.facultyId)
  }, [careers, userForm.facultyId])

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userToToggle, setUserToToggle] = useState<ToggleTarget | null>(null)

  async function handleRefresh() {
    const [ok] = await Promise.all([reload(), loadCatalogs()])
    if (ok) toast.success('Usuarios actualizados', { description: 'El listado se actualizó correctamente.' })
  }

  function updateUserField(field: keyof UserForm, value: string) {
    setUserForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'role' && (value === 'administrador' || value === 'docente')) {
        next.facultyId = ''
        next.careerId = ''
      }
      if (field === 'facultyId') {
        next.careerId = ''
      }
      return next
    })
    setUserErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      if (field === 'role' && (value === 'administrador' || value === 'docente')) {
        delete next.facultyId
        delete next.careerId
      }
      if (field === 'facultyId') {
        delete next.careerId
      }
      return next
    })
  }

  function openCreateModal() {
    setEditingUser(null)
    setUserForm(INITIAL_USER_FORM)
    setInitialUserForm(INITIAL_USER_FORM)
    setUserErrors({})
    setIsModalOpen(true)
    void loadCatalogs()
  }

  function openEditModal(user: User) {
    setEditingUser(user)
    const userCareerId = user.career_id ?? user.coordinated_career_ids?.[0]
    const matchedCareer = careers.find((c) => c.id === userCareerId)
    const initialFacultyId = user.faculty_id
      ? String(user.faculty_id)
      : (matchedCareer ? String(matchedCareer.faculty_id) : '')
    const initialCareerId = userCareerId ? String(userCareerId) : ''

    const initial: UserForm = {
      identification: user.identification,
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      facultyId: (user.role !== 'administrador' && user.role !== 'docente') ? initialFacultyId : '',
      careerId: (user.role !== 'administrador' && user.role !== 'docente') ? initialCareerId : '',
      password: '',
      password_confirmation: '',
    }
    setUserForm(initial)
    setInitialUserForm(initial)
    setUserErrors({})
    setIsModalOpen(true)
    void loadCatalogs()
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingUser(null)
    setUserForm(INITIAL_USER_FORM)
    setUserErrors({})
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const errors = validateUserForm(userForm, editingUser !== null)
    setUserErrors(errors)
    if (Object.keys(errors).length > 0) {
      setErrorModal({
        open: true,
        title: 'Revisa los campos requeridos',
        description: 'Hay datos incompletos o con formato incorrecto en el formulario. Por favor, revísalos antes de continuar.',
      })
      return
    }

    setPending('user')
    try {
      // Si se está editando y el usuario deja el teléfono vacío, se mantiene el anterior (o queda vacío si no tenía)
      const resolvedPhone = editingUser
        ? (userForm.phone.trim() || editingUser.phone || null)
        : userForm.phone.trim()

      const baseInput: UserFormInput = {
        identification: userForm.identification.trim(),
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: resolvedPhone,
        role: userForm.role,
        faculty_id: userForm.role !== 'administrador' && userForm.role !== 'docente' && userForm.facultyId ? Number(userForm.facultyId) : null,
        career_id: userForm.role !== 'administrador' && userForm.role !== 'docente' && userForm.careerId ? Number(userForm.careerId) : null,
      }

      if (editingUser) {
        const input = {
          ...baseInput,
          ...(userForm.password
            ? {
                password: userForm.password,
                password_confirmation: userForm.password_confirmation,
              }
            : {}),
        }
        await api.updateUser(editingUser.id, input)
        toast.success('Usuario actualizado', { description: `Los datos de ${baseInput.name} fueron modificados.` })
      } else {
        await api.createUser({
          ...baseInput,
          phone: userForm.phone.trim(),
        })
        toast.success('Usuario registrado', {
          description: `Se creó la cuenta de ${baseInput.name} y se le envió su contraseña provisional por correo.`,
        })
      }

      closeModal()
      await reload()
    } catch (error: unknown) {
      const friendly = getFriendlyError(error)
      setErrorModal({
        open: true,
        title: friendly.title,
        description: friendly.description,
      })
      if (friendly.field && friendly.field in userForm) {
        setUserErrors((prev) => ({ ...prev, [friendly.field!]: friendly.description }))
      }
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmToggle() {
    if (!userToToggle) return

    const { user, action } = userToToggle
    setPending('toggle-user')
    try {
      if (action === 'activate') {
        await api.activateUser(user.id)
        toast.success('Usuario habilitado', { description: `Se habilitó la cuenta de ${user.name}.` })
      } else {
        await api.deactivateUser(user.id)
        toast.info('Usuario deshabilitado', { description: `Se desactivó la cuenta de ${user.name}.` })
      }
      setUserToToggle(null)
      await reload()
    } catch (error: unknown) {
      setUserToToggle(null)
      const friendly = getFriendlyError(error)
      setErrorModal({
        open: true,
        title: friendly.title,
        description: friendly.description,
      })
    } finally {
      setPending(null)
    }
  }

  const formDisabled = pending !== null
  const isUserFormDirty = (Object.keys(userForm) as (keyof UserForm)[]).some(
    (key) => userForm[key] !== initialUserForm[key],
  )

  // Métricas KPI (independientes de la página actual, la búsqueda y el filtro de rol)
  const totalUsers = (meta?.active_count ?? 0) + (meta?.inactive_count ?? 0)
  const totalAdmins = meta?.admin_count ?? 0
  const totalCoordinadoresCarrera = meta?.career_coordinator_count ?? 0
  const totalCoordinadoresTitulacion = meta?.degree_coordinator_count ?? 0
  const totalDocentes = meta?.teacher_count ?? 0
  const totalEstudiantes = meta?.student_count ?? 0

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader
        title="Gestión de Usuarios"
        description="Administra los permisos, roles y cuentas del personal administrativo y académico."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              Actualizar
            </Button>
            <Button onClick={openCreateModal} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
              <PlusIcon data-icon="inline-start" />
              Nuevo usuario
            </Button>
          </div>
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <ShieldAlertIcon />
          <AlertTitle>No se pudieron cargar los usuarios</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Tarjetas KPI de Estadísticas Resumidas */}
      <div className="@container">
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @7xl:grid-cols-6 sm:gap-4">
        <Card className="flex flex-col items-start gap-2 p-4 border-slate-200/80 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <UsersIcon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Cuentas
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalUsers}
            </span>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-4 border-slate-200/80 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldCheckIcon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-xs font-semibold uppercase tracking-wider text-slate-500">
              Administradores
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalAdmins}
            </span>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-4 border-slate-200/80 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <BriefcaseIcon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-xs font-semibold uppercase tracking-wider text-slate-500">
              Coord. Carrera
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalCoordinadoresCarrera}
            </span>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-4 border-slate-200/80 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <AwardIcon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-xs font-semibold uppercase tracking-wider text-slate-500">
              Coord. Titulación
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalCoordinadoresTitulacion}
            </span>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-4 border-slate-200/80 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <UserCheckIcon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-xs font-semibold uppercase tracking-wider text-slate-500">
              Docentes
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalDocentes}
            </span>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-4 border-slate-200/80 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <GraduationCapIcon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estudiantes
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalEstudiantes}
            </span>
          </div>
        </Card>
      </div>
      </div>

      {/* Contenedor Principal: Filtros + Tabla */}
      <div className="flex flex-col gap-4">
        <FilterBar
          id="users"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar usuario"
          searchPlaceholder="Buscar usuario por nombre, correo o cédula…"
          filters={[
            { id: 'role', label: 'Rol', value: roleFilter, onChange: setRoleFilter, allLabel: 'Todos los roles', options: ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label })) },
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'inactive'), allLabel: 'Todos', options: [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }] },
            { id: 'career', label: 'Carrera', value: careerFilter, onChange: setCareerFilter, allLabel: 'Todas las carreras', options: filterCareers.map((career) => ({ value: String(career.id), label: career.name })) },
          ]}
          onClear={() => { setSearchInput(''); setRoleFilter(''); setStatusFilter(''); setCareerFilter('') }}
        />

        {/* Lista de Usuarios (móvil): una tarjeta por usuario */}
        {isMobile ? (
        <ul className={cn('flex flex-col gap-3 transition-opacity', isFetching && !isInitialLoading && 'opacity-60')} aria-busy={isFetching}>
          {isInitialLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            ))
          ) : users.length === 0 ? (
            <li className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <UsersIcon className="size-8 text-slate-300 dark:text-slate-600" />
              <span className="font-medium">
                {searchInput || (roleFilter !== '' || statusFilter !== '' || careerFilter !== '')
                  ? 'No se encontraron usuarios coincidentes.'
                  : 'Todavía no hay usuarios registrados.'}
              </span>
            </li>
          ) : (
            users.map((user) => {
              const active = user.is_active

              return (
                <li key={user.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center text-sm font-bold text-brand-blue dark:text-white" aria-hidden="true">
                      {getInitials(user.name)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] dark:text-white">{user.name}</span>
                      <span className="text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{user.email}</span>
                    </div>
                    <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', getRoleBadgeStyle(user.role))}>
                      {getRoleLabel(user.role)}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="flex flex-col">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Cédula</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{user.identification}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Teléfono</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{user.phone || 'Sin teléfono'}</dd>
                    </div>
                    {user.career_name && (
                      <div className="col-span-2 flex flex-col">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Carrera</dt>
                        <dd className="font-medium text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">
                          {user.career_name}{user.faculty_name ? ` · ${user.faculty_name}` : ''}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                        active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                      )}
                    >
                      <span className={cn('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
                      {active ? 'Activo' : 'Inactivo'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        aria-label={`Editar a ${user.name}`}
                      >
                        <Edit2Icon className="size-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            aria-label={`Más opciones de ${user.name}`}
                          >
                            <MoreVerticalIcon className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {active ? (
                            <DropdownMenuItem variant="destructive" onSelect={() => setUserToToggle({ user, action: 'deactivate' })}>
                              <UserXIcon />
                              Desactivar usuario
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => setUserToToggle({ user, action: 'activate' })}>
                              <UserCheckIcon />
                              Habilitar usuario
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
        ) : (
        <div
          className={cn(
            'overflow-hidden rounded-xl border bg-card transition-opacity',
            isFetching && !isInitialLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Cédula / Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="flex flex-col gap-1.5">
                          <div className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-800" />
                          <div className="h-3 w-44 rounded-md bg-slate-100 dark:bg-slate-800/60" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="h-4 w-28 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></TableCell>
                    <TableCell><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400 whitespace-normal">
                    <div className="flex flex-col items-center gap-2">
                      <UsersIcon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchInput || (roleFilter !== '' || statusFilter !== '' || careerFilter !== '')
                          ? 'No se encontraron usuarios coincidentes.'
                          : 'Todavía no hay usuarios registrados.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const active = user.is_active
                  const badgeStyle = getRoleBadgeStyle(user.role)
                  const initials = getInitials(user.name)

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="whitespace-normal">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white shadow-2xs">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {user.name}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                              badgeStyle,
                            )}
                          >
                            {getRoleLabel(user.role)}
                          </span>
                          {user.career_name && (
                            <span
                              className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-[200px] truncate"
                              title={`${user.career_name}${user.faculty_name ? ` · ${user.faculty_name}` : ''}`}
                            >
                              {user.career_name}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Cédula: {user.identification}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {user.phone ? `Tel: ${user.phone}` : 'Sin teléfono'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
                            )}
                          />
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">

                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar usuario"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          {active ? (
                            <button
                              type="button"
                              onClick={() => setUserToToggle({ user, action: 'deactivate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              title="Desactivar usuario"
                            >
                              <UserXIcon className="size-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUserToToggle({ user, action: 'activate' })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
                              title="Habilitar usuario"
                            >
                              <UserCheckIcon className="size-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {users.length} de {meta?.total ?? users.length} {(meta?.total ?? users.length) === 1 ? 'usuario' : 'usuarios'}
          </p>
          <CatalogPagination label="usuarios" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      {/* Modal Dialog para Crear / Editar Usuario */}
      <Dialog
        open={isModalOpen}
        onClose={closeModal}
        title={editingUser ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
        description={
          editingUser
            ? 'Modifica los datos y asignaciones de la cuenta seleccionada.'
            : 'Ingresa los datos personales del usuario. La contraseña provisional será enviada por correo electrónico.'
        }
        maxWidth="max-w-2xl"
        confirmClose={isUserFormDirty}
      >
        <form onSubmit={submitUser}>
          <FieldGroup className="gap-5">
            {/* Aviso Informativo para Creación de Usuario */}
            {!editingUser && (
              <div className="flex items-start gap-3.5 rounded-xl border border-blue-200/80 bg-blue-50/80 p-4 text-xs font-medium text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                <MailIcon className="size-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-sm">Envío de Contraseña Provisional</span>
                  <span>
                    No necesitas ingresar una contraseña. Al hacer clic en <strong>Registrar Usuario</strong>, el sistema generará automáticamente una contraseña provisional segura y se la enviará al correo registrado.
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(userErrors.identification)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="user-identification">Cédula</FieldLabel>
                  <FieldCounter current={userForm.identification.length} max={10} />
                </div>
                <div className="relative flex items-center">
                  <Input
                    id="user-identification"
                    name="identification"
                    inputMode="numeric"
                    value={userForm.identification}
                    onChange={(e) => updateUserField('identification', sanitizeDigits(e.target.value, 10))}
                    maxLength={10}
                    autoComplete="off"
                    placeholder="Ej. 1710034065"
                    disabled={formDisabled}
                    required
                    className={cn(userForm.identification.length === 10 && 'pr-9')}
                  />
                  {userForm.identification.length === 10 && (
                    isValidEcuadorianCedula(userForm.identification) ? (
                      <CheckCircle2Icon className="absolute right-3 size-4 text-emerald-500" aria-label="Cédula válida" />
                    ) : (
                      <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Cédula inválida" />
                    )
                  )}
                </div>
                <FieldError>{userErrors.identification}</FieldError>
              </Field>

              <Field data-invalid={Boolean(userErrors.name)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="user-name">Nombre completo</FieldLabel>
                  <FieldCounter current={userForm.name.length} max={150} />
                </div>
                <Input
                  id="user-name"
                  name="name"
                  value={userForm.name}
                  onChange={(e) => updateUserField('name', sanitizeLetters(e.target.value, 150))}
                  maxLength={150}
                  autoComplete="name"
                  placeholder="Ej. Ana Torres"
                  disabled={formDisabled}
                  required
                />
                <FieldError>{userErrors.name}</FieldError>
              </Field>
            </div>

            <Field data-invalid={Boolean(userErrors.email)}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="user-email">Correo electrónico institucional</FieldLabel>
                <FieldCounter current={userForm.email.length} max={150} />
              </div>
              <Input
                id="user-email"
                name="email"
                type="email"
                value={userForm.email}
                onChange={(e) => updateUserField('email', e.target.value.slice(0, 150))}
                maxLength={150}
                placeholder="nombre@ueb.edu.ec"
                disabled={formDisabled}
                required
              />
              <FieldError>{userErrors.email}</FieldError>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(userErrors.phone)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="user-phone">
                    Teléfono {editingUser ? <span className="font-normal text-muted-foreground text-xs">(Opcional)</span> : null}
                  </FieldLabel>
                  <FieldCounter current={userForm.phone.length} max={10} />
                </div>
                <Input
                  id="user-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  value={userForm.phone}
                  onChange={(e) => updateUserField('phone', sanitizeDigits(e.target.value, 10))}
                  maxLength={10}
                  placeholder={editingUser?.phone ? `Anterior: ${editingUser.phone}` : 'Ej. 0989938432'}
                  disabled={formDisabled}
                  required={!editingUser}
                />
                {editingUser && (
                  <FieldDescription className="text-xs">
                    Si no colocas un número, se mantendrá el teléfono anterior o quedará vacío si no tenía uno registrado.
                  </FieldDescription>
                )}
                <FieldError>{userErrors.phone}</FieldError>
              </Field>

              <Field data-invalid={Boolean(userErrors.role)}>
                <FieldLabel htmlFor="user-role">Rol en el sistema</FieldLabel>
                <NativeSelect
                  id="user-role"
                  name="role"
                  value={userForm.role}
                  onChange={(e) => updateUserField('role', e.target.value)}
                  disabled={formDisabled}
                  required
                >
                  <option value="">Selecciona un rol</option>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError>{userErrors.role}</FieldError>
              </Field>
            </div>

            {/* Selector de Facultad y Carrera para roles académicos específicos (Estudiante, Coordinadores) */}
            {userForm.role && userForm.role !== 'administrador' && userForm.role !== 'docente' && (
              <div className="grid gap-5 sm:grid-cols-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <Field data-invalid={Boolean(userErrors.facultyId)}>
                  <FieldLabel htmlFor="user-faculty">Facultad</FieldLabel>
                  <NativeSelect
                    id="user-faculty"
                    name="facultyId"
                    value={userForm.facultyId}
                    onChange={(e) => updateUserField('facultyId', e.target.value)}
                    disabled={formDisabled || catalogsLoading}
                    required
                  >
                    <option value="">
                      {catalogsLoading ? 'Cargando facultades…' : 'Selecciona una facultad'}
                    </option>
                    {faculties.map((faculty) => (
                      <option key={faculty.id} value={String(faculty.id)}>
                        {faculty.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError>{userErrors.facultyId}</FieldError>
                </Field>

                <Field data-invalid={Boolean(userErrors.careerId)}>
                  <FieldLabel htmlFor="user-career">Carrera</FieldLabel>
                  <NativeSelect
                    id="user-career"
                    name="careerId"
                    value={userForm.careerId}
                    onChange={(e) => updateUserField('careerId', e.target.value)}
                    disabled={formDisabled || catalogsLoading || !userForm.facultyId}
                    required
                  >
                    <option value="">
                      {!userForm.facultyId
                        ? 'Primero selecciona una facultad'
                        : filteredCareers.length === 0
                          ? 'No hay carreras en esta facultad'
                          : 'Selecciona una carrera'}
                    </option>
                    {filteredCareers.map((career) => (
                      <option key={career.id} value={String(career.id)}>
                        {career.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError>{userErrors.careerId}</FieldError>
                </Field>
              </div>
            )}

            {/* Campos de contraseña SOLO al Editar (Opcional) */}
            {editingUser && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={Boolean(userErrors.password)}>
                  <FieldLabel htmlFor="user-password">Nueva Contraseña (Opcional)</FieldLabel>
                  <Input
                    id="user-password"
                    name="password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => updateUserField('password', e.target.value)}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    disabled={formDisabled}
                  />
                  {userForm.password && getPasswordRequirementHint(userForm.password) && (
                    <FieldDescription className="text-xs">
                      {getPasswordRequirementHint(userForm.password)}
                    </FieldDescription>
                  )}
                  <FieldError>{userErrors.password}</FieldError>
                </Field>

                <Field data-invalid={Boolean(userErrors.password_confirmation)}>
                  <FieldLabel htmlFor="user-password-confirmation">Confirmar nueva contraseña</FieldLabel>
                  <Input
                    id="user-password-confirmation"
                    name="password_confirmation"
                    type="password"
                    value={userForm.password_confirmation}
                    onChange={(e) => updateUserField('password_confirmation', e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repite la contraseña"
                    disabled={formDisabled}
                    required={Boolean(userForm.password)}
                  />
                  {userForm.password_confirmation && (
                    <FieldDescription
                      className={cn(
                        'text-xs',
                        userForm.password === userForm.password_confirmation
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive',
                      )}
                    >
                      {userForm.password === userForm.password_confirmation
                        ? 'Las contraseñas coinciden.'
                        : 'Las contraseñas no coinciden.'}
                    </FieldDescription>
                  )}
                  <FieldError>{userErrors.password_confirmation}</FieldError>
                </Field>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeModal} disabled={formDisabled}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formDisabled} className="bg-brand-red hover:bg-brand-red/90 text-white font-semibold">
                {pending === 'user' && <Spinner data-icon="inline-start" />}
                {editingUser ? 'Guardar Cambios' : 'Registrar Usuario'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>


      {/* ConfirmModal para Habilitar / Desactivar Usuario */}
      <ConfirmModal
        open={Boolean(userToToggle)}
        onClose={() => setUserToToggle(null)}
        onConfirm={() => void handleConfirmToggle()}
        title={userToToggle?.action === 'activate' ? '¿Habilitar cuenta de usuario?' : '¿Desactivar cuenta de usuario?'}
        description={
          userToToggle?.action === 'activate'
            ? `¿Deseas habilitar la cuenta de "${userToToggle?.user.name}"? Podrá volver a acceder al sistema.`
            : `¿Estás seguro de desactivar a "${userToToggle?.user.name}"? Esta persona no podrá acceder al sistema hasta que su cuenta sea reactivada.`
        }
        confirmLabel={userToToggle?.action === 'activate' ? 'Habilitar cuenta' : 'Desactivar cuenta'}
        cancelLabel="Cancelar"
        variant={userToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-user'}
      />

      {/* ErrorModal para Notificar Errores de Validación o Datos Duplicados */}
      <ErrorModal
        open={Boolean(errorModal?.open)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title}
        description={errorModal?.description}
      />
    </section>
  )
}
