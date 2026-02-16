import type { FC } from 'react';
import { Container, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const UnauthorizedPage: FC = () => {
  const navigate = useNavigate();

  return (
    <Container className="d-flex flex-column justify-content-center align-items-center vh-100 text-center">
      <h1>Acceso Denegado</h1>
      <p className="lead">No tienes los permisos necesarios para acceder a esta página.</p>
      <Button variant="primary" onClick={() => navigate('/dashboard')}>
        Volver al Inicio
      </Button>
    </Container>
  );
};

export default UnauthorizedPage;
