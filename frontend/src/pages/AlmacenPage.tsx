import type { FC } from 'react';
import { Container } from 'react-bootstrap';

const AlmacenPage: FC = () => {
  return (
    <Container>
      <h2>Control de Almacén</h2>
      <p>Aquí se gestionarán las entradas y salidas de inventario físico.</p>
    </Container>
  );
};

export default AlmacenPage;
