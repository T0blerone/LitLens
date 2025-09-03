import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Home: undefined;
  Details: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type Props = {
  navigation: HomeScreenNavigationProp;
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <Surface style={styles.container}>
      <Text variant="headlineLarge">Home Screen</Text>
      <Button
        mode="contained"
        onPress={() => navigation.navigate('Details')}
        style={styles.button}
      >
        Go to Details
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

export default HomeScreen;