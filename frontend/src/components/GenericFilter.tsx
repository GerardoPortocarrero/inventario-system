import type { FC } from 'react';

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
    <div className={`generic-filter-wrapper d-inline-block ${className}`}>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="unified-filter-select"
      >
        <option value="">{prefix}: {placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {prefix}: {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default GenericFilter;
