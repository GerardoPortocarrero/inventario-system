import React from 'react';
import { Button } from 'react-bootstrap';
import { FaPlus } from 'react-icons/fa'; // Importar el icono de más
import './FabButton.css'; // Importar los estilos CSS específicos

interface FabButtonProps {
  onClick: () => void; // Función a ejecutar al hacer clic
  className?: string; // Clases adicionales para el botón
}

const FabButton: React.FC<FabButtonProps> = ({ onClick, className }) => {
  return (
    <Button 
      variant="primary" // Usar la variante primary de Bootstrap
      className={`fab-button rounded-0 shadow-none ${className || ''}`} // Clases para el estilo plano y fijo
      onClick={onClick}
    >
      <FaPlus /> {/* Icono de más */}
    </Button>
  );
};

export default FabButton;
