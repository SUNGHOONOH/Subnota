import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PlatformModal from '../../../components/PlatformModal';
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
    <PlatformModal
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
            // @ts-ignore
            enableFocusRing={false}
            multiline
            onChangeText={onChangeNote}
            placeholder="기록할 내용"
            placeholderTextColor="#B5A898"
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
    </PlatformModal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(44, 37, 32, 0.15)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  editorPanel: {
    backgroundColor: '#FAF6F0',
    borderRadius: 7,
    padding: 18,
    width: '100%',
    maxWidth: Platform.OS === 'macos' ? 480 : undefined,
  },
  editorTitle: {
    color: '#2C2520',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
  },
  nestedMemoInput: {
    backgroundColor: '#F5EFE5',
    borderColor: '#E5DDD0',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#2C2520',
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
    color: '#9C8E7C',
    fontSize: 15,
    fontWeight: '600',
  },
  saveNestedButton: {
    backgroundColor: '#5C4D3C',
    borderRadius: 4,
    marginLeft: 10,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  saveNestedText: {
    color: '#FAF6F0',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CalendarBrickEditor;
