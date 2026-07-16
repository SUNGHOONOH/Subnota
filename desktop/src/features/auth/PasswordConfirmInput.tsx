import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { desktopColorTokens } from '../../lib/colorTokens';

interface PasswordConfirmInputProps {
  passwordToMatch: string;
  value: string;
  onChange: (value: string) => void;
  showPassword?: boolean;
  placeholder?: string;
}

const GREEN = desktopColorTokens.success.feedback;
const RED = desktopColorTokens.danger.feedback;
const CORAL = desktopColorTokens.brand.primary;
const HAIRLINE = desktopColorTokens.surface.hairline;

// Confirm-password field, single box. The native input text is hidden and we
// render our own row of characters over it: each typed character is wrapped in
// a green (match) or red (mismatch) pill — masked as a dot, or shown as text
// when the password is visible. The box shakes if you type past a mismatch and
// turns coral on a full match.
const PasswordConfirmInput = ({
  passwordToMatch,
  value,
  onChange,
  showPassword = false,
  placeholder = '비밀번호를 한 번 더 입력',
}: PasswordConfirmInputProps) => {
  const [shake, setShake] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (value.length >= passwordToMatch.length && next.length > value.length) {
      setShake(true);
      return;
    }
    onChange(next);
  };

  useEffect(() => {
    if (!shake) return;
    const timer = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(timer);
  }, [shake]);

  const matches = passwordToMatch.length > 0 && passwordToMatch === value;

  return (
    <motion.div
      className="pw-confirm-inputbox"
      animate={{
        x: shake ? [-8, 8, -8, 8, 0] : 0,
        borderColor: matches ? CORAL : HAIRLINE,
      }}
      transition={{ duration: shake ? 0.5 : 0.3 }}
    >
      <input
        className="pw-confirm-input"
        type={showPassword ? 'text' : 'password'}
        placeholder={value.length === 0 ? placeholder : ''}
        value={value}
        onChange={handleChange}
        autoComplete="new-password"
      />
      {value.length > 0 && (
        <div className="pw-confirm-overlay" aria-hidden>
          {value.split('').map((char, index) => (
            <motion.span
              key={index}
              className="pw-confirm-char"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                backgroundColor: char === passwordToMatch[index] ? GREEN : RED,
              }}
              transition={{ duration: 0.18 }}
            >
              {showPassword ? char : <span className="pw-confirm-dot" />}
            </motion.span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default PasswordConfirmInput;
