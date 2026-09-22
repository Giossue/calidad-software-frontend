import { useEffect, useState, type FormEvent } from 'react'
import { RefreshCwIcon, ShieldAlertIcon, UsersIcon } from 'lucide-react'

import { AdminCrudLayout } from '@/components/admin/admin-crud-layout'
import { AdminFormCard } from '@/components/admin/admin-form-card'
import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { CatalogFormActions } from '@/components/admin/catalog-form-actions'
import { CatalogList } from '@/components/admin/catalog-list'
import { CatalogRow } from '@/components/admin/catalog-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
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
      <AdminSectionHeader title="Usuarios" description="Crea y mantiene las cuentas que participan en el sistema de calidad." eyebrow="Administración del sistema" actions={<Button variant="outline" onClick={() => void loadUsers()} disabled={formDisabled}>
        {pending === 'loading' ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
        Actualizar
      </Button>} />

      {pageError && <Alert variant="destructive"><ShieldAlertIcon /><AlertTitle>No se pudieron cargar los usuarios</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}

      <AdminCrudLayout>
        <AdminFormCard title={editingUser ? 'Editar usuario' : 'Registrar usuario'} description={editingUser ? 'Actualiza los datos de la cuenta seleccionada.' : 'Asigna una cuenta con el rol que corresponda.'} onSubmit={submitUser} labelledBy="user-form-title">
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
                <NativeSelect id="user-role" name="role" value={userForm.role} onChange={(event) => updateUserField('role', event.target.value)} aria-invalid={Boolean(userErrors.role)} aria-describedby={userErrors.role ? 'user-role-error' : undefined} disabled={formDisabled} required>
                  <option value="">Selecciona un rol</option>
                  {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
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
            <CatalogFormActions editing={Boolean(editingUser)} pending={pending === 'user'} onCancel={resetUserForm} createLabel="Registrar usuario" />
          </FieldGroup>
        </AdminFormCard>

        <CatalogList title={`Usuarios registrados · ${users.length}`} icon={<UsersIcon />} loading={pending === 'loading'} loadingMessage="Cargando usuarios…" emptyMessage="Todavía no hay usuarios registrados.">
          {users.map((user) => <CatalogRow key={user.id} title={user.name} detail={`${user.email} · ${getRoleLabel(user.role)} · Cédula ${user.identification}${user.phone ? ` · ${user.phone}` : ' · Sin teléfono'}`} active={isUserActive(user)} disabled={formDisabled} deactivating={pending === 'deactivate-user' && pendingUserId === user.id} onEdit={() => startUserEdit(user)} onDeactivate={() => void deactivateUser(user)} />)}
        </CatalogList>
      </AdminCrudLayout>
    </section>
  )
}
