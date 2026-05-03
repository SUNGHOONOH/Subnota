import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BriefingScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>브리핑</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default BriefingScreen;
