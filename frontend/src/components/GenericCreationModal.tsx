import React from 'react';
import { Modal } from 'react-bootstrap';
import './GenericCreationModal.css';

interface GenericCreationModalProps {
  show: boolean;
  onHide: () => void;
  title?: string;
  children: React.ReactNode;
  dialogClassName?: string;
}

const GenericCreationModal: React.FC<GenericCreationModalProps> = ({ 
  show, 
  onHide, 
  children, 
  dialogClassName 
}) => {
  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      centered 
      dialogClassName={`generic-modal ${dialogClassName || ''}`}
    >
      <Modal.Body className="p-4">
        {children}
      </Modal.Body>
    </Modal>
  );
};

export default GenericCreationModal;
