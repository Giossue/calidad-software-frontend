import type { BulkImportType } from '@/lib/api'

export interface BulkImportColumn {
  readonly name: string
  readonly required: boolean
  readonly hint?: string
}

/** Formato común de las cargas de cuentas; cada pantalla marca cuáles exige. */
function accountColumns(required: readonly string[], hints: Readonly<Record<string, string>>): readonly BulkImportColumn[] {
  const base: readonly BulkImportColumn[] = [
    { name: 'correo', required: true, hint: 'Correo institucional @ueb.edu.ec.' },
    { name: 'cedula', required: false, hint: 'Cédula o pasaporte; si falta, la completa el usuario.' },
    { name: 'nombres', required: false, hint: 'Si faltan, los completa el usuario.' },
    { name: 'apellidos', required: false },
    { name: 'rol', required: false },
    { name: 'facultad', required: false, hint: 'Nombre de la facultad.' },
    { name: 'carrera', required: false, hint: 'Nombre de la carrera dentro de esa facultad.' },
    { name: 'ciclo', required: false, hint: 'Número del ciclo (1, 2, 3…).' },
    { name: 'telefono', required: false, hint: 'Celular de 10 dígitos.' },
  ]
  return base.map((column) => ({ ...column, required: column.required || required.includes(column.name), hint: hints[column.name] ?? column.hint }))
}

/** Columnas aceptadas por cada carga masiva; reflejan los importadores del backend. */
export const BULK_IMPORT_COLUMNS: Record<BulkImportType, readonly BulkImportColumn[]> = {
  users: accountColumns(['rol'], {
    correo: 'Correo del usuario.',
    rol: 'estudiante, docente, coordinador_carrera, coordinador_titulacion o administrador.',
    facultad: 'Obligatoria salvo para administrador.',
    carrera: 'Obligatoria salvo para administrador.',
    ciclo: 'Número del ciclo; obligatorio para estudiantes.',
  }),
  teachers: accountColumns(['facultad', 'carrera'], { rol: 'Opcional; si se indica, debe ser docente.', carrera: 'Una de las carreras que coordinas.', ciclo: 'No se usa para docentes.' }),
  students: accountColumns(['facultad', 'carrera', 'ciclo'], { rol: 'Opcional; si se indica, debe ser estudiante.', carrera: 'Una de las carreras que coordinas.' }),
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

/**
 * Instrucciones que se insertan al inicio de la plantilla CSV. Cada línea va en
 * una sola celda entre comillas y empieza con `#`: Excel no la parte por el
 * separador y el backend la ignora al importar.
 */
export function bulkImportInstructions(type: BulkImportType): string {
  const lines = [
    '# INSTRUCCIONES (las líneas que empiezan con # no se importan; puedes borrarlas).',
    '# 1. Escribe un registro por fila, debajo de los encabezados. No cambies los nombres de las columnas.',
    '# 2. Columnas:',
    ...BULK_IMPORT_COLUMNS[type].map((column) => `#    - ${column.name} (${column.required ? 'obligatoria' : 'opcional'})${column.hint ? `: ${column.hint}` : ''}`),
    '# 3. Guarda el archivo como CSV (separado por comas o punto y coma) y súbelo en «Cargar datos masivos». Máximo 2 MB y 1000 filas.',
  ]
  return lines.map((line) => `"${line.replaceAll('"', '""')}"`).join('\r\n') + '\r\n'
}

export const BULK_IMPORT_POLL_MS = 2000
