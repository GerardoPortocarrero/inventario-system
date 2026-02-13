import type { FC } from 'react'; // Importa FC como type-only
import { Container } from 'react-bootstrap';

const Dashboard: FC = () => { // Define el tipo de componente funcional
  return (
    <Container>
      <h2>Dashboard</h2>
      <p>Bienvenido al sistema de inventario. Selecciona una opción del menú lateral.</p>
      {/* Aquí se mostrarán los widgets o resúmenes para cada rol */}
    </Container>
  );
};

export default Dashboard;