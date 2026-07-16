import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from '@/components/icons';
import OtpCodeInput from './OtpCodeInput';

interface SignupOtpFormProps {
  email: string;
  onVerifyCode: (code: string) => Promise<boolean>;
  onResendCode: () => Promise<void>;
  onCancel: () => void;
}

const SignupOtpForm = ({ email, onVerifyCode, onResendCode, onCancel }: SignupOtpFormProps) => {
  const [otp, setOtp] = useState('');
  const [isCodeVerified, setCodeVerified] = useState(false);
  const [isVerifying, setVerifying] = useState(false);
  const [isResending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  const verify = async (code: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      const ok = await onVerifyCode(code);
      if (ok) {
        setCodeVerified(true);
        setNotice('이메일 인증이 완료되었습니다.');
      } else {
        setError('코드가 올바르지 않습니다. 다시 시도해 주세요.');
        setOtp('');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '코드 확인에 실패했습니다.');
      setOtp('');
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await onResendCode();
      setOtp('');
      setNotice('인증 코드를 다시 보냈습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '인증 코드를 다시 보내지 못했습니다.');
    } finally {
      setResending(false);
    }
  };

  return (
    <form className="reset-form">
      <h2 className="reset-title">이메일 인증</h2>
      <p className="reset-subtitle">
        <span className="reset-email">{email}</span> 로 보낸 6자리 코드를 입력하세요.
      </p>

      <OtpCodeInput
        value={otp}
        onChange={setOtp}
        onComplete={verify}
        disabled={isCodeVerified || isVerifying}
      />

      {isVerifying && <p className="reset-hint">확인 중...</p>}
      {error && <p className="form-error-msg">{error}</p>}
      {notice && <p className="form-notice-msg">{notice}</p>}
      {isCodeVerified && (
        <motion.div className="reset-verified" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <CheckCircle2 size={16} />
          코드가 확인되었습니다
        </motion.div>
      )}

      <div className="reset-actions">
        <button
          type="button"
          className="reset-cancel"
          onClick={onCancel}
          disabled={isVerifying || isResending}
        >
          로그인으로 돌아가기
        </button>
        <button
          type="button"
          className="reset-submit"
          onClick={resend}
          disabled={isCodeVerified || isVerifying || isResending}
        >
          {isResending ? '재전송 중...' : '코드 다시 보내기'}
        </button>
      </div>
    </form>
  );
};

export default SignupOtpForm;
