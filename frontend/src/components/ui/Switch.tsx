import React from "react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer select-none ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out border border-straw/20 shadow-inner ${
            checked ? "bg-amber-600/80" : "bg-soil-800"
          }`}
        />
        <div
          className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-parchment shadow-md transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
            checked ? "translate-x-6 bg-gold" : "translate-x-0"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-soil-900/40" />
        </div>
      </div>
      {label && <span className="text-sm font-medium text-parchment tracking-wide">{label}</span>}
    </label>
  );
}
