import React from 'react';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (value: string) => void;
}

export function CurrencyInput({
  value,
  onChange,
  ...props
}: CurrencyInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;
    
    // Remove any existing formatting
    newValue = newValue.replace(/[^\d]/g, '');
    
    // Convert to number and format
    if (newValue) {
      const number = parseInt(newValue, 10);
      if (!isNaN(number)) {
        // Format with thousands separator and decimal places
        newValue = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(number / 100);
      }
    }
    
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <Input
      {...props}
      value={value}
      onChange={handleChange}
      inputMode="numeric"
    />
  );
}