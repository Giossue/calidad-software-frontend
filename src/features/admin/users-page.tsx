import { useEffect, useState, type FormEvent } from 'react'
import {
  Edit2Icon,
  GraduationCapIcon,
  MailIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
  UserXIcon,
} from 'lucide-react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Dialog, DialogCancelButton } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { showToast } from '@/components/ui/toast-system'
import { ApiError, api, type User } from '@/lib/api'
import { cn } from '@/lib/utils'

type UserForm = {
  identification: string
  name: string
  email: string
  phone: string
  role: string
  password: string
  password_confirmation: string
}

type UserFormErrors = Partial<Record<keyof UserForm, string>>
type PendingAction = 'loading' | 'user' | 'deactivate-user' | null

type UserFormInput = {
  identification: string
  name: string
  email: string
  phone: string
  role: string
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
  password: '',
  password_confirmation: '',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.firstValidationMessage ?? error.message
  return 'No fue posible conectar con el servidor.'
}

function isRole(value: string): boolean {
  return ROLE_OPTIONS.some((option) => option.value === value)
}

function getRoleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case 'administrador':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
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

function getInitials(name?: string): string {
  if (!name) return 'US'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function validateUserForm(form: UserForm, editing: boolean): UserFormErrors {
  const errors: UserFormErrors = {}
  const identification = form.identification.trim()
  const name = form.name.trim()
  const email = form.email.trim()
  const phone = form.phone.trim()

  if (!identification) errors.identification = 'La cédula es obligatoria.'
  else if (identification.length > 20) errors.identification = 'La cédula no puede superar 20 caracteres.'

  if (!name) errors.name = 'El nombre es obligatorio.'
  else if (name.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'

  if (!email) errors.email = 'El correo electrónico es obligatorio.'
  else if (email.length > 150) errors.email = 'El correo electrónico no puede superar 150 caracteres.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Escribe un correo electrónico válido.'

  if (phone.length > 20) errors.phone = 'El teléfono no puede superar 20 caracteres.'
  if (!isRole(form.role)) errors.role = 'Selecciona un rol válido.'

  if (editing && form.password) {
    if (form.password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.'
    if (form.password !== form.password_confirmation) {
      errors.password_confirmation = 'Las contraseñas no coinciden.'
    }
  }

  return errors
}

export function UsersPage() {
  const [users, setUsers] = useState<readonly User[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState<UserForm>(INITIAL_USER_FORM)
  const [userErrors, setUserErrors] = useState<UserFormErrors>({})
  const [pageError, setPageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null)

  // Filtros de búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  async function loadUsers() {
    setPageError(null)
    setPending('loading')
    try {
      const userData = await api.listUsers()
      setUsers(userData)
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function updateUserField(field: keyof UserForm, value: string) {
    setUserForm((current) => ({ ...current, [field]: value }))
    setUserErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setFormError(null)
  }

  function openCreateModal() {
    setEditingUser(null)
    setUserForm(INITIAL_USER_FORM)
    setUserErrors({})
    setFormError(null)
    setIsModalOpen(true)
  }

  function openEditModal(user: User) {
    setEditingUser(user)
    setUserForm({
      identification: user.identification,
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      password: '',
      password_confirmation: '',
    })
    setUserErrors({})
    setFormError(null)
    setIsModalOpen(true)
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

    const errors = validateUserForm(userForm, editingUser !== null)
    setUserErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError('Revisa los campos marcados antes de guardar.')
      return
    }

    setFormError(null)
    setPending('user')
    try {
      const baseInput: UserFormInput = {
        identification: userForm.identification.trim(),
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim(),
        role: userForm.role,
      }

      if (editingUser) {
        const input: UserFormInput = { ...baseInput }
        if (userForm.password) {
          input.password = userForm.password
          input.password_confirmation = userForm.password_confirmation
        }
        await api.updateUser(editingUser.id, input)
        showToast('success', 'Usuario actualizado', `Los datos de ${baseInput.name} fueron modificados.`)
      } else {
        await api.createUser(baseInput)
        showToast(
          'success',
          'Usuario registrado',
          `Se creó la cuenta de ${baseInput.name} y se le envió su contraseña provisional por correo.`,
        )
      }

      closeModal()
      await loadUsers()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  async function handleConfirmDeactivate() {
    if (!userToDeactivate) return

    setPageError(null)
    setPending('deactivate-user')
    try {
      await api.deactivateUser(userToDeactivate.id)
      showToast('info', 'Usuario deshabilitado', `Se desactivó la cuenta de ${userToDeactivate.name}.`)
      setUserToDeactivate(null)
      await loadUsers()
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  const formDisabled = pending !== null

  // Métricas calculadas para las tarjetas KPI
  const totalUsers = users.length
  const totalAdmins = users.filter((u) => u.role === 'administrador').length
  const totalDocentes = users.filter((u) => u.role === 'docente').length
  const totalEstudiantes = users.filter((u) => u.role === 'estudiante').length

  // Usuarios filtrados
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !query ||
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.identification.includes(query)
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <section className="flex flex-col gap-8">
      <AdminSectionHeader
        title="Gestión de Usuarios"
        description="Administra los permisos, roles y cuentas del personal administrativo y académico."
        eyebrow="Administración del Sistema"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => void loadUsers()}
              disabled={formDisabled}
            >
              {pending === 'loading' ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              Actualizar
            </Button>
            <Button onClick={openCreateModal} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <UsersIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Cuentas
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalUsers}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <ShieldCheckIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Administradores
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalAdmins}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <UserCheckIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Docentes
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalDocentes}
            </span>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <GraduationCapIcon className="size-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estudiantes
            </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalEstudiantes}
            </span>
          </div>
        </Card>
      </div>

      {/* Contenedor Principal: Filtros + Tabla Moderna */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        {/* Barra de Búsqueda y Filtro */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex flex-1 items-center max-w-md">
            <SearchIcon className="absolute left-3.5 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuario por nombre, correo o cédula…"
              className="pl-10"
            />
          </div>
          <div className="w-full sm:w-56">
            <NativeSelect
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">Todos los roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {/* Tabla de Usuarios Moderna */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Usuario</th>
                <th className="px-5 py-3.5">Rol</th>
                <th className="px-5 py-3.5">Cédula / Teléfono</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pending === 'loading' ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="flex flex-col gap-1.5">
                          <div className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-800" />
                          <div className="h-3 w-44 rounded-md bg-slate-100 dark:bg-slate-800/60" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-4 w-28 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" /></td>
                    <td className="px-5 py-4 text-right"><div className="ml-auto h-8 w-16 rounded-md bg-slate-200 dark:bg-slate-800" /></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <UsersIcon className="size-8 text-slate-300 dark:text-slate-600" />
                      <span className="font-medium">
                        {searchQuery || roleFilter !== 'all'
                          ? 'No se encontraron usuarios coincidentes.'
                          : 'Todavía no hay usuarios registrados.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const active = user.is_active
                  const badgeStyle = getRoleBadgeStyle(user.role)
                  const initials = getInitials(user.name)

                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0F1E2E] text-xs font-bold text-white shadow-2xs">
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
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                            badgeStyle,
                          )}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Cédula: {user.identification}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {user.phone ? `Tel: ${user.phone}` : 'Sin teléfono'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
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
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Editar usuario"
                          >
                            <Edit2Icon className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserToDeactivate(user)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            title="Desactivar usuario"
                          >
                            <UserXIcon className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
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
                <FieldLabel htmlFor="user-identification">Cédula</FieldLabel>
                <Input
                  id="user-identification"
                  name="identification"
                  value={userForm.identification}
                  onChange={(e) => updateUserField('identification', e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  disabled={formDisabled}
                  required
                />
                <FieldError>{userErrors.identification}</FieldError>
              </Field>

              <Field data-invalid={Boolean(userErrors.name)}>
                <FieldLabel htmlFor="user-name">Nombre completo</FieldLabel>
                <Input
                  id="user-name"
                  name="name"
                  value={userForm.name}
                  onChange={(e) => updateUserField('name', e.target.value)}
                  maxLength={150}
                  autoComplete="name"
                  disabled={formDisabled}
                  required
                />
                <FieldError>{userErrors.name}</FieldError>
              </Field>
            </div>

            <Field data-invalid={Boolean(userErrors.email)}>
              <FieldLabel htmlFor="user-email">Correo electrónico institucional</FieldLabel>
              <Input
                id="user-email"
                name="email"
                type="email"
                value={userForm.email}
                onChange={(e) => updateUserField('email', e.target.value)}
                maxLength={150}
                placeholder="nombre@universidad.edu.ec"
                disabled={formDisabled}
                required
              />
              <FieldError>{userErrors.email}</FieldError>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(userErrors.phone)}>
                <FieldLabel htmlFor="user-phone">
                  Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
                </FieldLabel>
                <Input
                  id="user-phone"
                  name="phone"
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => updateUserField('phone', e.target.value)}
                  maxLength={20}
                  disabled={formDisabled}
                />
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
                    disabled={formDisabled}
                  />
                  <FieldDescription>
                    Déjala vacía si no deseas modificar la contraseña del usuario.
                  </FieldDescription>
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
                    disabled={formDisabled}
                    required={Boolean(userForm.password)}
                  />
                  <FieldError>{userErrors.password_confirmation}</FieldError>
                </Field>
              </div>
            )}

            <FieldError>{formError}</FieldError>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <DialogCancelButton onClick={closeModal} disabled={formDisabled}>
                Cancelar
              </DialogCancelButton>
              <Button type="submit" disabled={formDisabled} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {pending === 'user' && <Spinner data-icon="inline-start" />}
                {editingUser ? 'Guardar Cambios' : 'Registrar Usuario'}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Dialog>

      {/* ConfirmModal para Desactivar Usuario */}
      <ConfirmModal
        open={Boolean(userToDeactivate)}
        onClose={() => setUserToDeactivate(null)}
        onConfirm={() => void handleConfirmDeactivate()}
        title="¿Desactivar cuenta de usuario?"
        description={`¿Estás seguro de desactivar a "${userToDeactivate?.name}"? Esta persona no podrá acceder al sistema hasta que su cuenta sea reactivada.`}
        confirmLabel="Desactivar cuenta"
        cancelLabel="Cancelar"
        variant="destructive"
        pending={pending === 'deactivate-user'}
      />
    </section>
  )
}
