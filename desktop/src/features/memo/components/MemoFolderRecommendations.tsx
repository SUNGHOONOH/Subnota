import type { UiLanguage } from '../../../lib/appSettings';
import { localize } from '../../../lib/uiLanguage';
import type { MemoRow } from '../../../types';
import type { FolderRecommendation } from '../folderOrganization';
import { getMemoTitle } from '../memoWorkspaceUtils';
import MemoFolderForm, { type MemoFolderFormValue } from './MemoFolderForm';

interface MemoFolderRecommendationsProps {
  folderRecommendations: FolderRecommendation[];
  language: UiLanguage;
  memos: MemoRow[];
  onCancel: () => void;
  onOpen: (topicId: string) => void;
  onSubmit: (
    recommendation: FolderRecommendation,
    value: MemoFolderFormValue,
  ) => void | Promise<void>;
  openTopicId: string | null;
}

const MemoFolderRecommendations = ({
  folderRecommendations,
  language,
  memos,
  onCancel,
  onOpen,
  onSubmit,
  openTopicId,
}: MemoFolderRecommendationsProps) => {
  const t = (korean: string, english: string) => localize(language, korean, english);

  if (folderRecommendations.length === 0) {
    return null;
  }

  return (
    <section className="memo-folder-recommendations">
      <h3>{t('폴더 제안', 'Folder suggestions')}</h3>
      {folderRecommendations.map(recommendation => {
        const isOpen = openTopicId === recommendation.topicId;
        const previewTitles = recommendation.memoIds
          .map(memoId => memos.find(memo => memo.id === memoId))
          .filter((memo): memo is MemoRow => Boolean(memo))
          .slice(0, 2)
          .map(memo => getMemoTitle(memo, language));

        return (
          <div className="memo-folder-recommendation" key={recommendation.topicId}>
            <button
              aria-expanded={isOpen}
              className="memo-folder-recommendation-row"
              onClick={() => (isOpen ? onCancel() : onOpen(recommendation.topicId))}
              type="button"
            >
              <span>{recommendation.name}</span>
              <em>
                {t(
                  `${recommendation.memoIds.length}개 메모`,
                  `${recommendation.memoIds.length} notes`,
                )}
              </em>
              {previewTitles.length > 0 && (
                <small>{previewTitles.join(' · ')}</small>
              )}
            </button>
            {isOpen && (
              <MemoFolderForm
                initialMode="automatic"
                initialName={recommendation.name}
                onCancel={onCancel}
                onSubmit={value => onSubmit(recommendation, value)}
                submitLabel={t('폴더 만들기', 'Create folder')}
                t={t}
              />
            )}
          </div>
        );
      })}
    </section>
  );
};

export default MemoFolderRecommendations;
