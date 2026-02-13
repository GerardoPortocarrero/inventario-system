import React, { createContext, useContext, useEffect, useState } from 'react';
import type { FC } from 'react'; // Importación type-only para FC
import { app } from '../api/firebase.ts'; // Ruta de importación actualizada
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth'; // Importación type-only para User

// Define la interfaz para el contexto de autenticación
interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<any>; // Considera tipar mejor el retorno de Promise
  logout: () => Promise<void>;
  loading: boolean; // Añadir estado de carga
}

const AuthContext = createContext<AuthContextType | undefined>(undefined); // Inicializado como undefined

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Estado de carga

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [auth]);

  const login = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value: AuthContextType = {
    currentUser,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};