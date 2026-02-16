import type { FC } from 'react';
import { Container } from 'react-bootstrap';

const SupervisorPage: FC = () => {
  return (
    <Container>
      <h2>Panel de Supervisión</h2>
      <p>Aquí se mostrarán los reportes y el estado de las ventas en tiempo real.</p>
    </Container>
  );
};

export default SupervisorPage;
