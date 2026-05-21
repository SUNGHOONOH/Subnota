import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { MemoChunk } from '../../../lib/memoChunker';
import { NetworkSearchResult } from '../../../services/backend/networkService';
import LocalKnnGraph from './LocalKnnGraph';

interface MemoNetworkPanelProps {
  errorMessage?: string | null;
  isLoading: boolean;
  onClose: () => void;
  onNavigateToMemo: (memoId: string) => void;
  queryChunk: MemoChunk | null;
  results: NetworkSearchResult[];
  visible: boolean;
}

const MemoNetworkPanel = ({
  errorMessage,
  isLoading,
  onClose,
  onNavigateToMemo,
  queryChunk,
  results,
  visible,
}: MemoNetworkPanelProps) => {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.networkBackdrop}>
        <View style={styles.networkPanel}>
          <View style={styles.networkHeader}>
            <View>
              <Text style={styles.networkTitle}>🕸️ 네트워크</Text>
              <Text style={styles.networkSubtitle}>커서 문장 기준으로 탐색합니다</Text>
            </View>
            <Pressable
              accessibilityLabel="네트워크 닫기"
              onPress={onClose}
              style={styles.iconButton}
            >
              <X size={18} color="#5C4D3C" />
            </Pressable>
          </View>
          <LocalKnnGraph
            errorMessage={errorMessage}
            isLoading={isLoading}
            onNavigateToMemo={onNavigateToMemo}
            queryChunk={queryChunk}
            results={results}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  networkBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(44, 37, 32, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  networkPanel: {
    backgroundColor: '#FAF6F0',
    borderColor: '#E5DDD0',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: '78%',
    overflow: 'hidden',
    shadowColor: '#5C4D3C',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    width: '100%',
  },
  networkHeader: {
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    borderBottomColor: '#E5DDD0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  networkTitle: {
    color: '#2C2520',
    fontSize: 20,
    fontWeight: '800',
  },
  networkSubtitle: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: '#E5DDD0',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});

export default MemoNetworkPanel;
