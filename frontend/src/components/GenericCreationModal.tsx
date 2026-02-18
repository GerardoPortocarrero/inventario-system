import React from 'react';
import { Modal, Button } from 'react-bootstrap';
// No es necesario importar UI_TEXTS aquí si el botón de cerrar se gestiona externamente.
// import { UI_TEXTS } from '../constants'; // Para el texto del botón cerrar

interface GenericCreationModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  children: React.ReactNode; // Contenido del formulario o confirmación
}

const GenericCreationModal: React.FC<GenericCreationModalProps> = ({ show, onHide, title, children }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header> {/* closeButton eliminado */}
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {children}
      </Modal.Body>
      {/* Modal.Footer eliminado para que los botones se gestionen en children */}
    </Modal>
  );
};

export default GenericCreationModal;
