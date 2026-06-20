import React from 'react';
import TiptapEditor from '../editor/TiptapEditor';
import { MemoEditorProps } from './MemoEditor.types';

// Default implementation for standard React Native targets
// Platform-specific resolution (.macos.tsx / .ios.tsx) takes precedence at build time.
const MemoEditor = (props: MemoEditorProps) => (
  <TiptapEditor {...props} />
);

export default MemoEditor;
