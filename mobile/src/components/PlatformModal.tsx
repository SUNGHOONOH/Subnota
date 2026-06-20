import React from 'react';
import {
  Modal,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

interface PlatformModalProps {
  animationType?: 'none' | 'slide' | 'fade';
  children: React.ReactNode;
  onRequestClose?: () => void;
  style?: StyleProp<ViewStyle>;
  transparent?: boolean;
  visible: boolean;
}

const PlatformModal = ({
  animationType,
  children,
  onRequestClose,
  style,
  transparent,
  visible,
}: PlatformModalProps) => {
  if (!visible) {
    return null;
  }

  if (Platform.OS === 'macos') {
    return (
      <View style={[styles.macosOverlay, style]} pointerEvents="box-none">
        {children}
      </View>
    );
  }

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onRequestClose}
      transparent={transparent}
      visible={visible}
    >
      {children}
    </Modal>
  );
};

const styles = StyleSheet.create({
  macosOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 200,
  },
});

export default PlatformModal;
