import React from 'react';
import TiptapEditor from '../editor/TiptapEditor';
import { MemoEditorProps } from './MemoEditor.types';

// ═══════════════════════════════════════════════════════════════════════════
// [LEGACY] 기존 plain TextInput 기반 에디터
// 롤백 시 아래 주석을 해제하고 TiptapEditor import/export를 제거하세요.
// ═══════════════════════════════════════════════════════════════════════════
//
// import { StyleSheet, TextInput } from 'react-native';
// import { useMemoStore } from '../../../store/useMemoStore';
// import { MemoEditorPlatformProps } from './MemoEditor.types';
// ... (기존 PlatformEditorIOS 코드 전체 — MemoEditor.ios.tsx.bak 참조)
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * iOS MemoEditor — Tiptap WebView 기반
 *
 * MemoEditorProps 인터페이스를 그대로 사용하므로
 * MemoScreen 등 상위 컴포넌트 수정 불필요.
 */
const MemoEditorIOS = (props: MemoEditorProps) => (
  <TiptapEditor {...props} />
);

export default MemoEditorIOS;
