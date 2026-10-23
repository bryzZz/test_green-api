type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

/** A labelled text input in the look of the MAX forms. */
export const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: FieldProps) => (
  <label className="mb-3 block">
    <span className="text-text-tertiary mb-1 block px-3 text-[13px] leading-4">
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className="rounded-lg bg-input caret-accent placeholder:text-text-tertiary h-13 w-full px-3 text-base leading-5 outline-none"
    />
  </label>
);
