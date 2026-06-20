import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import { Link2 } from 'lucide-react-native';

import { useMemoStore } from '../../../store/useMemoStore';

interface ToolbarButton {
  command: string;
  label?: string;
  textStyle?: TextStyle;
}

const HEADING_BUTTONS: ToolbarButton[] = [
  { command: 'h1', label: 'H1' },
  { command: 'h2', label: 'H2' },
  { command: 'h3', label: 'H3' },
];

const INLINE_BUTTONS: ToolbarButton[] = [
  { command: 'bold', label: 'B', textStyle: { fontWeight: '900' } },
  { command: 'italic', label: 'I', textStyle: { fontStyle: 'italic' } },
  {
    command: 'strike',
    label: 'S',
    textStyle: { textDecorationLine: 'line-through' },
  },
  { command: 'inlineCode', label: '</>' },
];

/**
 * Shared formatting toolbar for the macOS split workspace. Routes commands to
 * whichever pane editor currently has focus (registered as
 * activeMarkdownEditor) and reflects that editor's active marks.
 */
const MarkdownToolbar = () => {
  const applyCommand = useMemoStore(
    state => state.activeMarkdownEditor?.applyCommand,
  );
  const active = useMemoStore(state => state.markdownActiveCommands);

  const disabled = !applyCommand;

  const renderButton = ({ command, label, textStyle }: ToolbarButton) => {
    const isActive = Boolean(active[command]);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isActive }}
        disabled={disabled}
        focusable={false}
        key={command}
        // @ts-ignore — RNW on macOS supports this
        enableFocusRing={false}
        onPress={() => applyCommand?.(command)}
        style={({ pressed }) => [
          styles.button,
          isActive && styles.buttonActive,
          pressed && !disabled && styles.buttonPressed,
        ]}
      >
        {command === 'link' ? (
          <Link2 size={15} color={isActive ? '#B5453A' : '#5C4D3C'} />
        ) : (
          <Text
            style={[
              styles.buttonText,
              textStyle,
              isActive && styles.buttonTextActive,
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, disabled && styles.barDisabled]}>
      {HEADING_BUTTONS.map(renderButton)}
      <View style={styles.divider} />
      {INLINE_BUTTONS.map(renderButton)}
      <View style={styles.divider} />
      {renderButton({ command: 'link' })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: '#F6F4EF',
    borderBottomColor: '#DCD7CF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  barDisabled: {
    opacity: 0.5,
  },
  button: {
    alignItems: 'center',
    borderRadius: 6,
    justifyContent: 'center',
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  buttonActive: {
    backgroundColor: '#F2D9D0',
  },
  buttonPressed: {
    backgroundColor: '#E5E0D6',
  },
  buttonText: {
    color: '#3C342B',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonTextActive: {
    color: '#B5453A',
  },
  divider: {
    backgroundColor: '#DCD7CF',
    height: 16,
    marginHorizontal: 6,
    width: StyleSheet.hairlineWidth,
  },
});

export default MarkdownToolbar;
