import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BrickBlockProps {
  note?: string;
  time?: string | null;
  title: string;
  tone: 'ink' | 'clay' | 'olive' | 'steel';
}

const TONE_COLOR = {
  ink: '#2F3437',
  clay: '#A75C4A',
  olive: '#66705A',
  steel: '#5D6A73',
};

const BrickBlock = ({ note, time, title, tone }: BrickBlockProps) => {
  return (
    <View style={[styles.shadowBrick, { backgroundColor: TONE_COLOR[tone] }]}>
      <View style={styles.topEdge} />
      {time ? (
        <View style={styles.titleRow}>
          <Text style={styles.timeLabel}>{time}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : (
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      )}
      {note ? (
        <Text style={styles.notePreview} numberOfLines={1}>
          {note}
        </Text>
      ) : (
        <Text style={styles.emptyNote}>메모 추가</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  shadowBrick: {
    borderRadius: 3,
    justifyContent: 'center',
    marginBottom: 7,
    minHeight: 54,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingTop: 8,
    paddingBottom: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
  },
  topEdge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  timeLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 15,
  },
  title: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  notePreview: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 13,
    marginTop: 4,
  },
  emptyNote: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 13,
    marginTop: 4,
  },
});

export default BrickBlock;
