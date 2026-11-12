"use client";

import { useId } from "react";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  required?: boolean;
}

// Searchable select backed by a native <datalist>. Handles large option
// lists (e.g. 2000+ schools) with built-in browser autocomplete and no
// extra dependencies. Matches the old portal's searchable-select behavior.
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  id,
  required,
}: ComboboxProps) {
  const generatedId = useId();
  const listId = `${id || generatedId}-list`;

  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="mt-1 block h-12 w-full appearance-none rounded-md border border-gray-400 px-3 transition-colors placeholder:text-gray-500 focus:border-gray-600 focus:outline-none"
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}
