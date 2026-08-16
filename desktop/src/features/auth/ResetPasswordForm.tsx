import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Eye, EyeOff, XCircle } from '@/components/icons';
import OtpCodeInput from './OtpCodeInput';
import PasswordConfirmInput from './PasswordConfirmInput';
import { passwordRequirementText, PASSWORD_REQUIREMENTS } from './authValidation';
import { UiLanguage } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';

interface ResetPasswordFormProps {
  email: string;
  language: UiLanguage;
  onVerifyCode: (code: string) => Promise<boolean>;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}

const ResetPasswordForm = ({ email, language, onVerifyCode, onSubmit, onCancel }: ResetPasswordFormProps) => {
  const t = (korean: string, english: string) => localize(language, korean, english);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isCodeVerified, setCodeVerified] = useState(false);
  const [isVerifying, setVerifying] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyingRef = useRef(false);

  const requirements = useMemo(
    () => PASSWORD_REQUIREMENTS.map(req => ({ text: passwordRequirementText(req.key, language), met: req.test(password) })),
    [language, password],
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
        setError(t('코드가 올바르지 않습니다. 다시 시도해 주세요.', 'That code is invalid. Try again.'));
        setOtp('');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('코드 확인에 실패했습니다.', 'Could not verify the code.'));
      setOtp('');
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
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
      setError(caught instanceof Error ? caught.message : t('비밀번호 변경에 실패했습니다.', 'Could not change the password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="reset-form" onSubmit={handleSubmit}>
      <h2 className="reset-title">{t('비밀번호 재설정', 'Reset password')}</h2>
      <p className="reset-subtitle">
        {language === 'en' ? (
          <>Enter the 6-digit code sent to <span className="reset-email">{email}</span>.</>
        ) : (
          <><span className="reset-email">{email}</span> 로 보낸 6자리 코드를 입력하세요.</>
        )}
      </p>

      <OtpCodeInput
        value={otp}
        onChange={setOtp}
        onComplete={verify}
        disabled={isCodeVerified || isVerifying}
      />

      {isVerifying && <p className="reset-hint">{t('확인 중...', 'Verifying…')}</p>}
      {error && <p className="form-error-msg">{error}</p>}
      {isCodeVerified && (
        <motion.div className="reset-verified" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <CheckCircle2 size={16} />
          {t('코드가 확인되었습니다', 'Code verified')}
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
              <label className="reset-label">{t('새 비밀번호', 'New password')}</label>
              <div className="password-input-wrap">
                <input
                  className="reset-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('새 비밀번호', 'New password')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? t('비밀번호 숨기기', 'Hide password') : t('비밀번호 표시', 'Show password')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <PasswordConfirmInput
                passwordToMatch={password}
                placeholder={t('비밀번호를 한 번 더 입력', 'Re-enter your password')}
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
          {t('취소', 'Cancel')}
        </button>
        <button
          type="submit"
          className="reset-submit"
          disabled={!isCodeVerified || !allMet || !passwordsMatch || isSubmitting}
        >
          {isSubmitting ? t('변경 중...', 'Updating…') : t('비밀번호 변경', 'Change password')}
        </button>
      </div>
    </form>
  );
};

export default ResetPasswordForm;
