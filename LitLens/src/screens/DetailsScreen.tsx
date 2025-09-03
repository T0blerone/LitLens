import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import apiService from '../services/api';

const DetailsScreen = () => {
  const handlePress = async () => {
    const response = await apiService.getSampleData();
    console.log('API Response:', response);
  };

  return (
    <Surface style={styles.container}>
      <Text variant="headlineLarge">Details Screen</Text>
      <Button mode="contained" onPress={handlePress} style={styles.button}>
        Call API
      </Button>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  button: {
    marginTop: 16,
  },
});

export default DetailsScreen;