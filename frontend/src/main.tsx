import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tailwind first so the legacy stylesheet wins specificity ties on the
// not-yet-converted pages (landing, provider portal).
import './tailwind.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
