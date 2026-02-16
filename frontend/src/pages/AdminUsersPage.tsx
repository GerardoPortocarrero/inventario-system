import type { FC } from 'react';
import { Container } from 'react-bootstrap';

const AdminUsersPage: FC = () => {
  return (
    <Container>
      <h2>Gestión de Usuarios</h2>
      <p>Aquí se podrán crear, editar y eliminar usuarios del sistema.</p>
    </Container>
  );
};

export default AdminUsersPage;
