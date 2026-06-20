import { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';

export interface TextHighlightPiece {
  highlighted: boolean;
  key: string;
  text: string;
}

export interface EditorFocusedDate {
  key: string;
  label: string;
  text: string;
}

export interface MemoEditorProps {
  hideToolbar?: boolean;
  highlightedPieces?: TextHighlightPiece[];
  inputAccessoryViewID?: string;
  onChangeText: (text: string) => void;
  onEditorFocus?: () => void;
  onFocusedDateChange?: (focusedDate: EditorFocusedDate | null) => void;
  onLayout?: (event: import('react-native').LayoutChangeEvent) => void;
  onScheduleSelection: () => void;
  onSelectedTextChange?: (text: string) => void;
  onSelectionChange: (start: number, end: number) => void;
  onAmbientIdle?: (chunk: string) => void;
  selectedText?: string;
  text: string;
}

export interface MemoEditorPlatformProps extends MemoEditorProps {
  autoScrollTo?: (cursorIndex: number) => void;
  onContentSizeChange?: (event: any) => void;
  onFocus?: () => void;
  onSelectionChangeNative?: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => void;
  pageHeight: number;
  pendingSelection?: { start: number; end: number };
}
