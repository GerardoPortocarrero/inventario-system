import React, { createContext, useContext, useEffect, useState } from 'react';
import type { FC } from 'react';
import { db } from '../api/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface MasterData {
  id: string;
  nombre: string;
}

interface DataContextType {
  roles: MasterData[];
  sedes: MasterData[];
  beverageTypes: MasterData[];
  loadingMasterData: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};

export const DataProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [roles, setRoles] = useState<MasterData[]>([]);
  const [sedes, setSedes] = useState<MasterData[]>([]);
  const [beverageTypes, setBeverageTypes] = useState<MasterData[]>([]);
  const [loadingFlags, setLoadingFlags] = useState({ roles: true, sedes: true, types: true });

  useEffect(() => {
    if (!currentUser) {
      setRoles([]);
      setSedes([]);
      setBeverageTypes([]);
      setLoadingFlags({ roles: true, sedes: true, types: true });
      return;
    }

    const unsubRoles = onSnapshot(collection(db, 'roles'), (s) => {
      setRoles(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' })));
      setLoadingFlags(prev => ({ ...prev, roles: false }));
    });

    const unsubSedes = onSnapshot(collection(db, 'sedes'), (s) => {
      setSedes(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' })));
      setLoadingFlags(prev => ({ ...prev, sedes: false }));
    });

    const unsubTypes = onSnapshot(collection(db, 'tiposBebida'), (s) => {
      setBeverageTypes(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' })));
      setLoadingFlags(prev => ({ ...prev, types: false }));
    });

    return () => {
      unsubRoles();
      unsubSedes();
      unsubTypes();
    };
  }, [currentUser]);

  const value = {
    roles,
    sedes,
    beverageTypes,
    loadingMasterData: loadingFlags.roles || loadingFlags.sedes || loadingFlags.types
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
