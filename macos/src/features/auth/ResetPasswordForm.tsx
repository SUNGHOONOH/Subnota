import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Eye, EyeOff, XCircle } from '@/components/icons';
import PasswordConfirmInput from './PasswordConfirmInput';
import {
  isCompleteRecoveryOtp,
  PASSWORD_REQUIREMENTS,
} from './authValidation';

interface ResetPasswordFormProps {
  email: string;
  onVerifyCode: (code: string) => Promise<boolean>;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}

const ResetPasswordForm = ({ email, onVerifyCode, onSubmit, onCancel }: ResetPasswordFormProps) => {
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isCodeVerified, setCodeVerified] = useState(false);
  const [isVerifying, setVerifying] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyingRef = useRef(false);

  const requirements = useMemo(
    () => PASSWORD_REQUIREMENTS.map(req => ({ text: req.text, met: req.test(password) })),
    [password],
  );
  const allMet = requirements.every(req => req.met);
  const passwordsMatch = password.length > 0 && password === passwordConfirmation;

  const verify = async (code: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError(null);
    try {
      const ok = await onVerifyCode(code);
      if (ok) {
        setCodeVerified(true);
      } else {
        setError('코드가 올바르지 않습니다. 다시 시도해 주세요.');
        setOtp('');
        inputRefs.current[0]?.focus();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '코드 확인에 실패했습니다.');
      setOtp('');
      inputRefs.current[0]?.focus();
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const handleOtpChange = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, '').slice(-1);
    if (raw && !value) return;
    const chars = otp.split('');
    chars[index] = value;
    const next = chars.join('').slice(0, 6);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (isCompleteRecoveryOtp(next)) void verify(next);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted);
      inputRefs.current[5]?.focus();
      void verify(pasted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet || !passwordsMatch) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="reset-form" onSubmit={handleSubmit}>
      <h2 className="reset-title">비밀번호 재설정</h2>
      <p className="reset-subtitle">
        <span className="reset-email">{email}</span> 로 보낸 6자리 코드를 입력하세요.
      </p>

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
            value={otp[index] || ''}
            onChange={e => handleOtpChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
            disabled={isCodeVerified || isVerifying}
            aria-label={`인증 코드 ${index + 1}번째 자리`}
          />
        ))}
      </div>

      {isVerifying && <p className="reset-hint">확인 중...</p>}
      {error && <p className="form-error-msg">{error}</p>}
      {isCodeVerified && (
        <motion.div className="reset-verified" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <CheckCircle2 size={16} />
          코드가 확인되었습니다
        </motion.div>
      )}

      <AnimatePresence>
        {isCodeVerified && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="reset-new">
              <label className="reset-label">새 비밀번호</label>
              <div className="password-input-wrap">
                <input
                  className="reset-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="새 비밀번호"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <PasswordConfirmInput
                passwordToMatch={password}
                value={passwordConfirmation}
                onChange={setPasswordConfirmation}
                showPassword={showPassword}
              />

              <div className="reset-requirements">
                {requirements.map(req => (
                  <motion.div
                    key={req.text}
                    className={`reset-req ${req.met ? 'met' : ''}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {req.met ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {req.text}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="reset-actions">
        <button
          type="button"
          className="reset-cancel"
          onClick={onCancel}
          disabled={isVerifying || isSubmitting}
        >
          취소
        </button>
        <button
          type="submit"
          className="reset-submit"
          disabled={!isCodeVerified || !allMet || !passwordsMatch || isSubmitting}
        >
          {isSubmitting ? '변경 중...' : '비밀번호 변경'}
        </button>
      </div>
    </form>
  );
};

export default ResetPasswordForm;
