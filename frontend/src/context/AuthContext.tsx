import React, { createContext, useContext, useEffect, useState } from 'react';
import type { FC } from 'react';
import { auth, db } from '../api/firebase'; // Importa auth y db directamente
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Define la interfaz para el contexto de autenticación
interface AuthContextType {
  currentUser: User | null;
  userRole: string | null; // El ID del rol (ej. "admin", "preventista")
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null); // Estado para el rolId
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Si hay un usuario, busca su rol en Firestore
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          // El rol está en el campo 'rolId' según la nueva documentación
          setUserRole(userDoc.data().rolId);
        } else {
          console.error("Error: El usuario está autenticado pero no tiene un documento correspondiente en la colección 'usuarios' de Firestore.");
          setUserRole(null);
        }
        setCurrentUser(user);
      } else {
        // Si no hay usuario, se limpia el estado
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value: AuthContextType = {
    currentUser,
    userRole, // Provee el rol del usuario
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};