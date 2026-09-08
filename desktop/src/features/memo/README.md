# Memo

## 역할

메모 편집, 탭·분할 화면, 메모 그래프와 관련된 화면 상태를 담당한다.

## 현재 경계

- `splitPaneState.ts`: App이 사용하는 분할 패널 ID와 현재 편집기 선택 규칙
- `useSplitPaneLifecycle.ts`: 분할 패널 변경·추가·닫기와 마지막 패널 복구
- `useSplitPaneEditorMovement.ts`: 분할 패널 내부 재정렬과 패널 간 편집기 이동
- `useSplitPaneResize.ts`: 두 pane 사이의 포인터 크기 조절과 폭 복원
- `useOpenNewTab.ts`: 새 view-picker 탭 생성과 대상 패널 포커스
- `useOpenMemoInFocusedSplitPane.ts`: 기존 메모를 현재 패널의 탭으로 열고 중복 탭을 포커스
- `useOpenDraftInFocusedSplitPane.ts`: 새 초안을 현재 패널에 열고 메모 작성 상태를 초기화
- `useRelativeTabFocus.ts`: 키보드 방향에 따른 상대 탭 선택과 메모 활성화
- `useCloseActiveTab.ts`: 현재 pane의 활성 탭 닫기와 다음 editor 선택
- `useMemoNavigation.ts`: 메모 rail의 신규 초안/기존 메모 탭 선택 조립
- `useEnsureMemoWorkspacePane.ts`: 메모 보기에서 비어 있는 split pane을 seed memo로 보장
- `useOpenViewAsTab.ts`: Calendar/Inbox/Topics 등 view 탭 열기와 중복 view 포커스
- `useMemoSelection.ts`: 활성 메모 선택, ID 탐색, 메모 변경 시 ambient 상태 초기화
- `useMemoContentPersistence.ts`: 편집 입력 병합, 로컬 우선 저장, memo save 상태와 Cloud sync 예약
- `useEnqueueMemoCloudSync.ts`: memo Cloud upsert, delete-wins, canonical 3-way merge와 실패 retry
- `useMemoCloudSyncActions.ts`: debounce 취소, 즉시 sync, 수동 실패 retry와 retry runner lifecycle
- `useMemoCloudRetryScheduler.ts`: 실패한 memo Cloud 업로드의 backoff timer, 현재 세션·최신 행 확인과 unmount cleanup
- `syncPendingMemoRows.ts`: 세션 재개 시 보류·삭제 대기 메모의 Cloud 재전송과 debounce 보호
- `useMemoEditorActions.ts`: 초안 ID 생성, ambient 상태 초기화, 새 메모 생성과 ID 기반 내용 갱신
- `useNearbyNotesSearch.ts`: 주변 메모 검색 요청·취소·빈 결과 처리·stale 응답 보호와 결과 반영
- `useDeleteMemo.ts`: 메모 optimistic 삭제, 로컬 tombstone, active memo 보정과 Cloud archive
- `memoCloudSync.ts`: 로컬 메모를 Cloud 동기화 요청 형태로 바꾸는 규칙
- `useMemoFolderMetadataActions.ts`: 폴더 생성·이름/설명·모드 변경의 local-first 동기화
- `useMemoFolderMembershipActions.ts`: 수동 폴더 이동과 자동 폴더 제외의 local-first 동기화
- `useCreateMemoFolderFromTopic.ts`: 명시적으로 승인한 Topic → 폴더 변환과 현재 Topic 멤버 복사·동기화
- `useDeleteMemoFolder.ts`: 폴더와 하위 membership/exclusion의 optimistic 삭제·tombstone·Cloud 동기화
- `syncPendingMemoFolders.ts`: 재연결·세션 활성화 때 보류 중인 폴더 변경을 순서대로 재전송
- `components/TopicsPane.tsx`: Topics 그래프·주제 영역 rail·Topic 폴더 생성 화면
- `components/TopicsCommunityRail.tsx`: 주제 영역 목록·접기·메모 열기·Topic 폴더 생성 UI
- `topicsGraphModel.ts`: Topics 메모/Inbox 노드와 edge의 순수 그래프 모델 계산
- `components/NearbyNotesPane.tsx`: 주변 메모 검색 결과의 로딩·빈 상태·오류·그래프 화면
- `components/SplitWorkspaceCommandBar.tsx`: 분할 작업 공간 상단의 사이드바 토글·전역 검색·문서 Undo/Redo 명령 바
- `components/MemoContextMenu.tsx`: 메모 고정·폴더 이동·삭제 컨텍스트 메뉴
- `components/MemoFolderActionsMenu.tsx`: 폴더별 새 메모·모드·편집·삭제 메뉴
- `components/MemoFolderRecommendations.tsx`: 추천 폴더 목록과 검토 폼의 controlled UI
- `components/MemoFolderSidebar.tsx`: 폴더 생성·추천·편집·접기와 폴더 메모 목록 표시
- `components/MemoTimeSidebar.tsx`: 시간순 섹션과 메모 행 표시, 메모 선택·컨텍스트 메뉴 이벤트 전달
- `components/SourcePaneBody.tsx`: 출처 없음·Inbox 상세·요약 fallback 본문 조립
- `components/RelatedSentenceCard.tsx`: 선택 문장 하이라이트 표시와 닫기 동작
- `components/MemoSplitPaneViewPicker.tsx`: 새 탭에서 열 보기 선택 UI와 공용 보기 아이콘 목록
- `components/MemoSplitSpecialView.tsx`: 메모 외 split view의 picker·calendar·inbox·topics·source 조립
- `components/MemoSplitPaneMenu.tsx`: 분할 패널 탭 닫기·보기 전환 드롭다운
- `components/MemoSplitPaneHeader.tsx`: 탭 목록·드래그·패널 명령과 탭 메뉴 조립
- `components/MemoSplitNoteMenu.tsx`: 노트 동기화 상태·고정·Markdown·복제·삭제 메뉴
- `components/MemoSplitScheduleOverlay.tsx`: 분할 메모의 날짜 선택 팝오버·일정 확인 포털 조립
- `memoWorkspaceUtils.ts`: 메모 제목/미리보기, 폴더 멤버십 행, 접힌 섹션 복원 규칙
- `memoSplitWorkspaceUtils.ts`: 탭 표시·에디터 상태 변환·미리보기 결과 어댑터의 순수 규칙
- `useMemoFolderMembershipActions.ts`: 수동 폴더 포함/제외 전환과 classifier 용어 갱신의 local-first 동기화
- `components/MemoSplitWorkspace.tsx`: 실제 분할 작업 공간 화면
- App: 패널 생성·닫기와 각 메모 action의 wiring

## 불변 조건

- 기존 단일 패널 저장 형식은 `editors` 배열이 없어도 그대로 열 수 있다.
- 활성 편집기 ID가 없거나 사라졌다면 첫 편집기를 사용한다.
- 새 패널 ID는 같은 순간의 여러 생성 요청에서도 충돌 가능성을 낮춘다.
- 동기화 입력은 메모의 마지막 콘텐츠 수정 시각과 정규화된 카테고리를 보존한다.
- 폴더 메타데이터는 화면 반영 후 로컬 저장, 기존 mutation queue Cloud 동기화 순서를 유지한다.
- 수동 이동은 기존 폴더와 중첩하지 않으며 Topic에서 만든 폴더만 예외적으로 중첩을 허용한다.
- Topic → 폴더 변환은 이미 같은 Topic에서 만든 폴더가 있으면 기존 폴더를 반환하며, 변환 시점의 Topic 멤버와 분류어를 고정한다.
- Topic → 폴더 변환은 화면 반영과 로컬 저장을 먼저 완료한 뒤 로그인 상태에서만 기존 폴더·membership 동기화 큐를 사용한다.
- 폴더 삭제는 화면과 로컬 하위 레코드를 먼저 정리하고, 삭제 tombstone을 남긴 뒤 로그인 상태에서만 Cloud 삭제를 시도한다.
- 보류 중인 폴더 동기화는 한 행의 실패가 다른 폴더·membership·exclusion·삭제 action을 막지 않도록 각 항목을 독립적으로 재시도한다.
- 폴더 포함/제외 전환은 기존 membership·folder mutation queue 순서를 유지한다.
- 편집 저장은 종료·삭제 중 입력을 무시하고, canonical 변경과 현재 입력을 3-way merge한 뒤 최신 revision만 save 상태와 Cloud 예약을 갱신한다.
- Cloud enqueue는 같은 메모의 요청 순서를 keyed chain으로 보존하고, push 시점의 sync base·최신 revision·현재 계정을 확인한 뒤 canonical 결과를 로컬에 원자적으로 적용한다.
- 보류 메모 재전송은 삭제 대기를 먼저 archive하고, 편집 debounce가 진행 중인 행은 stale snapshot을 밀지 않으며, 한 행의 실패를 다음 행으로 전파하지 않는다.
- 분할 패널 폭 조절은 두 pane의 합산 폭을 보존하고 최소 폭으로 clamp하며, pointerup·pointercancel·blur에서 동일한 cleanup과 최종 폭 callback을 수행한다.
- 즉시·수동 retry는 기존 debounce/chain을 정리하고 memo 상태가 `failed`인 현재 계정만 다시 enqueue하며, unmount 시 retry runner를 해제한다.
- Cloud retry scheduler는 메모별 timer를 하나만 유지하고 오프라인·세션 변경·최신 상태가 아닌 행은 재시도하지 않는다.
- 메모 삭제는 화면에서 먼저 제거하고 로컬 `pending_delete` tombstone을 기록한 뒤 Cloud archive를 시도하며, 로컬 실패 시 메모와 save 상태를 원복한다.
- 편집기 action은 저장 persistence를 한 경로로 사용하며, 첫 비어 있지 않은 입력에서만 ID를 만들고 입력 변경 때 ambient 결과를 초기화한다.
- 탭 라벨, 레거시 pane 변환, 미리보기 결과 매핑은 React 상태나 저장소를 직접 변경하지 않는다.

## 관련 테스트

- `src/__tests__/split-pane-state.test.ts`
- `src/__tests__/split-pane-tabs.test.ts`
- `src/__tests__/memo-split-workspace-utils.test.ts`
- `src/__tests__/folder-organization.test.ts`
- `src/__tests__/create-memo-folder-from-topic.test.ts`
- `src/__tests__/delete-memo-folder.test.ts`
- `src/__tests__/sync-pending-memo-folders.test.ts`
- `src/__tests__/memo-sync-merge.test.ts`
- `src/__tests__/memo-content-persistence.test.ts`
- `src/__tests__/memo-editor-actions.test.ts`
- `src/__tests__/sync-pending-memo-rows.test.ts`
- `src/__tests__/memo-cloud-sync-actions.test.ts`
- `src/__tests__/split-pane-resize.test.ts`
- `src/__tests__/memo-cloud-retry-scheduler.test.ts`
- `src/__tests__/delete-memo.test.ts`

## Windows 주의사항

이 파일은 화면 상태 계산만 담당하며 Electron 창이나 저장소 I/O를 호출하지 않는다.
