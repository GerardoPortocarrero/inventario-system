import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Importación centralizada de CSS
import 'bootstrap/dist/css/bootstrap.min.css'; // 1. Bootstrap primero
import './App.css'; // 2. Nuestros overrides y estilos globales

import { AuthProvider } from './context/AuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
