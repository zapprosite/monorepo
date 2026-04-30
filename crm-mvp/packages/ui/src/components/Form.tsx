import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full bg-bg-tertiary rounded-input border px-4 py-2 text-text-primary
            placeholder:text-text-muted
            focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30
            transition-colors
            ${error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-white/10'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full bg-bg-tertiary rounded-input border px-4 py-2 text-text-primary
            placeholder:text-text-muted
            focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30
            transition-colors resize-y min-h-[80px]
            ${error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-white/10'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, onChange, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full bg-bg-tertiary rounded-input border px-4 py-2 text-text-primary
            focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30
            transition-colors appearance-none
            ${error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-white/10'}
            ${className}
          `}
          onChange={(e) => onChange?.(e.target.value)}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
