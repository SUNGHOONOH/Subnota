import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CalendarDisplayBrick } from './DraggableBrick';

interface CalendarBrickEditorProps {
  brick: CalendarDisplayBrick | null;
  draftNote: string;
  onChangeNote: (note: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const CalendarBrickEditor = ({
  brick,
  draftNote,
  onChangeNote,
  onClose,
  onSave,
}: CalendarBrickEditorProps) => {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={Boolean(brick)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.editorPanel}>
          <Text style={styles.editorTitle}>{brick?.title}</Text>
          <TextInput
            autoFocus
            multiline
            onChangeText={onChangeNote}
            placeholder="이 벽돌 안에 들어갈 작은 메모"
            placeholderTextColor="#A8A8AD"
            style={styles.nestedMemoInput}
            textAlignVertical="top"
            value={draftNote}
          />
          <View style={styles.editorActions}>
            <Pressable onPress={onClose} style={styles.textAction}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pressable onPress={onSave} style={styles.saveNestedButton}>
              <Text style={styles.saveNestedText}>저장</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 31, 0.18)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  editorPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 18,
    width: '100%',
  },
  editorTitle: {
    color: '#1D1D1F',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
  },
  nestedMemoInput: {
    backgroundColor: '#FAFAF8',
    borderColor: '#E5E0D6',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#1D1D1F',
    fontSize: 16,
    lineHeight: 23,
    minHeight: 142,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  editorActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  textAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cancelText: {
    color: '#6E6E73',
    fontSize: 15,
    fontWeight: '600',
  },
  saveNestedButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: 4,
    marginLeft: 10,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  saveNestedText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CalendarBrickEditor;
