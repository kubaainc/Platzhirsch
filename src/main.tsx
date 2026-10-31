import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Public from './Public.tsx'

const pub = location.pathname.match(/^\/b\/([a-z0-9-]+)\/?$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pub ? <Public slug={pub[1]} /> : <App />}
  </StrictMode>,
)
