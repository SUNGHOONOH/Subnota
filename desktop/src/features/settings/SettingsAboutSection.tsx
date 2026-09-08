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
  onCheckUpdates: () => Promise<string>;
  run: RunAction;
  translate: Translate;
}

const THIRD_PARTY_MODEL_URLS = {
  backendLicense: 'https://www.apache.org/licenses/LICENSE-2.0',
  backendModel:
    'https://huggingface.co/BAAI/bge-m3/tree/5617a9f61b028005a4858fdac845db406aefb181',
  desktopLicense: 'https://opensource.org/license/mit/',
  desktopModel:
    'https://huggingface.co/Xenova/bge-m3/tree/4de13258303883538bd53b696b452bf8099f0858',
} as const;

const SettingsAboutSection = ({
  onCheckUpdates,
  run,
  translate: t,
}: SettingsAboutSectionProps) => (
  <div className="settings-reference-sections">
    <Section title="Subnota">
      <Row
        action={
          <RowAction
            onClick={() =>
              void run(onCheckUpdates, message => message)
            }
          >
            {t('업데이트 확인', 'Check for updates')}
          </RowAction>
        }
        description={t('로컬 우선 메모 및 캘린더 워크스페이스', 'A local-first memo and calendar workspace')}
        label={`${t('버전', 'Version')} ${__APP_VERSION__}`}
      />
    </Section>
    <Section
      description={t('Subnota가 사용하는 임베딩 모델과 해당 라이선스입니다. 전체 고지는 저장소의 THIRD_PARTY_NOTICES.md에서 확인할 수 있습니다.', 'Embedding models used by Subnota and their licenses. See THIRD_PARTY_NOTICES.md for the complete notice.')}
      title={t('오픈소스 라이선스', 'Open-source licenses')}
    >
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
        description="BAAI/bge-m3 · Apache-2.0 · Hugging Face Inference · revision 5617a9f"
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
        description={t('Xenova/bge-m3 · MIT · 로컬 다운로드 · ONNX q8 · revision 4de1325', 'Xenova/bge-m3 · MIT · local download · ONNX q8 · revision 4de1325')}
        label={t('데스크톱 임베딩 모델', 'Desktop embedding model')}
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
