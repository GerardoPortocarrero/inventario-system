import React, { useState, FC } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import './LoginPage.css';
import logo from '../assets/logo.png';

const LoginPage: FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (firebaseError: any) {
      let errorMessage = 'Fallo al iniciar sesión. Por favor, revisa tus credenciales.';
      if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
        errorMessage = 'Correo electrónico o contraseña incorrectos.';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'El formato del correo electrónico no es válido.';
      }
      setError(errorMessage);
    }
    setLoading(false);
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 flex-column">
      {/* Contenedor del logo con fondo blanco y bordes ligeramente redondeados */}
      <div className="mb-3 p-2" style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '300px', width: '100%' }}> {/* Añadido maxWidth y width para que coincida con la Card */}
        <img
          src={logo}
          alt="Logo Inventario A Y A"
          style={{ width: '100%', height: 'auto', display: 'block', margin: '0 auto' }} // Logo al 100% del ancho del contenedor
        />
      </div>
      <h2 className="text-center mb-4" style={{ color: 'var(--theme-text-primary)' }}>Inventario A Y A</h2>
      <Card style={{ maxWidth: '300px', width: '100%' }}> {/* Login menos ancho */}
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group id="email" className="mb-3">
              <Form.Label>Correo Electrónico</Form.Label>
              <Form.Control 
                type="email" 
                value={email} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} 
                required 
                placeholder="Ingresa tu correo"
              />
            </Form.Group>
            <Form.Group id="password" className="mb-3">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control 
                type="password" 
                value={password} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
                required 
                placeholder="Ingresa tu contraseña"
              />
            </Form.Group>
            <Button disabled={loading} className="w-100" type="submit">
              {loading ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default LoginPage;