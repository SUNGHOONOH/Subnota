import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

interface AddBrickButtonProps {
  accessibilityLabel: string;
  compact?: boolean;
  onPress: () => void;
}

const AddBrickButton = ({
  accessibilityLabel,
  compact = false,
  onPress,
}: AddBrickButtonProps) => {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={compact ? styles.dayAddButton : styles.addBrickButton}
    >
      <Plus size={compact ? 13 : 17} color={compact ? '#6E6E73' : '#1D1D1F'} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  addBrickButton: {
    alignItems: 'center',
    borderColor: '#DEDAD0',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dayAddButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
});

export default AddBrickButton;
