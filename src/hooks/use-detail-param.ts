import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Registro abierto en la URL (`?<name>=<id>`), para que el botón "Atrás" del navegador
 * vuelva a la lista. Si se abrió desde la lista, "Volver" retrocede en el historial.
 */
export function useDetailParam(name: string) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const raw = Number(params.get(name))
  const id = Number.isInteger(raw) && raw > 0 ? raw : null
  const openedFromList = (location.state as { detailParam?: string } | null)?.detailParam === name

  function open(nextId: number) {
    const next = new URLSearchParams(params)
    next.set(name, String(nextId))
    setParams(next, { state: { detailParam: name } })
  }

  function close() {
    if (openedFromList) {
      void navigate(-1)
      return
    }
    const next = new URLSearchParams(params)
    next.delete(name)
    setParams(next, { replace: true })
  }

  return { id, open, close }
}
