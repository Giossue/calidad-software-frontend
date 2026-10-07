import type { BulkImportType } from '@/lib/api'

export interface BulkImportColumn {
  readonly name: string
  readonly required: boolean
  readonly hint?: string
}

const ACCOUNT_COLUMNS: readonly BulkImportColumn[] = [
  { name: 'cedula', required: false, hint: 'Cédula o pasaporte; si falta, la completa el usuario.' },
  { name: 'nombre', required: false, hint: 'Si falta, la completa el usuario.' },
  { name: 'telefono', required: false, hint: 'Celular de 10 dígitos.' },
]

/** Columnas aceptadas por cada carga masiva; reflejan los importadores del backend. */
export const BULK_IMPORT_COLUMNS: Record<BulkImportType, readonly BulkImportColumn[]> = {
  users: [
    { name: 'correo', required: true },
    { name: 'rol', required: true, hint: 'estudiante, docente, coordinador_carrera, coordinador_titulacion o administrador.' },
    { name: 'carrera', required: false, hint: 'Nombre de la carrera; obligatoria salvo para administrador.' },
    ...ACCOUNT_COLUMNS,
  ],
  teachers: [
    { name: 'correo', required: true, hint: 'Correo institucional @ueb.edu.ec.' },
    { name: 'carrera', required: true, hint: 'Una de las carreras que coordinas.' },
    ...ACCOUNT_COLUMNS,
  ],
  students: [
    { name: 'correo', required: true, hint: 'Correo institucional @ueb.edu.ec.' },
    { name: 'carrera', required: true, hint: 'Una de las carreras que coordinas.' },
    ...ACCOUNT_COLUMNS,
  ],
  faculties: [{ name: 'nombre', required: true }],
  careers: [
    { name: 'facultad', required: true, hint: 'Nombre de la facultad.' },
    { name: 'nombre', required: true },
    { name: 'ciclos', required: false, hint: 'Cantidad de ciclos (8 por defecto).' },
    { name: 'modalidad', required: false, hint: 'Nombre de la modalidad.' },
  ],
  cycles: [
    { name: 'carrera', required: true, hint: 'Nombre de la carrera.' },
    { name: 'numero', required: true },
    { name: 'nombre', required: true },
  ],
  'academic-periods': [
    { name: 'nombre', required: true },
    { name: 'fecha_inicio', required: true, hint: 'Formato AAAA-MM-DD.' },
    { name: 'fecha_fin', required: true, hint: 'Formato AAAA-MM-DD.' },
  ],
  subjects: [
    { name: 'carrera', required: true, hint: 'Nombre de la carrera.' },
    { name: 'nombre', required: true },
    { name: 'codigo', required: false },
    { name: 'ciclo', required: false, hint: 'Número del ciclo.' },
    { name: 'modalidad', required: false, hint: 'Nombre de la modalidad.' },
  ],
  sections: [{ name: 'nombre', required: true, hint: 'Se asocia al período académico vigente.' }],
}

export const BULK_IMPORT_POLL_MS = 2000
