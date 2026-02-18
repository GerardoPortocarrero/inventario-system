import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { UI_TEXTS } from '../constants'; // Para el texto del botón cerrar

interface GenericCreationModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  children: React.ReactNode; // Contenido del formulario
}

const GenericCreationModal: React.FC<GenericCreationModalProps> = ({ show, onHide, title, children }) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {children}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} className="rounded-0 shadow-none">
          {UI_TEXTS.CLOSE}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GenericCreationModal;
