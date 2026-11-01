import React from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';

interface OfflineMessageProps {
  onRetry: () => void;
  isRetrying: boolean;
}

const OfflineMessage: React.FC<OfflineMessageProps> = ({ onRetry, isRetrying }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>You are currently offline.</Text>
      <Text style={styles.subText}>Please check your internet connection.</Text>
      {isRetrying ? (
         <ActivityIndicator size="large" color="#007AFF" style={styles.spacer} />
      ) : (
        <Button title="Retry Connection" onPress={onRetry} disabled={isRetrying} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
   spacer: {
    marginTop: 20,
  },
});

export default OfflineMessage;