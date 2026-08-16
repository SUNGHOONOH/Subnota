import type { Metadata } from 'next';
import LegalDocument from '../components/LegalDocument';

export const metadata: Metadata = {
  title: '계정 삭제 | Subnota',
  description: 'Subnota 계정과 데이터 삭제 방법입니다.',
};

export default function AccountDeletionPage() {
  return (
    <LegalDocument effectiveDate="2026년 8월 13일" title="계정 및 데이터 삭제">
      <p>
        Subnota 계정과 계정에 연결된 서버 데이터 및 기기 내 로컬 데이터를 삭제할
        수 있습니다. 삭제가 완료되면 계정과 콘텐츠를 복구할 수 없습니다.
      </p>

      <h2>앱에서 삭제하기</h2>
      <ol>
        <li>
          <strong>데스크톱 앱</strong>: 설정 → 계정 → 계정 및 데이터 삭제를 선택합니다.
        </li>
        <li>
          <strong>모바일 앱</strong>: 노트 화면의 옵션 메뉴 → 계정 및 데이터 삭제를 선택합니다.
        </li>
        <li>확인 대화상자에서 삭제를 확정하면 인증 계정과 서버·기기 데이터가 삭제됩니다.</li>
      </ol>

      <h2>앱을 사용할 수 없는 경우</h2>
      <p>
        로그인에 사용한 이메일 주소로{' '}
        <a
          href="mailto:contact@subnota.com?subject=Subnota%20%EA%B3%84%EC%A0%95%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD"
        >
          contact@subnota.com
        </a>
        에 계정 삭제를 요청해 주세요. 요청에는 로그인 이메일을 적어 주세요. 본인
        확인이 필요한 경우 추가 확인을 요청할 수 있습니다.
      </p>

      <h2>삭제되는 데이터</h2>
      <ul>
        <li>Supabase 인증 계정과 계정 프로필</li>
        <li>서버에 동기화된 메모, 일정, 수집함, 브리핑, 검색·토픽·임베딩 결과</li>
        <li>앱이 기기에 저장한 계정별 로컬 콘텐츠와 로컬 임베딩</li>
      </ul>
      <p>
        법령상 보관이 필요한 자료, 보안 로그, 백업 또는 외부 처리 서비스의 잔여
        로그는 관련 보관 기간과 제공자 정책에 따라 즉시 삭제되지 않을 수 있습니다.
        자세한 내용은 <a href="/privacy">개인정보 처리방침</a>을 확인해 주세요.
      </p>
    </LegalDocument>
  );
}
