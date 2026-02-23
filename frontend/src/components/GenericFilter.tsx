import type { FC } from 'react';
import { Form } from 'react-bootstrap';

interface FilterOption {
  value: string;
  label: string;
}

interface GenericFilterProps {
  prefix: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  className?: string;
}

const GenericFilter: FC<GenericFilterProps> = ({ 
  prefix,
  value, 
  onChange, 
  options, 
  placeholder = "Todos", 
  className 
}) => {
  return (
    <div className={`generic-filter-container d-flex align-items-center ${className}`}>
      <span className="filter-prefix text-secondary small pe-1">
        {prefix}:
      </span>
      <Form.Select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="filter-select border-0 shadow-none bg-transparent py-1 ps-0 pe-4"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Form.Select>
    </div>
  );
};

export default GenericFilter;
