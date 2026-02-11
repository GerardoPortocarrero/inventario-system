import React from 'react';
import { Container } from 'react-bootstrap';

function Dashboard() {
  return (
    <Container className="my-4">
      <h2>Dashboard</h2>
      <p>Bienvenido al sistema de inventario. Selecciona una opción del menú lateral.</p>
      {/* Aquí se mostrarán los widgets o resúmenes para cada rol */}
    </Container>
  );
}

export default Dashboard;
