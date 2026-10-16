import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
// The page-wide styles come before every component's, so a component's own rule wins over a
// page-wide one it ties with. The few that must win anyway (focus, dragging) come after.
import './global.css'
import { App } from './App'
import { startDisplay } from './display'
import './overrides.css'

startDisplay()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
