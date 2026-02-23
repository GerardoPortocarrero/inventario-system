import type { FC } from 'react';
import { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { updatePassword as updateFirebasePassword } from 'firebase/auth';
import { UI_TEXTS } from '../constants';
import './ProfilePage.css';

const ProfilePage: FC = () => {
  const { userName, userEmail, userRole, userSedeId, currentUser } = useAuth();
  const { roles, sedes } = useData();
  const isDarkMode = localStorage.getItem('theme') === 'dark' || localStorage.getItem('theme') === null;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleName = roles.find(r => r.id === userRole)?.nombre || userRole;
  const sedeName = sedes.find(s => s.id === userSedeId)?.nombre || userSedeId;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 6) {
      setError(UI_TEXTS.PASSWORD_MIN_LENGTH);
      return;
    }

    if (!currentUser) return;

    setLoading(true);
    try {
      await updateFirebasePassword(currentUser, newPassword);
      setSuccess(UI_TEXTS.PASSWORD_UPDATED_SUCCESS);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setError('Error al actualizar la contraseña. Es posible que debas cerrar sesión e iniciarla de nuevo para realizar esta acción.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="profile-page py-4">
      
      <Row className="g-4">
        {/* Información del Perfil */}
        <Col lg={6}>
          <Card className={`profile-card h-100 ${isDarkMode ? 'bg-dark border-secondary' : ''}`}>
            <Card.Header className="py-3 border-bottom border-secondary">
              <h5 className="mb-0">{UI_TEXTS.PERSONAL_DATA}</h5>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="mb-4">
                <label className="text-secondary small d-block mb-1">{UI_TEXTS.FULL_NAME}</label>
                <div className="h5 mb-0">{userName}</div>
              </div>
              <div className="mb-4">
                <label className="text-secondary small d-block mb-1">{UI_TEXTS.EMAIL}</label>
                <div className="h5 mb-0">{userEmail}</div>
              </div>
              <Row>
                <Col sm={6} className="mb-4 mb-sm-0">
                  <label className="text-secondary small d-block mb-1">{UI_TEXTS.ROLE}</label>
                  <div className="h5 mb-0 text-capitalize">{roleName}</div>
                </Col>
                <Col sm={6}>
                  <label className="text-secondary small d-block mb-1">{UI_TEXTS.SEDE}</label>
                  <div className="h5 mb-0">{sedeName}</div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* Cambio de Contraseña */}
        <Col lg={6}>
          <Card className={`profile-card h-100 ${isDarkMode ? 'bg-dark border-secondary' : ''}`}>
            <Card.Header className="py-3 border-bottom border-secondary">
              <h5 className="mb-0">{UI_TEXTS.ACCOUNT_SETTINGS}</h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handlePasswordChange}>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-secondary">{UI_TEXTS.NEW_PASSWORD}</Form.Label>
                  <Form.Control
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="******"
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label className="small text-secondary">{UI_TEXTS.CONFIRM_PASSWORD}</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="******"
                  />
                </Form.Group>

                {success && <Alert variant="success" className="py-2 small">{success}</Alert>}
                {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

                <Button 
                  variant="primary" 
                  type="submit" 
                  className="w-100 fw-bold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                      {UI_TEXTS.LOADING}
                    </>
                  ) : UI_TEXTS.UPDATE_PASSWORD}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfilePage;
