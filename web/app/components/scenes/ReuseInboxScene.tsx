'use client';

/* 챕터 3 대표 흐름 — 읽던 웹페이지 위에 Quick Subnota를 띄워 현재 페이지를
   저장하는 장면이다. 수집·요약 과정은 정적인 UI로 보여 주고, 입력 패널이
   등장했다 사라지는 애니메이션은 작업 흐름 챕터에만 둔다. */

import { MiniComposer } from '../../subnota-ui/Mini';
import { Safari } from '../../subnota-ui/Safari';
import { ARROW_UP, HandNote } from '../annotations';
import { SceneShowcase } from '../Scene';

function SubnotaPagePreview() {
  return (
    <Safari aria-hidden="true" height={940} url="subnota.com" width={1500}>
      <div className="safari-page-content">
        <span className="safari-page-content__eyebrow">SUBNOTA</span>
        <h3>
          적어 두기만 하세요.
          <br />
          정리와 연결은 Subnota가 합니다
        </h3>
        <p>메모 속 날짜는 캘린더로, 관련된 생각은 옆으로 돌아옵니다.</p>
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
  return (
    <div className="reuse-browser-scene">
      <SceneShowcase
        label="Subnota 웹페이지 위에 Quick Subnota가 열리고 현재 페이지 저장 버튼을 보여 주는 화면"
        tint="amber"
      >
        <SubnotaPagePreview />
        <div className="scene-float scene-float-capture">
          <MiniComposer text="" />
        </div>
        <HandNote
          arrow={ARROW_UP}
          arrowId="reuse-save-note"
          style={{ left: 200, top: 238, zIndex: 50 }}
          text="꽤나 간단하네요!"
        />
      </SceneShowcase>
    </div>
  );
}
