import { Group } from '@mantine/core';

import {
  Row,
  RowAction,
  Section,
} from './SettingsPrimitives';

type Translate = (korean: string, english: string) => string;

type RunAction = <T>(
  action: () => Promise<T>,
  success: string | ((result: T) => string | null),
) => Promise<void>;

interface SettingsAboutSectionProps {
  /** 이미 찾은 새 버전. 있으면 확인 대신 그 자리에서 업데이트한다. */
  availableUpdateVersion?: string | null;
  onCheckUpdates: () => Promise<string>;
  onStartUpdate?: () => void;
  run: RunAction;
  translate: Translate;
}

const SOURCE_URLS = {
  license: 'https://github.com/SUNGHOONOH/Subnota/blob/main/LICENSE',
  repository: 'https://github.com/SUNGHOONOH/Subnota',
} as const;

const THIRD_PARTY_MODEL_URLS = {
  backendLicense: 'https://opensource.org/license/mit/',
  backendModel:
    'https://huggingface.co/BAAI/bge-m3/tree/5617a9f61b028005a4858fdac845db406aefb181',
  desktopLicense: 'https://opensource.org/license/mit/',
  desktopModel: 'https://huggingface.co/Hoon03/subnota-bge-m3-koen-int8-onnx',
  topicModel: 'https://huggingface.co/Hoon03/subnota-ax-encoder-int8-onnx',
  topicLicense: 'https://www.apache.org/licenses/LICENSE-2.0',
} as const;

const SettingsAboutSection = ({
  availableUpdateVersion,
  onCheckUpdates,
  onStartUpdate,
  run,
  translate: t,
}: SettingsAboutSectionProps) => (
  <div className="settings-reference-sections">
    <Section title="Subnota">
      <Row
        action={
          availableUpdateVersion && onStartUpdate ? (
            <RowAction onClick={onStartUpdate}>
              {t(`${availableUpdateVersion}로 업데이트`, `Update to ${availableUpdateVersion}`)}
            </RowAction>
          ) : (
            <RowAction
              onClick={() =>
                void run(onCheckUpdates, message => message)
              }
            >
              {t('업데이트 확인', 'Check for updates')}
            </RowAction>
          )
        }
        description={t('로컬 우선 메모 및 캘린더 워크스페이스', 'A local-first memo and calendar workspace')}
        label={`${t('버전', 'Version')} ${__APP_VERSION__}`}
      />
    </Section>
    <Section
      description={t('Subnota와 Subnota가 사용하는 임베딩·주제어 모델의 라이선스입니다. 전체 고지는 저장소의 THIRD_PARTY_NOTICES.md에서 확인할 수 있습니다.', 'Licenses for Subnota and the embedding and topic-word models it uses. See THIRD_PARTY_NOTICES.md for the complete notice.')}
      title={t('오픈소스 라이선스', 'Open-source licenses')}
    >
      <Row
        action={
          <Group gap={12} wrap="nowrap">
            <RowAction onClick={() => void window.electronAPI?.openExternal(SOURCE_URLS.repository)}>
              {t('소스 코드', 'Source code')}
            </RowAction>
            <RowAction onClick={() => void window.electronAPI?.openExternal(SOURCE_URLS.license)}>
              {t('라이선스', 'License')}
            </RowAction>
          </Group>
        }
        description={t('AGPL-3.0 · 보증 없음 · 이 라이선스에 따라 수정·배포할 수 있습니다', 'AGPL-3.0 · no warranty · you may modify and distribute it under this license')}
        label="Subnota"
      />
      <Row
        action={
          <Group gap={12} wrap="nowrap">
            <RowAction
              onClick={() =>
                void window.electronAPI?.openExternal(
                  THIRD_PARTY_MODEL_URLS.backendModel,
                )
              }
            >
              {t('모델 카드', 'Model card')}
            </RowAction>
            <RowAction
              onClick={() =>
                void window.electronAPI?.openExternal(
                  THIRD_PARTY_MODEL_URLS.backendLicense,
                )
              }
            >
              {t('라이선스', 'License')}
            </RowAction>
          </Group>
        }
        description="BAAI/bge-m3 · MIT · Hugging Face Inference · revision 5617a9f"
        label={t('백엔드 임베딩 모델', 'Backend embedding model')}
      />
      <Row
        action={
          <Group gap={12} wrap="nowrap">
            <RowAction
              onClick={() =>
                void window.electronAPI?.openExternal(
                  THIRD_PARTY_MODEL_URLS.desktopModel,
                )
              }
            >
              {t('모델 카드', 'Model card')}
            </RowAction>
            <RowAction
              onClick={() =>
                void window.electronAPI?.openExternal(
                  THIRD_PARTY_MODEL_URLS.desktopLicense,
                )
              }
            >
              {t('라이선스', 'License')}
            </RowAction>
          </Group>
        }
        description={t('BAAI/bge-m3 · MIT · 한국어·영어 사전으로 줄인 비공식 ONNX int8 변환 · 기기 내 실행', 'BAAI/bge-m3 · MIT · unofficial ONNX int8 conversion with Korean and English vocabulary · on-device')}
        label={t('데스크톱 임베딩 모델', 'Desktop embedding model')}
      />
      <Row
        action={
          <Group gap={12} wrap="nowrap">
            <RowAction onClick={() => void window.electronAPI?.openExternal(THIRD_PARTY_MODEL_URLS.topicModel)}>
              {t('모델 카드', 'Model card')}
            </RowAction>
            <RowAction onClick={() => void window.electronAPI?.openExternal(THIRD_PARTY_MODEL_URLS.topicLicense)}>
              {t('라이선스', 'License')}
            </RowAction>
          </Group>
        }
        description={t('SKT A.X-Encoder-base · Apache-2.0 · 비공식 ONNX int8 변환 · 기기 내 실행', 'SKT A.X-Encoder-base · Apache-2.0 · unofficial ONNX int8 conversion · on-device')}
        label={t('데스크톱 주제어 모델', 'Desktop topic-word model')}
      />
    </Section>
    <Section title={t('약관 및 문의', 'Legal & contact')}>
      <Row
        action={
          <Group gap={12} wrap="nowrap">
            <RowAction
              onClick={() =>
                void window.electronAPI?.openExternal(
                  'https://subnota.com/privacy',
                )
              }
            >
              {t('개인정보 처리방침', 'Privacy policy')}
            </RowAction>
            <RowAction
              onClick={() =>
                void window.electronAPI?.openExternal(
                  'https://subnota.com/terms',
                )
              }
            >
              {t('이용약관', 'Terms of service')}
            </RowAction>
          </Group>
        }
        description={t('서비스 이용과 데이터 처리에 관한 안내입니다.', 'Information about using the service and how data is handled.')}
        label={t('법적 문서', 'Legal documents')}
      />
      <Row
        action={
          <RowAction
            onClick={() =>
              void window.electronAPI?.openExternal(
                'mailto:contact@subnota.com',
              )
            }
          >
            {t('이메일 보내기', 'Send email')}
          </RowAction>
        }
        description="contact@subnota.com"
        label={t('문의', 'Contact')}
      />
    </Section>
  </div>
);

export default SettingsAboutSection;
