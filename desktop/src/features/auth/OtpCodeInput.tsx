import { useRef } from 'react';
import { isCompleteOtp } from './authValidation';

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  ariaLabelPrefix?: string;
}

const OtpCodeInput = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  ariaLabelPrefix = '인증 코드',
}: OtpCodeInputProps) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const setNextValue = (next: string) => {
    onChange(next);
    if (isCompleteOtp(next)) onComplete(next);
  };

  const handleOtpChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (raw && !digit) return;
    const chars = value.split('');
    chars[index] = digit;
    const next = chars.join('').slice(0, 6);
    setNextValue(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      onChange(pasted);
      inputRefs.current[5]?.focus();
      onComplete(pasted);
    }
  };

  return (
    <div className="otp-row" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={el => {
            inputRefs.current[index] = el;
          }}
          className="otp-cell"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={e => handleOtpChange(index, e.target.value)}
          onKeyDown={e => handleKeyDown(index, e)}
          disabled={disabled}
          aria-label={`${ariaLabelPrefix} ${index + 1}번째 자리`}
        />
      ))}
    </div>
  );
};

export default OtpCodeInput;
