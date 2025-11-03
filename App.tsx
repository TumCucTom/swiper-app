import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Button, Alert, Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import { getPhotos } from '@react-native-camera-roll/camera-roll';

function App() {
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');

  useEffect(() => {
    checkPhotoPermission();
  }, []);

  const getPhotoPermission = (): Permission => {
    if (Platform.OS === 'ios') {
      return PERMISSIONS.IOS.PHOTO_LIBRARY;
    } else {
      // Android 13+ uses READ_MEDIA_IMAGES, older versions use READ_EXTERNAL_STORAGE
      if (Platform.Version >= 33) {
        return PERMISSIONS.ANDROID.READ_MEDIA_IMAGES;
      } else {
        return PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      }
    }
  };

  const checkPhotoPermission = async () => {
    try {
      const permission = getPhotoPermission();
      const result = await check(permission);
      setPermissionStatus(result);
    } catch (error) {
      console.error('Error checking permission:', error);
      setPermissionStatus('error');
    }
  };

  const requestPhotoPermission = async () => {
    try {
      const permission = getPhotoPermission();
      const result = await request(permission);
      
      setPermissionStatus(result);
      
      if (result === RESULTS.GRANTED) {
        Alert.alert('Success', 'Photo library access granted!');
        // Optionally fetch photos to verify access
        try {
          const photos = await getPhotos({ first: 5 });
          console.log('Photos accessible:', photos.edges.length);
        } catch (error) {
          console.error('Error fetching photos:', error);
        }
      } else if (result === RESULTS.DENIED) {
        Alert.alert('Permission Denied', 'Photo library access was denied. You can enable it in Settings.');
      } else if (result === RESULTS.BLOCKED) {
        Alert.alert(
          'Permission Blocked',
          'Photo library access is blocked. Please enable it in Settings > SwiperApp > Photos.'
        );
      } else if (result === RESULTS.LIMITED) {
        Alert.alert(
          'Limited Access',
          'You have granted limited access to your photo library.'
        );
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request photo library permission.');
    }
  };

  const getStatusText = () => {
    switch (permissionStatus) {
      case RESULTS.GRANTED:
        return 'Granted ✓';
      case RESULTS.DENIED:
        return 'Denied';
      case RESULTS.BLOCKED:
        return 'Blocked - Please enable in Settings';
      case RESULTS.LIMITED:
        return 'Limited Access';
      case RESULTS.UNAVAILABLE:
        return 'Unavailable';
      case 'checking':
        return 'Checking...';
      case 'error':
        return 'Error checking permission';
      default:
        return permissionStatus;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Photo Library Access</Text>
        <Text style={styles.status}>Status: {getStatusText()}</Text>
        
        <View style={styles.buttonContainer}>
          <Button
            title="Request Photo Access"
            onPress={requestPhotoPermission}
            disabled={permissionStatus === RESULTS.GRANTED || permissionStatus === 'checking'}
          />
        </View>

        {permissionStatus === RESULTS.BLOCKED && (
          <Text style={styles.hint}>
            Go to Settings → SwiperApp → Photos to enable access
          </Text>
        )}

        {permissionStatus === RESULTS.GRANTED && (
          <Text style={styles.hint}>
            You can now access and delete photos from the library
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 20,
    minWidth: 200,
  },
  hint: {
    marginTop: 20,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default App;
