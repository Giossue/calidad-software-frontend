import { useEffect, useState, type FormEvent } from 'react'
import {
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  UserXIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, api, type User } from '@/lib/api'

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

function isUserActive(user: User): boolean {
  return user.is_active
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

  if (!editing && !form.password) errors.password = 'La contraseña es obligatoria.'
  if (form.password && form.password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.'
  if (form.password !== form.password_confirmation) {
    errors.password_confirmation = 'Las contraseñas no coinciden.'
  } else if (editing && !form.password && form.password_confirmation) {
    errors.password_confirmation = 'Escribe primero la nueva contraseña.'
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
  const [pendingUserId, setPendingUserId] = useState<number | null>(null)

  async function loadUsers() {
    setPageError(null)
    setPending('loading')
    setPendingUserId(null)
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

  function startUserEdit(user: User) {
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
  }

  function resetUserForm() {
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
      } else {
        await api.createUser({
          ...baseInput,
          password: userForm.password,
          password_confirmation: userForm.password_confirmation,
        })
      }

      resetUserForm()
      await loadUsers()
    } catch (error: unknown) {
      setFormError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingUserId(null)
    }
  }

  async function deactivateUser(user: User) {
    if (!window.confirm(`¿Desactivar al usuario “${user.name}”?`)) return

    setPageError(null)
    setPending('deactivate-user')
    setPendingUserId(user.id)
    try {
      await api.deactivateUser(user.id)
      await loadUsers()
    } catch (error: unknown) {
      setPageError(getErrorMessage(error))
    } finally {
      setPending(null)
      setPendingUserId(null)
    }
  }

  const formDisabled = pending !== null

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-red uppercase">Administración del sistema</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Usuarios</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Crea y mantiene las cuentas que participan en el sistema de calidad.</p>
        </div>
        <Button variant="outline" onClick={() => void loadUsers()} disabled={formDisabled}>
          {pending === 'loading' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          Actualizar
        </Button>
      </div>

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudieron cargar los usuarios</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.35fr)]">
        <form onSubmit={submitUser} noValidate className="flex flex-col gap-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="user-form-title">
          <div className="flex flex-col gap-1">
            <h3 id="user-form-title" className="text-lg font-semibold">{editingUser ? 'Editar usuario' : 'Registrar usuario'}</h3>
            <p className="text-sm text-muted-foreground">{editingUser ? 'Actualiza los datos de la cuenta seleccionada.' : 'Asigna una cuenta con el rol que corresponda.'}</p>
          </div>

          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field data-invalid={Boolean(userErrors.identification)}>
                <FieldLabel htmlFor="user-identification">Cédula</FieldLabel>
                <Input id="user-identification" name="identification" value={userForm.identification} onChange={(event) => updateUserField('identification', event.target.value)} maxLength={20} autoComplete="off" aria-invalid={Boolean(userErrors.identification)} aria-describedby={userErrors.identification ? 'user-identification-error' : undefined} disabled={formDisabled} required />
                <FieldError id="user-identification-error">{userErrors.identification}</FieldError>
              </Field>
              <Field data-invalid={Boolean(userErrors.name)}>
                <FieldLabel htmlFor="user-name">Nombre completo</FieldLabel>
                <Input id="user-name" name="name" value={userForm.name} onChange={(event) => updateUserField('name', event.target.value)} maxLength={150} autoComplete="name" aria-invalid={Boolean(userErrors.name)} aria-describedby={userErrors.name ? 'user-name-error' : undefined} disabled={formDisabled} required />
                <FieldError id="user-name-error">{userErrors.name}</FieldError>
              </Field>
            </div>

            <Field data-invalid={Boolean(userErrors.email)}>
              <FieldLabel htmlFor="user-email">Correo electrónico</FieldLabel>
              <Input id="user-email" name="email" type="email" value={userForm.email} onChange={(event) => updateUserField('email', event.target.value)} maxLength={150} autoComplete="email" placeholder="nombre@universidad.edu.ec" aria-invalid={Boolean(userErrors.email)} aria-describedby={userErrors.email ? 'user-email-error' : undefined} disabled={formDisabled} required />
              <FieldError id="user-email-error">{userErrors.email}</FieldError>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field data-invalid={Boolean(userErrors.phone)}>
                <FieldLabel htmlFor="user-phone">Teléfono <span className="font-normal text-muted-foreground">(opcional)</span></FieldLabel>
                <Input id="user-phone" name="phone" type="tel" value={userForm.phone} onChange={(event) => updateUserField('phone', event.target.value)} maxLength={20} autoComplete="tel" aria-invalid={Boolean(userErrors.phone)} aria-describedby={userErrors.phone ? 'user-phone-error' : undefined} disabled={formDisabled} />
                <FieldError id="user-phone-error">{userErrors.phone}</FieldError>
              </Field>
              <Field data-invalid={Boolean(userErrors.role)}>
                <FieldLabel htmlFor="user-role">Rol</FieldLabel>
                <select id="user-role" name="role" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50" value={userForm.role} onChange={(event) => updateUserField('role', event.target.value)} aria-invalid={Boolean(userErrors.role)} aria-describedby={userErrors.role ? 'user-role-error' : undefined} disabled={formDisabled} required>
                  <option value="">Selecciona un rol</option>
                  {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <FieldError id="user-role-error">{userErrors.role}</FieldError>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field data-invalid={Boolean(userErrors.password)}>
                <FieldLabel htmlFor="user-password">Contraseña</FieldLabel>
                <Input id="user-password" name="password" type="password" value={userForm.password} onChange={(event) => updateUserField('password', event.target.value)} autoComplete="new-password" aria-invalid={Boolean(userErrors.password)} aria-describedby="user-password-help user-password-error" disabled={formDisabled} required={!editingUser} />
                <FieldDescription id="user-password-help">{editingUser ? 'Déjala vacía para conservar la contraseña actual.' : 'Mínimo 8 caracteres.'}</FieldDescription>
                <FieldError id="user-password-error">{userErrors.password}</FieldError>
              </Field>
              <Field data-invalid={Boolean(userErrors.password_confirmation)}>
                <FieldLabel htmlFor="user-password-confirmation">Confirmar contraseña</FieldLabel>
                <Input id="user-password-confirmation" name="password_confirmation" type="password" value={userForm.password_confirmation} onChange={(event) => updateUserField('password_confirmation', event.target.value)} autoComplete="new-password" aria-invalid={Boolean(userErrors.password_confirmation)} aria-describedby="user-password-confirmation-error" disabled={formDisabled} required={!editingUser || Boolean(userForm.password)} />
                <FieldError id="user-password-confirmation-error">{userErrors.password_confirmation}</FieldError>
              </Field>
            </div>

            <FieldError id="user-form-error">{formError}</FieldError>
            <UserFormActions editing={Boolean(editingUser)} pending={pending === 'user'} onCancel={resetUserForm} />
          </FieldGroup>
        </form>

        <div className="rounded-2xl border border-border/70 bg-card shadow-sm" aria-labelledby="users-list-title">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-3">
              <UsersIcon className="size-5 text-brand-red" aria-hidden="true" />
              <h3 id="users-list-title" className="font-semibold">Usuarios registrados</h3>
            </div>
            <span className="text-xs text-muted-foreground">{users.length} {users.length === 1 ? 'cuenta' : 'cuentas'}</span>
          </div>
          <div className="flex flex-col" role="list" aria-busy={pending === 'loading'}>
            {pending === 'loading' ? <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground" role="status"><Spinner />Cargando usuarios…</div> : users.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">Todavía no hay usuarios registrados.</p> : users.map((user) => <UserRow key={user.id} user={user} disabled={formDisabled} deactivating={pending === 'deactivate-user' && pendingUserId === user.id} onEdit={() => startUserEdit(user)} onDeactivate={() => void deactivateUser(user)} />)}
          </div>
        </div>
      </div>
    </section>
  )
}

function UserFormActions({ editing, pending, onCancel }: Readonly<{ editing: boolean; pending: boolean; onCancel: () => void }>) {
  return <div className="flex flex-wrap justify-end gap-3"><Button type="submit" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : editing ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}{pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar usuario'}</Button>{editing && <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}><XIcon data-icon="inline-start" />Cancelar</Button>}</div>
}

function UserRow({ user, disabled, deactivating, onEdit, onDeactivate }: Readonly<{ user: User; disabled: boolean; deactivating: boolean; onEdit: () => void; onDeactivate: () => void }>) {
  const active = isUserActive(user)

  return <div role="listitem" className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{active ? 'Activo' : 'Inactivo'}</span>
      </div>
      <p className="truncate text-xs text-muted-foreground">{user.email} · {getRoleLabel(user.role)}</p>
      <p className="truncate text-xs text-muted-foreground">Cédula {user.identification}{user.phone ? ` · ${user.phone}` : ' · Sin teléfono'}</p>
    </div>
    {active && <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar usuario ${user.name}`} onClick={onEdit} disabled={disabled}><PencilIcon /></Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Desactivar usuario ${user.name}`} onClick={onDeactivate} disabled={disabled}>
        {deactivating ? <Spinner /> : <UserXIcon />}
      </Button>
    </div>}
  </div>
}
