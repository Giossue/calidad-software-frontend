import { useSearchParams } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TutoringStudentsPage } from './students-page'
import { TutoringTeachersPage } from './teachers-page'
import { USERS_TAB_PARAM, usersTab, type UsersTab } from './tutoring-navigation'
import type { TabbedScreen } from './tutoring-shared'

/** Parámetros de la URL que abren un docente o un estudiante: no pasan a la otra pestaña. */
const DETAIL_PARAMS = ['docente', 'estudiante'] as const

/**
 * «Usuarios» del coordinador de carrera: docentes y estudiantes en pestañas. La pestaña vive
 * en la URL (`?pestana=`) y la carrera elegida (`?carrera=`) se conserva al cambiar de pestaña.
 * Cada pestaña pone su propio título, su descripción y sus acciones; al abrir un
 * docente o un estudiante, las pestañas se ocultan.
 */
export function TutoringUsersPage() {
  const [params, setParams] = useSearchParams()
  const tab = usersTab(params)

  function selectTab(value: string) {
    if (value === tab) return
    const next = new URLSearchParams(params)
    DETAIL_PARAMS.forEach((param) => next.delete(param))
    next.set(USERS_TAB_PARAM, value as UsersTab)
    setParams(next)
  }

  const screen: TabbedScreen = {
    tabCount: 2,
    tabs: (
      <TabsList aria-label="Tipo de usuario" data-tour="page-users-tabs">
        <TabsTrigger value="docentes">Docentes</TabsTrigger>
        <TabsTrigger value="estudiantes">Estudiantes</TabsTrigger>
      </TabsList>
    ),
  }

  return (
    <Tabs value={tab} onValueChange={selectTab} className="gap-0">
      <TabsContent value="docentes">
        <TutoringTeachersPage screen={screen} />
      </TabsContent>
      <TabsContent value="estudiantes">
        <TutoringStudentsPage screen={screen} />
      </TabsContent>
    </Tabs>
  )
}
