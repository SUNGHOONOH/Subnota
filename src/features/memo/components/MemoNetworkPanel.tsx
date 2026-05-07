import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import MemoNetworkGraph from './MemoNetworkGraph';

interface MemoNetworkPanelProps {
  onClose: () => void;
  visible: boolean;
}

const MemoNetworkPanel = ({ onClose, visible }: MemoNetworkPanelProps) => {
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
              <Text style={styles.networkTitle}>네트워크</Text>
              <Text style={styles.networkSubtitle}>
                메모가 주제별 노드로 묶이는 초안
              </Text>
            </View>
            <Pressable
              accessibilityLabel="네트워크 닫기"
              onPress={onClose}
              style={styles.iconButton}
            >
              <X size={18} color="#1D1D1F" />
            </Pressable>
          </View>
          <MemoNetworkGraph />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  networkBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 31, 0.22)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  networkPanel: {
    backgroundColor: '#FAFAF8',
    borderRadius: 8,
    height: '82%',
    overflow: 'hidden',
    width: '100%',
  },
  networkHeader: {
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderBottomColor: '#E5E0D6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  networkTitle: {
    color: '#1D1D1F',
    fontSize: 22,
    fontWeight: '800',
  },
  networkSubtitle: {
    color: '#8A8A8E',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: '#E4E4E7',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});

export default MemoNetworkPanel;
