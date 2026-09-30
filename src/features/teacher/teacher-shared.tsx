import { GraduationCapIcon } from 'lucide-react'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function TeacherEmpty({ title, description }: Readonly<{ title: string; description?: string }>) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><GraduationCapIcon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle>{description && <EmptyDescription>{description}</EmptyDescription>}</EmptyHeader></Empty>
}
