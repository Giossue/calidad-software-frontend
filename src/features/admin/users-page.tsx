import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2Icon, PlusIcon, UserCheckIcon, UserXIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { BulkImportButton } from '@/components/bulk-import-dialog'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogPagination } from '@/components/admin/catalog-pagination'
import { Button } from '@/components/ui/button'
import { RefreshButton } from '@/components/ui/refresh-button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Badge } from '@/components/ui/badge'
import { getFriendlyError, type FriendlyErrorInfo } from '@/components/ui/error-modal'
import { ErrorNotice } from '@/components/ui/error-notice'
import { FieldDescription } from '@/components/ui/field'
import { FormDialog, type FormStep } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { IconAction } from '@/components/ui/icon-action'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordStrength } from '@/components/ui/password-strength'
import { getPasswordRequirementHint, PASSWORD_MIN_LENGTH } from '@/lib/password-rules'
import { SelectField } from '@/components/ui/select-field'
import { usePaginatedCatalog } from '@/hooks/use-paginated-catalog'
import { api, type Career, type Faculty, type User, type UserPaginationMeta } from '@/lib/api'
import { identificationMaxLength, isValidIdentification, sanitizeIdentification, shouldShowIdentificationStatus } from '@/lib/cedula'
import { sanitizeDigits, sanitizeLetters } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { FilterBar } from '@/features/tutoring/filter-bar'
import { RecordTable } from '@/features/tutoring/tutoring-shared'

type UserForm = {
  identification: string
  name: string
  email: string
  phone: string
  role: string
  facultyId: string
  careerId: string
  cycleNumber: string
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
  cycle_number?: number | null
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

// Campos de cada paso del formulario, en el orden en que se muestran.
const PERSONAL_FIELDS: readonly (keyof UserForm)[] = ['name', 'identification', 'phone', 'email']
const ROLE_FIELDS: readonly (keyof UserForm)[] = ['role', 'facultyId', 'careerId', 'cycleNumber']

const INITIAL_USER_FORM: UserForm = {
  identification: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  facultyId: '',
  careerId: '',
  cycleNumber: '',
  password: '',
  password_confirmation: '',
}


function isRole(value: string): boolean {
  return ROLE_OPTIONS.some((option) => option.value === value)
}

function getRoleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

/**
 * Estado visible de la cuenta. "Pendiente" es una cuenta habilitada que aún no ingresa
 * a completar sus datos: recibió el correo con la contraseña provisional o le falta la cédula.
 */
function UserStatusBadge({ user }: Readonly<{ user: User }>) {
  if (!user.is_active) {
    return <Badge variant="inactive" title="La cuenta está deshabilitada.">Inactivo</Badge>
  }
  if (user.must_complete_profile) {
    const sent = user.must_change_password
    return (
      <Badge
        variant="warning"
        title={sent
          ? 'Se envió el correo de acceso; el usuario aún no ingresa a completar sus datos.'
          : 'El usuario debe registrar su cédula y completar sus datos al ingresar.'}
      >
        {sent ? 'Correo enviado' : 'Datos pendientes'}
      </Badge>
    )
  }
  return <Badge variant="success" title="La cuenta está habilitada y con sus datos completos.">Activo</Badge>
}

function validateUserForm(form: UserForm, editing: boolean, identificationLocked = false): UserFormErrors {
  const errors: UserFormErrors = {}
  const identification = form.identification.trim()
  const name = form.name.trim()
  const email = form.email.trim()
  const phone = form.phone.trim()

  if (identificationLocked) {
    // La identificación ya registrada no se modifica ni se vuelve a validar.
  } else if (!identification) {
    if (!editing) errors.identification = 'La cédula o pasaporte es obligatorio.'
  } else if (/^\d{10}$/.test(identification) && !isValidIdentification(identification)) errors.identification = 'La cédula ingresada no es válida.'
  else if (!isValidIdentification(identification)) errors.identification = 'Ingresa una cédula de 10 dígitos o un pasaporte de 6 a 9 letras o números.'

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

  if (form.role === 'estudiante' && !form.cycleNumber) errors.cycleNumber = 'Selecciona el ciclo que cursa el estudiante.'

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
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'pending' | 'inactive'>('')
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
  // Una vez registrada, la cédula o pasaporte no puede cambiarse.
  const identificationLocked = Boolean(editingUser?.identification)
  const [userForm, setUserForm] = useState<UserForm>(INITIAL_USER_FORM)
  const [initialUserForm, setInitialUserForm] = useState<UserForm>(INITIAL_USER_FORM)
  const [userErrors, setUserErrors] = useState<UserFormErrors>({})
  // Error del servidor (o de validación al enviar): se muestra una vez, en línea, dentro del modal.
  const [formError, setFormError] = useState<FriendlyErrorInfo | null>(null)
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
  const cycleLevels = careers.find((c) => String(c.id) === userForm.careerId)?.cycle_levels ?? 0

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userToToggle, setUserToToggle] = useState<ToggleTarget | null>(null)

  // Actualizar no cambia nada: sin toast de éxito.
  async function handleRefresh() {
    await Promise.all([reload(), loadCatalogs()])
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
      // El ciclo depende del rol y de la carrera elegida.
      if ((field === 'role' && value !== 'estudiante') || field === 'facultyId' || field === 'careerId') {
        next.cycleNumber = ''
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
    setFormError(null)
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
      identification: user.identification ?? '',
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      facultyId: (user.role !== 'administrador' && user.role !== 'docente') ? initialFacultyId : '',
      careerId: (user.role !== 'administrador' && user.role !== 'docente') ? initialCareerId : '',
      cycleNumber: user.role === 'estudiante' && user.cycle_number ? String(user.cycle_number) : '',
      password: '',
      password_confirmation: '',
    }
    setUserForm(initial)
    setInitialUserForm(initial)
    setUserErrors({})
    setFormError(null)
    setIsModalOpen(true)
    void loadCatalogs()
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingUser(null)
    setUserForm(INITIAL_USER_FORM)
    setUserErrors({})
    setFormError(null)
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending !== null) return

    const errors = validateUserForm(userForm, editingUser !== null, identificationLocked)
    setUserErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError({
        title: 'Revisa los campos requeridos',
        description: 'Hay datos incompletos o con formato incorrecto en el formulario. Por favor, revísalos antes de continuar.',
      })
      return
    }

    setPending('user')
    setFormError(null)
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
        ...(userForm.role === 'estudiante' && userForm.cycleNumber ? { cycle_number: Number(userForm.cycleNumber) } : {}),
      }

      if (editingUser) {
        const input = {
          ...baseInput,
          // La cédula ya registrada no se envía; una cuenta importada sin cédula puede registrarla una vez.
          identification: identificationLocked ? undefined : (baseInput.identification || undefined),
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
      setFormError(friendly)
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
      closeModal()
      await reload()
    } catch (error: unknown) {
      setUserToToggle(null)
      const friendly = getFriendlyError(error)
      setFormError(friendly)
    } finally {
      setPending(null)
    }
  }

  const formDisabled = pending !== null
  const isUserFormDirty = (Object.keys(userForm) as (keyof UserForm)[]).some(
    (key) => userForm[key] !== initialUserForm[key],
  )

  // "Guardar" se bloquea con el primer error de validación; sin cambios lo bloquea FormDialog.
  const formErrors = validateUserForm(userForm, editingUser !== null, identificationLocked)
  const submitBlockReason = Object.values(formErrors)[0] ?? null

  const roleOptions = ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))
  const facultyOptions = faculties.map((faculty) => ({ value: String(faculty.id), label: faculty.name }))
  const careerOptions = filteredCareers.map((career) => ({ value: String(career.id), label: career.name }))
  const cycleOptions = Array.from({ length: cycleLevels }, (_, index) => index + 1).map((number) => ({
    value: String(number),
    label: number === cycleLevels ? `Ciclo ${number} · Titulación` : `Ciclo ${number} · Tutorías`,
  }))

  const identificationField = (
    <FormField
      id="user-identification"
      label="Cédula o pasaporte"
      required={!editingUser}
      tip={identificationLocked ? 'La cédula o pasaporte ya registrado no se puede modificar.' : undefined}
      counter={{ current: userForm.identification.length, max: identificationMaxLength(userForm.identification) }}
      error={userErrors.identification}
    >
      <div className="relative flex items-center">
        <Input
          id="user-identification"
          name="identification"
          value={userForm.identification}
          onChange={(e) => updateUserField('identification', sanitizeIdentification(e.target.value))}
          maxLength={10}
          autoComplete="off"
          placeholder="Ej. 1710034065 o AB1234567"
          disabled={formDisabled || identificationLocked}
          required
          className={cn(shouldShowIdentificationStatus(userForm.identification) && 'pr-9')}
        />
        {shouldShowIdentificationStatus(userForm.identification) && (
          isValidIdentification(userForm.identification) ? (
            <CheckCircle2Icon className="absolute right-3 size-4 text-success" aria-label="Identificación válida" />
          ) : (
            <XCircleIcon className="absolute right-3 size-4 text-destructive" aria-label="Identificación inválida" />
          )
        )}
      </div>
    </FormField>
  )

  // Paso 1: quién es la persona. Lo que la identifica va primero.
  const personalFields = (
    <>
      <FormField id="user-name" label="Nombre completo" required counter={{ current: userForm.name.length, max: 150 }} error={userErrors.name}>
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
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        {identificationField}

        <FormField
          id="user-phone"
          label="Teléfono"
          required={!editingUser}
          optional={Boolean(editingUser)}
         
          counter={{ current: userForm.phone.length, max: 10 }}
          error={userErrors.phone}
        >
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
        </FormField>
      </div>

      <FormField id="user-email" label="Correo electrónico institucional" required counter={{ current: userForm.email.length, max: 150 }} error={userErrors.email}>
        <Input
          id="user-email"
          name="email"
          type="email"
          value={userForm.email}
          onChange={(e) => updateUserField('email', e.target.value.slice(0, 150))}
          maxLength={150}
          placeholder="Ej. maria.perez@ueb.edu.ec"
          disabled={formDisabled}
          required
        />
      </FormField>
    </>
  )

  // Paso 2: qué hace en el sistema. Facultad y carrera solo para roles académicos (estudiante, coordinadores).
  const roleFields = (
    <>
      <SelectField
        id="user-role"
        name="role"
        label="Rol en el sistema"
        required
        value={userForm.role}
        onValueChange={(value) => updateUserField('role', value)}
        options={roleOptions}
        placeholder="Selecciona un rol"
        disabled={formDisabled}
        error={userErrors.role}
      />

      {userForm.role && userForm.role !== 'administrador' && userForm.role !== 'docente' && (
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            id="user-faculty"
            name="facultyId"
            label="Facultad"
            required
            value={userForm.facultyId}
            onValueChange={(value) => updateUserField('facultyId', value)}
            options={facultyOptions}
            placeholder={catalogsLoading ? 'Cargando facultades…' : 'Selecciona una facultad'}
            disabled={formDisabled || catalogsLoading}
            error={userErrors.facultyId}
          />

          <SelectField
            id="user-career"
            name="careerId"
            label="Carrera"
            required
            value={userForm.careerId}
            onValueChange={(value) => updateUserField('careerId', value)}
            options={careerOptions}
            placeholder={!userForm.facultyId ? 'Primero selecciona una facultad' : filteredCareers.length === 0 ? 'No hay carreras en esta facultad' : 'Selecciona una carrera'}
            disabled={formDisabled || catalogsLoading || !userForm.facultyId}
            error={userErrors.careerId}
          />

          {userForm.role === 'estudiante' && (
            <SelectField
              id="user-cycle"
              name="cycleNumber"
              label="Ciclo"
              required
              tip="El último ciclo de la carrera habilita el módulo de titulación; los anteriores, el de tutorías."
              value={userForm.cycleNumber}
              onValueChange={(value) => updateUserField('cycleNumber', value)}
              options={cycleOptions}
              placeholder={!userForm.careerId ? 'Primero selecciona una carrera' : cycleLevels === 0 ? 'La carrera no tiene ciclos registrados' : 'Selecciona el ciclo'}
              disabled={formDisabled || catalogsLoading || cycleLevels === 0}
              error={userErrors.cycleNumber}
            />
          )}
        </div>
      )}
    </>
  )

  // Paso 3 (solo al editar): nueva contraseña opcional.
  const passwordFields = (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField id="user-password" label="Nueva contraseña" optional error={userErrors.password}>
        <PasswordInput
          id="user-password"
          name="password"
          value={userForm.password}
          onChange={(e) => updateUserField('password', e.target.value)}
          autoComplete="new-password"
          placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
          disabled={formDisabled}
          aria-describedby={userForm.password ? 'user-password-strength' : undefined}
        />
        {userForm.password && <PasswordStrength id="user-password-strength" password={userForm.password} />}
      </FormField>

      <FormField id="user-password-confirmation" label="Confirmar nueva contraseña" required={Boolean(userForm.password)} error={userErrors.password_confirmation}>
        <PasswordInput
          id="user-password-confirmation"
          name="password_confirmation"
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
                ? 'text-success'
                : 'text-destructive',
            )}
          >
            {userForm.password === userForm.password_confirmation
              ? 'Las contraseñas coinciden.'
              : 'Las contraseñas no coinciden.'}
          </FieldDescription>
        )}
      </FormField>
    </div>
  )

  // "Siguiente" se bloquea con el primer error de los campos de cada paso (las mismas reglas de validación).
  const firstErrorOf = (fields: readonly (keyof UserForm)[]) => fields.map((field) => formErrors[field]).find(Boolean) ?? null
  const userFormSteps: FormStep[] = [
    { title: 'Datos personales', blockReason: firstErrorOf(PERSONAL_FIELDS), fields: ['name', 'identification', 'phone', 'email'], content: personalFields },
    { title: 'Rol y carrera', blockReason: firstErrorOf(ROLE_FIELDS), fields: ['role', 'faculty_id', 'career_id', 'cycle_number'], content: roleFields },
    ...(editingUser ? [{ title: 'Contraseña', description: 'Déjala en blanco para conservar la actual.', content: passwordFields }] : []),
  ]

  const hasFilters = searchInput.trim() !== '' || roleFilter !== '' || statusFilter !== '' || careerFilter !== ''

  return (
    <section className="flex flex-col gap-6">
      <AdminSectionHeader
        title="Usuarios"
        description="Registra las cuentas del sistema y asigna a cada persona su rol y carrera."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <RefreshButton onClick={() => void handleRefresh()} loading={isFetching} />
            <BulkImportButton
              type="users"
              title="Carga masiva de usuarios"
              description="Cada usuario recibirá su contraseña provisional por correo y completará sus datos al ingresar."
              onFinished={reload}
              className="flex-1 sm:flex-none"
            />
            <Button onClick={openCreateModal} className="w-full sm:w-auto" data-tour="page-create">
              <PlusIcon data-icon="inline-start" />
              Nuevo usuario
            </Button>
          </div>
        }
      />

      <ErrorNotice title="No se pudieron cargar los usuarios" message={pageError} retry={reload} />

      <div className="flex flex-col gap-4">
        <FilterBar
          id="users"
          search={searchInput}
          onSearch={setSearchInput}
          searchLabel="Buscar usuario"
          searchPlaceholder="Buscar usuario por nombre, correo o cédula…"
          filters={[
            { id: 'role', label: 'Rol', value: roleFilter, onChange: setRoleFilter, allLabel: 'Todos los roles', options: ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label })) },
            { id: 'status', label: 'Estado', value: statusFilter, onChange: (value) => setStatusFilter(value as '' | 'active' | 'pending' | 'inactive'), allLabel: 'Todos los estados', options: [{ value: 'active', label: 'Activos' }, { value: 'pending', label: 'Pendientes de completar datos' }, { value: 'inactive', label: 'Inactivos' }] },
            { id: 'career', label: 'Carrera', value: careerFilter, onChange: setCareerFilter, allLabel: 'Todas las carreras', options: filterCareers.map((career) => ({ value: String(career.id), label: career.name })) },
          ]}
          onClear={() => { setSearchInput(''); setRoleFilter(''); setStatusFilter(''); setCareerFilter('') }}
        />

        <RecordTable
          rows={users}
          loading={isInitialLoading}
          onRowClick={openEditModal}
          isRowSelected={(user) => editingUser?.id === user.id}
          empty={hasFilters ? 'No hay usuarios con estos filtros.' : 'Aún no hay usuarios registrados.'}
          columns={[
            {
              label: 'Usuario',
              render: (user) => (
                <div className="flex min-w-0 flex-col">
                  <span className="[overflow-wrap:anywhere]">{user.name}</span>
                  <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{user.email}</span>
                </div>
              ),
            },
            { label: 'Rol', render: (user) => getRoleLabel(user.role) },
            {
              label: 'Carrera',
              render: (user) => <span className="text-muted-foreground">{user.career_name ?? '—'}</span>,
            },
            { label: 'Cédula', render: (user) => user.identification ?? '—' },
            { label: 'Teléfono', render: (user) => <span className={cn(!user.phone && 'text-muted-foreground')}>{user.phone || 'Sin teléfono'}</span> },
            { label: 'Estado', render: (user) => <UserStatusBadge user={user} /> },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {users.length} de {meta?.total ?? users.length} {(meta?.total ?? users.length) === 1 ? 'usuario' : 'usuarios'}
          </p>
          <CatalogPagination label="usuarios" page={page} lastPage={meta?.last_page ?? 1} disabled={isFetching} onChange={setPage} />
        </div>
      </div>

      <FormDialog
        open={isModalOpen}
        onClose={closeModal}
        onSubmit={submitUser}
        title={editingUser ? 'Editar usuario' : 'Registrar usuario'}
        description={editingUser ? undefined : 'La persona recibirá su contraseña provisional por correo.'}
        maxWidth="max-w-2xl"
        pending={pending === 'user'}
        error={formError?.description ?? null}
        errorModal={formError}
        dirty={isUserFormDirty}
        blockReason={submitBlockReason}
        submitLabel={editingUser ? 'Guardar cambios' : 'Registrar usuario'}
        submitIcon={editingUser ? undefined : PlusIcon}
        headerActions={
          editingUser ? (
            <>
              <UserStatusBadge user={editingUser} />
              <IconAction
                label={editingUser.is_active ? 'Desactivar cuenta' : 'Habilitar cuenta'}
                icon={editingUser.is_active ? UserXIcon : UserCheckIcon}
                tone={editingUser.is_active ? 'destructive' : 'default'}
                disabled={formDisabled}
                onClick={() => setUserToToggle({ user: editingUser, action: editingUser.is_active ? 'deactivate' : 'activate' })}
              />
            </>
          ) : undefined
        }
        steps={userFormSteps}
      />

      <ConfirmModal
        open={Boolean(userToToggle)}
        onClose={() => setUserToToggle(null)}
        onConfirm={() => void handleConfirmToggle()}
        title={userToToggle?.action === 'activate' ? '¿Habilitar cuenta de usuario?' : '¿Desactivar cuenta de usuario?'}
        description={
          userToToggle?.action === 'activate'
            ? `${userToToggle?.user.name} podrá volver a acceder al sistema.`
            : `${userToToggle?.user.name} no podrá acceder al sistema hasta que su cuenta sea reactivada.`
        }
        confirmLabel={userToToggle?.action === 'activate' ? 'Habilitar cuenta' : 'Desactivar cuenta'}
        confirmIcon={userToToggle?.action === 'activate' ? UserCheckIcon : UserXIcon}
        cancelLabel="Cancelar"
        variant={userToToggle?.action === 'activate' ? 'default' : 'destructive'}
        pending={pending === 'toggle-user'}
      />

    </section>
  )
}
