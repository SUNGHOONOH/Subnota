import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus } from 'lucide-react-native';
import { parseDates, formatDisplayDate } from '../../utils/dateParser';
import { useMemoStore } from '../../stores/useMemoStore';

const MemoListScreen = () => {
  const [text, setText] = useState('');
  const [cancelledMatches, setCancelledMatches] = useState<number[]>([]);
  const { memos, addMemo } = useMemoStore();

  const allMatches = useMemo(() => parseDates(text), [text]);
  const activeMatches = useMemo(() => 
    allMatches.filter(m => !cancelledMatches.includes(m.index)), 
  [allMatches, cancelledMatches]);

  const handleCancelMatch = (index: number) => {
    setCancelledMatches([...cancelledMatches, index]);
  };

  const handleAddMemo = () => {
    if (text.trim()) {
      addMemo(text);
      setText('');
      setCancelledMatches([]);
    }
  };

  // Function to render text with highlights
  const renderHighlightedText = () => {
    if (activeMatches.length === 0) return <Text style={styles.inputText}>{text}</Text>;

    const elements = [];
    let lastIndex = 0;

    activeMatches.forEach(match => {
      // Plain text before match
      if (match.index > lastIndex) {
        elements.push(
          <Text key={`text-${lastIndex}`} style={styles.inputText}>
            {text.substring(lastIndex, match.index)}
          </Text>
        );
      }

      // Highlighted match
      elements.push(
        <View key={`match-container-${match.index}`} style={styles.highlightContainer}>
          <View style={styles.dateTooltip}>
            <Text style={styles.dateTooltipText}>{formatDisplayDate(match.date)}</Text>
            <TouchableOpacity onPress={() => handleCancelMatch(match.index)} style={styles.cancelButton}>
              <X size={10} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.inputText, styles.highlightedText]}>
            {match.text}
          </Text>
        </View>
      );

      lastIndex = match.index + match.length;
    });

    // Remaining plain text
    if (lastIndex < text.length) {
      elements.push(
        <Text key={`text-${lastIndex}`} style={styles.inputText}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return <View style={styles.highlightWrapper}>{elements}</View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>메모</Text>
      </View>

      <ScrollView style={styles.memoList}>
        {memos.map((memo) => (
          <View key={memo.id} style={styles.memoItem}>
            <Text style={styles.memoContent}>{memo.content}</Text>
            <Text style={styles.memoTime}>
              {new Date(memo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputArea}>
          <View style={styles.editorContainer}>
            {text.length > 0 && (
              <View style={styles.overlayContainer}>
                {renderHighlightedText()}
              </View>
            )}
            <TextInput
              style={[styles.input, text.length > 0 && styles.transparentInput]}
              placeholder="일정을 메모해보세요 (예: 내일 3시 회의)"
              value={text}
              onChangeText={(newText) => {
                setText(newText);
                // Reset cancelled matches if text changes significantly? 
                // Simple version: clear all on delete
                if (newText.length < text.length) setCancelledMatches([]);
              }}
              multiline
            />
          </View>
          <TouchableOpacity 
            style={[styles.addButton, !text.trim() && styles.addButtonDisabled]} 
            onPress={handleAddMemo}
            disabled={!text.trim()}
          >
            <Plus color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  memoList: {
    flex: 1,
    padding: 16,
  },
  memoItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  memoContent: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  memoTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'right',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  editorContainer: {
    flex: 1,
    minHeight: 45,
    maxHeight: 150,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: '#1C1C1E',
    padding: 0,
    zIndex: 2,
  },
  transparentInput: {
    color: 'transparent',
  },
  overlayContainer: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    bottom: 10,
    zIndex: 1,
  },
  highlightWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  inputText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  highlightContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  highlightedText: {
    color: '#007AFF',
    fontWeight: '600',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  dateTooltip: {
    position: 'absolute',
    top: -22,
    backgroundColor: '#007AFF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  dateTooltipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cancelButton: {
    marginLeft: 4,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginBottom: 2,
  },
  addButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
});

export default MemoListScreen;
