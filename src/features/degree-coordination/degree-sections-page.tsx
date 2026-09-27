import { useState, type FormEvent } from 'react'

import { AdminSectionHeader } from '@/components/admin/admin-section-header'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { useOperation } from '@/features/tutoring/tutoring-hooks'
import { MutationDialog, RecordTable } from '@/features/tutoring/tutoring-shared'
import { degreeCoordinationApi } from '@/lib/degree-coordination-api'
import { DegreePeriodCard } from './degree-shared'
import { useDegreePeriod } from './degree-hooks'

export function DegreeSectionsPage() {
  const resource = useDegreePeriod()
  const operation = useOperation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resource.data || !name.trim()) return
    void operation.run(() => degreeCoordinationApi.registerSection(name.trim()), 'Paralelo registrado en el período vigente.', () => { setOpen(false); resource.reload() })
  }

  return <section className="flex flex-col gap-6">
    <AdminSectionHeader title="Período y paralelos" description="Consulta el período vigente y registra los paralelos para la coordinación de titulación." actions={<Button type="button" disabled={resource.loading || !resource.data || operation.pending} onClick={() => { setName(''); operation.clearError(); setOpen(true) }}>Registrar paralelo</Button>} />
    <DegreePeriodCard resource={resource} />
    {resource.data && <RecordTable rows={resource.data.sections} loading={resource.loading} empty="Todavía no hay paralelos registrados en este período." columns={[
      { label: 'Paralelo', render: (section) => section.name },
      { label: 'Estado', render: (section) => <StatusBadge active={section.is_active} /> },
    ]} />}
    <MutationDialog open={open} title="Registrar paralelo" description={resource.data?.period.name} pending={operation.pending} error={operation.error} dirty={Boolean(name)} onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Registrar paralelo" submitDisabled={!name.trim() || !resource.data}>
      <Field><FieldLabel htmlFor="degree-section-name">Nombre del paralelo</FieldLabel><Input id="degree-section-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={50} placeholder="Ej. A" /><FieldDescription>Si el paralelo ya existe, se vinculará al período vigente.</FieldDescription></Field>
    </MutationDialog>
  </section>
}
