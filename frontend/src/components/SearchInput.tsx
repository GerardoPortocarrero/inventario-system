import type { FC } from 'react';
import { Form } from 'react-bootstrap';
import { UI_TEXTS } from '../constants';

interface SearchInputProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput: FC<SearchInputProps> = ({ searchTerm, onSearchChange, placeholder = UI_TEXTS.PLACEHOLDER_SEARCH_SEDES, className }) => {
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
