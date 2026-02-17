import React from 'react';
import { Spinner } from 'react-bootstrap';
import { SPINNER_VARIANTS } from '../constants';

interface GlobalSpinnerProps {
  // En lugar de 'overlay' | 'in-page', usamos los valores de tu constante
  variant?: typeof SPINNER_VARIANTS.OVERLAY | typeof SPINNER_VARIANTS.IN_PAGE;
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(18, 18, 18, 0.7)', // Fondo oscuro semi-transparente
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
};

const inPageStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  height: '100%',
};

const GlobalSpinner: React.FC<GlobalSpinnerProps> = ({ 
  variant = SPINNER_VARIANTS.OVERLAY // Valor por defecto usando la constante
}) => {
  
  // Comparas contra la constante en lugar de escribir el texto
  const currentStyles = variant === SPINNER_VARIANTS.OVERLAY ? overlayStyles : inPageStyles;

  return (
    <div style={currentStyles}>
      <Spinner animation="border" role="status" className="spinner-primary">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    </div>
  );
};

export default GlobalSpinner;