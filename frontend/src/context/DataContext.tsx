import React, { createContext, useContext, useEffect, useState } from 'react';
import type { FC } from 'react';
import { db } from '../api/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface MasterData {
  id: string;
  nombre: string;
}

interface SedeData extends MasterData {
  locacion: string;
  codigo: string;
}

interface MarcaData extends MasterData {
  tipoBebidaId: string;
}

interface DataContextType {
  roles: MasterData[];
  sedes: SedeData[];
  beverageTypes: MasterData[];
  marcas: MarcaData[];
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
  const [sedes, setSedes] = useState<SedeData[]>([]);
  const [beverageTypes, setBeverageTypes] = useState<MasterData[]>([]);
  const [marcas, setMarcas] = useState<MarcaData[]>([]);
  const [loadingFlags, setLoadingFlags] = useState({ 
    roles: true, 
    sedes: true, 
    types: true,
    marcas: true
  });

  useEffect(() => {
    if (!currentUser) {
      setRoles([]);
      setSedes([]);
      setBeverageTypes([]);
      setMarcas([]);
      setLoadingFlags({ roles: true, sedes: true, types: true, marcas: true });
      return;
    }

    const unsubRoles = onSnapshot(collection(db, 'roles'), (s) => {
      setRoles(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' })));
      setLoadingFlags(prev => ({ ...prev, roles: false }));
    });

    const unsubSedes = onSnapshot(collection(db, 'sedes'), (s) => {
      setSedes(s.docs.map(d => ({ 
        id: d.id, 
        nombre: d.get('nombre') || '',
        locacion: d.get('locacion') || '',
        codigo: d.get('codigo') || ''
      } as SedeData)));
      setLoadingFlags(prev => ({ ...prev, sedes: false }));
    });

    const unsubTypes = onSnapshot(collection(db, 'tiposBebida'), (s) => {
      setBeverageTypes(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' })));
      setLoadingFlags(prev => ({ ...prev, types: false }));
    });

    const unsubMarcas = onSnapshot(collection(db, 'marcas'), (s) => {
      setMarcas(s.docs.map(d => ({ 
        id: d.id, 
        nombre: d.get('nombre') || '',
        tipoBebidaId: d.get('tipoBebidaId') || ''
      })));
      setLoadingFlags(prev => ({ ...prev, marcas: false }));
    });

    return () => {
      unsubRoles();
      unsubSedes();
      unsubTypes();
      unsubMarcas();
    };
  }, [currentUser]);

  const value = {
    roles,
    sedes,
    beverageTypes,
    marcas,
    loadingMasterData: loadingFlags.roles || loadingFlags.sedes || loadingFlags.types || loadingFlags.marcas
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
