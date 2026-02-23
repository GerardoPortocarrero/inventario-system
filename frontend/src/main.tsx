import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx'; // Importa App.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';

ReactDOM.createRoot(document.getElementById('root')!).render( // Usa ! para asegurar que el elemento existe
  <React.StrictMode>
    <AuthProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </AuthProvider>
  </React.StrictMode>,
);