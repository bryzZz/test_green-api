import { SendHorizontal } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react';

// GREEN-API sendMessage accepts at most 4000 characters.
export const MAX_MESSAGE_LENGTH = 4000;

// Roughly nine lines, after which the field scrolls.
const MAX_FIELD_HEIGHT = 180;

type ComposerProps = {
  onSend: (text: string) => void;
};

export function Composer({ onSend }: ComposerProps) {
  const [value, setValue] = useState('');
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const text = value.trim();

  // On a wide screen, as in MAX, typing can start at once; on a phone this
  // would open the on-screen keyboard over the conversation.
  useEffect(() => {
    if (window.matchMedia?.('(min-width: 926px)').matches) {
      fieldRef.current?.focus();
    }
  }, []);

  // Grow with the content, like the composer of MAX.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_FIELD_HEIGHT)}px`;
  }, [value]);

  function send() {
    if (!text) return;
    onSend(text);
    setValue('');
    fieldRef.current?.focus();
  }

  const handleKeyDown: ComponentProps<'textarea'>['onKeyDown'] = (event) => {
    // Enter confirms a candidate in an IME, it must not send the message.
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    send();
  };

  return (
    <div className="shrink-0 px-3 pb-3 md:px-6 md:pb-4">
      <div className="bg-bg shadow-composer mx-auto flex max-w-177 items-end gap-2 rounded-lg px-3 py-1.5">
        <textarea
          ref={fieldRef}
          aria-label="Сообщение"
          placeholder="Сообщение"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className="placeholder:text-text-tertiary caret-accent min-h-9 flex-1 resize-none py-2 text-base leading-5 tracking-[0.15px] outline-none"
        />
        {text && (
          <button
            type="button"
            aria-label="Отправить сообщение"
            onClick={send}
            className="bg-accent hover:bg-accent-hover active:bg-accent-pressed mb-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <SendHorizontal className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
