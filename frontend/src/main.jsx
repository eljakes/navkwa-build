import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PortalApp from './PortalApp.jsx'

const RootApp = window.location.pathname.startsWith('/portal') ? PortalApp : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
