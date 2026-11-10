import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/pwa.ts'

registerServiceWorker()

// Si el navegador restaura la página desde su caché al ir atrás (por ejemplo, después de
// cerrar sesión), se recarga: así nunca se ve la pantalla de la cuenta anterior.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
