import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css'; // Importa el CSS de Bootstrap
import { AuthProvider } from './context/AuthContext.jsx'; // Importa el AuthProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider> {/* Envuelve la aplicación con AuthProvider */}
      <App />
    </AuthProvider>
  </React.StrictMode>,
)