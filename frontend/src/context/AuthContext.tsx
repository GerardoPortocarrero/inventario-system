import React, { createContext, useContext, useEffect, useState } from 'react';
import type { FC } from 'react';
import { auth, db } from '../api/firebase'; // Importa auth y db directamente
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Define la interfaz para el contexto de autenticación
interface AuthContextType {
  currentUser: User | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null; // El ID del rol (ej. "admin", "preventista")
  userSedeId: string | null; // El ID de la sede a la que pertenece el usuario
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
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null); // Estado para el rolId
  const [userSedeId, setUserSedeId] = useState<string | null>(null); // Estado para el sedeId del usuario
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Si hay un usuario, busca su rol y sedeId en Firestore
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.nombre || '');
          setUserEmail(userData.email || user.email);
          setUserRole(userData.rolId);
          setUserSedeId(userData.sedeId);
        } else {
          console.error("Error: El usuario está autenticado pero no tiene un documento correspondiente en la colección 'usuarios' de Firestore.");
          setUserName(null);
          setUserEmail(null);
          setUserRole(null);
          setUserSedeId(null);
        }
        setCurrentUser(user);
      } else {
        // Si no hay usuario, se limpia el estado
        setCurrentUser(null);
        setUserName(null);
        setUserEmail(null);
        setUserRole(null);
        setUserSedeId(null);
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
    userName,
    userEmail,
    userRole,
    userSedeId, // Provee el sedeId del usuario
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