import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SiteRouter } from './SiteRouter.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteRouter />
  </StrictMode>,
)
