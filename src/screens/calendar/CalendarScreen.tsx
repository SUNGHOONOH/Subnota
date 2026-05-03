import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as CalendarIcon, Clock, ChevronRight } from 'lucide-react-native';

const MOCK_BLOCKS = [
  { id: '1', title: '오늘 3시 회의', time: '15:00', date: '2026.05.02', color: '#007AFF' },
  { id: '2', title: '내일 운동', time: '09:00', date: '2026.05.03', color: '#34C759' },
  { id: '3', title: '3.6 프로젝트 마감', time: '18:00', date: '2026.03.06', color: '#FF9500' },
];

const CalendarScreen = () => {
  const renderItem = ({ item }: { item: typeof MOCK_BLOCKS[0] }) => (
    <TouchableOpacity style={styles.blockItem}>
      <View style={[styles.colorBar, { backgroundColor: item.color }]} />
      <View style={styles.blockInfo}>
        <Text style={styles.blockTitle}>{item.title}</Text>
        <View style={styles.timeRow}>
          <Clock size={14} color="#8E8E93" />
          <Text style={styles.blockTime}>{item.time}</Text>
          <Text style={styles.blockDate}>{item.date}</Text>
        </View>
      </View>
      <ChevronRight size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>캘린더</Text>
      </View>
      
      <View style={styles.calendarPlaceholder}>
        <CalendarIcon size={48} color="#C7C7CC" />
        <Text style={styles.placeholderText}>블럭형 달력 뷰가 여기에 위치합니다</Text>
        <Text style={styles.subPlaceholderText}>(react-native-calendars 연동 예정)</Text>
      </View>

      <View style={styles.blockListHeader}>
        <Text style={styles.sectionTitle}>예정된 일정 블럭</Text>
      </View>

      <FlatList
        data={MOCK_BLOCKS}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
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
  calendarPlaceholder: {
    height: 200,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  subPlaceholderText: {
    fontSize: 12,
    color: '#AEAEB2',
    marginTop: 4,
  },
  blockListHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  blockItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  colorBar: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  blockInfo: {
    flex: 1,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 4,
  },
  blockDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 8,
  },
});

export default CalendarScreen;
