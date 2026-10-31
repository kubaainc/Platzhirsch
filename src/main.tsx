import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Public from './Public.tsx'
import Cancel from './Cancel.tsx'
import { getLook, setLook } from './look.ts'

setLook(getLook())

const pub = location.pathname.match(/^\/b\/([a-z0-9-]+)\/?$/)
const storno = location.pathname.match(/^\/s\/([0-9a-f-]{36})\/?$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pub ? <Public slug={pub[1]} /> : storno ? <Cancel token={storno[1]} /> : <App />}
  </StrictMode>,
)
