import type { FC } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { UI_TEXTS } from '../constants';

interface SearchInputProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput: FC<SearchInputProps> = ({ 
  searchTerm, 
  onSearchChange, 
  placeholder = UI_TEXTS.PLACEHOLDER_SEARCH_USERS, 
  className 
}) => {
  return (
    <Form.Group className={className} controlId="searchInput">
      <InputGroup className="search-input-group">
        <InputGroup.Text className="search-icon-bg border-radius-0">
          <FaSearch className="search-icon-v2" />
        </InputGroup.Text>
        <Form.Control
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-control-v2 border-radius-0"
          autoComplete="off"
        />
        {searchTerm && (
          <Button 
            variant="outline-secondary" 
            className="search-clear-btn border-radius-0" 
            onClick={() => onSearchChange('')}
          >
            <FaTimes />
          </Button>
        )}
      </InputGroup>

      <style>{`
        .search-input-group {
          border: 1px solid var(--theme-border-default);
          background-color: var(--theme-background-secondary);
        }
        .search-icon-bg {
          background-color: transparent !important;
          border: none !important;
          color: var(--theme-text-secondary);
          padding-left: 12px;
          padding-right: 8px;
        }
        .search-control-v2 {
          background-color: transparent !important;
          border: none !important;
          color: var(--theme-text-primary) !important;
          padding: 10px 8px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .search-control-v2::placeholder {
          color: var(--theme-text-secondary);
          opacity: 0.6;
          font-weight: 400;
        }
        .search-clear-btn {
          border: none !important;
          background-color: transparent !important;
          color: var(--theme-text-secondary) !important;
          padding-right: 12px;
        }
        .search-clear-btn:hover {
          color: var(--color-red-primary) !important;
        }
        .search-icon-v2 {
          font-size: 0.85rem;
          opacity: 0.7;
        }
        .border-radius-0 {
          border-radius: 0 !important;
        }
        
        /* Focus state */
        .search-input-group:focus-within {
          border-color: var(--color-red-primary) !important;
        }
      `}</style>
    </Form.Group>
  );
};

export default SearchInput;
