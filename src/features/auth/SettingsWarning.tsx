import { PrimaryButton } from '@/shared/ui/PrimaryButton';

type SettingsWarningProps = {
  /** Names of the settings that keep messages from arriving. */
  problems: string[];
  onContinue: () => void;
};

/** Shown instead of the login button when the instance is set up wrongly. */
export const SettingsWarning = ({
  problems,
  onContinue,
}: SettingsWarningProps) => (
  <>
    <p
      role="alert"
      className="bg-bg-secondary mb-2 rounded-md p-3 text-[13px] leading-4"
    >
      Инстанс настроен не для получения сообщений через HTTP API:{' '}
      {problems.join(', ')}. Входящие сообщения могут не приходить. Исправьте
      настройки в личном кабинете GREEN-API или продолжите как есть.
    </p>
    <PrimaryButton onClick={onContinue}>Продолжить</PrimaryButton>
  </>
);
