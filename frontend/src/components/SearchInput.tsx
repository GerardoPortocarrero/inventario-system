import type { FC } from 'react';
import { Form } from 'react-bootstrap';

interface SearchInputProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput: FC<SearchInputProps> = ({ searchTerm, onSearchChange, placeholder = 'Buscar...', className }) => {
  return (
    <Form.Group className={className} controlId="searchInput">
      <Form.Control
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </Form.Group>
  );
};

export default SearchInput;
