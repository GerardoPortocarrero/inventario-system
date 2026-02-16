import type { FC, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute: FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <h2>Cargando...</h2>
      </div>
    );
  }

  // Comprueba si el rol del usuario está en la lista de roles permitidos.
  // El rol 'admin' tiene acceso a todo, así que lo incluimos siempre.
  const isAllowed = userRole && (allowedRoles.includes(userRole) || userRole === 'admin');

  if (!isAllowed) {
    // Si el rol del usuario no está permitido, redirigir a una página de "no autorizado".
    return <Navigate to="/unauthorized" />; 
  }

  return <>{children}</>;
};

export default ProtectedRoute;
