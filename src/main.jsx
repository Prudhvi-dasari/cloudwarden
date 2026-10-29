import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/ds.css'
import './styles/send.css'
import './styles/download.css'
import './styles/account.css'
import './styles/pages-a.css'
import './styles/pages-b.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
