'use client';

/* 챕터 3 대표 흐름 — 읽던 웹페이지 위에 Quick Subnota를 띄워 현재 페이지를
   저장하는 장면이다. 수집·요약 과정은 정적인 UI로 보여 주고, 입력 패널이
   등장했다 사라지는 애니메이션은 작업 흐름 챕터에만 둔다. */

import { MiniComposer } from '../../subnota-ui/Mini';
import { Safari } from '../../subnota-ui/Safari';
import { useText } from '../../lib/i18n';
import { ARROW_UP, HandNote } from '../annotations';
import { SceneShowcase } from '../Scene';

function SubnotaPagePreview() {
  const text = useText();

  return (
    <Safari aria-hidden="true" height={940} url="subnota.com" width={1500}>
      <div className="safari-page-content">
        <span className="safari-page-content__eyebrow">SUBNOTA</span>
        <h3>
          {text('적기만 하세요.', 'Just write.')}
          <br />
          {text('나머지는 ', '')}<span className="wordmark-text">Subnota</span>{text('가 합니다', ' takes care of the rest')}
        </h3>
        <div className="safari-page-content__rule" />
        <div className="safari-page-content__lines">
          <span />
          <span />
          <span />
        </div>
      </div>
    </Safari>
  );
}

export default function ReuseInboxScene() {
  const text = useText();

  return (
    <div className="reuse-browser-scene">
      <SceneShowcase
        label={text('Subnota 웹페이지 위에 Quick Subnota가 열리고 현재 페이지 저장 버튼을 보여 주는 화면', 'Quick Subnota opens over a Subnota webpage and shows the save current page action')}
        tint="amber"
      >
        <SubnotaPagePreview />
        <div className="scene-float scene-float-capture">
          <MiniComposer text="" />
          <svg
            aria-hidden="true"
            className="capture-save-ring"
            fill="none"
            viewBox="0 0 124 52"
          >
            <path d="M13 28C11 17 23 9 43 7c22-3 60-1 70 7 8 7 6 23-4 29-21 6-77 5-93-3-4-3-5-8-3-12Z" stroke="#c9962f" strokeLinecap="round" strokeWidth="2.6" />
            <path d="M16 29c-1-10 9-16 27-19 25-3 57-1 66 6 6 6 5 19-3 23-20 6-72 5-86-1" opacity="0.48" stroke="#a96e14" strokeLinecap="round" strokeWidth="1.7" />
          </svg>
        </div>
        <HandNote
          arrow={ARROW_UP}
          arrowId="reuse-save-note"
          style={{ left: 200, top: 238, zIndex: 50 }}
          text={text('꽤나 간단하네요!', 'That was simple!')}
        />
      </SceneShowcase>
    </div>
  );
}
