import { IMaskInput } from 'react-imask';

type PhoneFieldProps = {
  /** The text as masked, e.g. `+7 (999) 123-45-67`. */
  value: string;
  onChange: (value: string) => void;
};

/** A Russian phone number input: the mask shows the +7 itself. */
export const PhoneField = ({ value, onChange }: PhoneFieldProps) => (
  <label className="block">
    <span className="sr-only">Номер телефона</span>
    <IMaskInput
      mask="+{7} (000) 000-00-00"
      value={value}
      // A leading 8 (or a pasted +7 / 7) is the country code, which the mask
      // already shows.
      prepare={(appended, masked) =>
        ['', '7'].includes(masked.unmaskedValue)
          ? appended.replace(/^(\+7|\+|7|8)/, '')
          : appended
      }
      onAccept={onChange}
      type="tel"
      inputMode="tel"
      autoComplete="off"
      autoFocus
      placeholder="+7 (999) 123-45-67"
      className="rounded-lg bg-input caret-accent placeholder:text-text-tertiary h-13 w-full px-3 text-base leading-5 outline-none"
    />
  </label>
);
