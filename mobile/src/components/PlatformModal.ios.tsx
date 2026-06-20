import React from 'react';
import { Modal } from 'react-native';

import { PlatformModalProps } from './PlatformModal.types';

const PlatformModal = ({
  animationType,
  children,
  onRequestClose,
  transparent,
  visible,
}: PlatformModalProps) => {
  if (!visible) {
    return null;
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

export default PlatformModal;
