import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-ink/80">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`rounded-brand border border-edge bg-surface px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/20 ${className}`}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
