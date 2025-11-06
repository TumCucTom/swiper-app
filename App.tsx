import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Button,
  Alert,
  Platform,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  Linking,
  StatusBar,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const ROTATION_MULTIPLIER = 0.1;

function App() {
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Keep a ref to photoUris for use in panResponder callbacks
  const photoUrisRef = useRef<string[]>([]);
  useEffect(() => {
    photoUrisRef.current = photoUris;
  }, [photoUris]);

  // Animation values
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const greenOverlay = useRef(new Animated.Value(0)).current;
  const redOverlay = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        position.setOffset({
          x: (position.x as any)._value,
          y: (position.y as any)._value,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
        
        // Calculate rotation based on horizontal movement
        const rotation = gestureState.dx * ROTATION_MULTIPLIER;
        rotate.setValue(rotation);
        
        // Calculate opacity based on horizontal movement
        const absDx = Math.abs(gestureState.dx);
        const opacityValue = 1 - absDx / SCREEN_WIDTH;
        opacity.setValue(Math.max(0, opacityValue));
        
        // Set color overlays based on swipe direction
        if (gestureState.dx > 0) {
          // Swiping right - show green
          const greenValue = Math.min(0.5, absDx / SCREEN_WIDTH);
          greenOverlay.setValue(greenValue);
          redOverlay.setValue(0);
        } else if (gestureState.dx < 0) {
          // Swiping left - show red
          const redValue = Math.min(0.5, absDx / SCREEN_WIDTH);
          redOverlay.setValue(redValue);
          greenOverlay.setValue(0);
        } else {
          greenOverlay.setValue(0);
          redOverlay.setValue(0);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        position.flattenOffset();
        
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        
        // Check if swipe is significant enough
        if (absDx > SWIPE_THRESHOLD && absDx > absDy) {
          // Swipe successful - move to next photo
          const direction = gestureState.dx > 0 ? 1 : -1;
          const toX = direction * SCREEN_WIDTH * 1.5;
          
          // Change index immediately so the next card is already loaded
          const currentPhotoUris = photoUrisRef.current;
          if (currentPhotoUris.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % currentPhotoUris.length);
          }
          
          Animated.parallel([
            Animated.timing(position, {
              toValue: { x: toX, y: gestureState.dy },
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(rotate, {
              toValue: direction * 30,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(greenOverlay, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(redOverlay, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Reset animations after old card has animated out
            position.setValue({ x: 0, y: 0 });
            rotate.setValue(0);
            opacity.setValue(1);
            greenOverlay.setValue(0);
            redOverlay.setValue(0);
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
            Animated.spring(rotate, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
            Animated.spring(greenOverlay, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
            Animated.spring(redOverlay, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
          ]).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    checkPhotoPermission();
  }, []);

  useEffect(() => {
    if ((permissionStatus === RESULTS.GRANTED || permissionStatus === RESULTS.LIMITED) && photoUris.length === 0) {
      loadPhotos();
    }
  }, [permissionStatus]);

  const getPhotoPermission = (): Permission => {
    if (Platform.OS === 'ios') {
      return PERMISSIONS.IOS.PHOTO_LIBRARY;
    } else {
      if (Number(Platform.Version) >= 33) {
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
        // Will load automatically
      } else if (result === RESULTS.DENIED) {
        Alert.alert('Permission Denied', 'Photo library access was denied. You can enable it in Settings.');
      } else if (result === RESULTS.BLOCKED) {
        Alert.alert(
          'Permission Blocked',
          'Photo library access is blocked. Please enable it in Settings > SwiperApp > Photos.'
        );
      } else if (result === RESULTS.LIMITED) {
        Alert.alert('Limited Access', 'You have granted limited access to your photo library.');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request photo library permission.');
    }
  };

  const loadPhotos = async () => {
    setIsLoading(true);
    try {
      const result = await CameraRoll.getPhotos({
        first: 1000,
        assetType: 'Photos',
        include: ['filename', 'fileSize', 'imageSize', 'location', 'playableDuration'],
      });

      const edges = result?.edges ?? [];
      const totalEdges = edges.length;

      const urisRaw = edges
        .filter((edge) => {
          const t = (edge as any)?.node?.type;
          return typeof t === 'string' ? t.startsWith('image') || t === 'image' : true;
        })
        .map((edge) => (edge as any)?.node?.image?.uri || (edge as any)?.node?.image?.filepath)
        .filter((u): u is string => !!u);

      const uniqueUris = Array.from(new Set(urisRaw));

      console.log(`CameraRoll edges: ${totalEdges}, image URIs: ${urisRaw.length}, unique: ${uniqueUris.length}`);

      if (uniqueUris.length === 0) {
        Alert.alert('No Photos', 'No photos found in your photo library.');
        setPhotoUris([]);
        setCurrentIndex(0);
      } else {
        setPhotoUris(uniqueUris);
        setCurrentIndex(0);
        if (uniqueUris.length === 1) {
          const message =
            Platform.OS === 'ios' && permissionStatus === RESULTS.LIMITED
              ? 'Only 1 photo is accessible due to Limited Photos permission. Add more photos to the allowed list in Settings.'
              : 'Only 1 unique photo was found.';
          Alert.alert('Only One Photo', message, [
            Platform.OS === 'ios'
              ? { text: 'Open Settings', onPress: () => Linking.openSettings?.() }
              : { text: 'OK' },
          ]);
        }
      }
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('Error', 'Failed to load photos from your library.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentUri = useMemo(() => {
    if (photoUris.length === 0) return undefined;
    return photoUris[currentIndex % photoUris.length];
  }, [photoUris, currentIndex]);

  if (
    permissionStatus !== RESULTS.GRANTED &&
    permissionStatus !== RESULTS.LIMITED &&
    permissionStatus !== 'checking'
  ) {
    return (
      <View style={styles.containerLight}>
        <StatusBar hidden={true} />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Photo Access Required</Text>
          <Text style={styles.permissionText}>
            SwiperApp needs access to your photo library to display photos.
          </Text>
          <View style={styles.buttonContainer}>
            <Button
              title="Grant Photo Access"
              onPress={requestPhotoPermission}
              disabled={permissionStatus === 'checking'}
            />
          </View>
          {permissionStatus === RESULTS.BLOCKED && (
            <Text style={styles.hint}>
              Go to Settings → SwiperApp → Photos to enable access
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.containerDark}>
        <StatusBar hidden={true} />
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      </View>
    );
  }

  if (currentUri) {
    const rotateInterpolate = rotate.interpolate({
      inputRange: [-100, 0, 100],
      outputRange: ['-10deg', '0deg', '10deg'],
    });

    const animatedCardStyle = {
      transform: [
        { translateX: position.x },
        { translateY: position.y },
        { rotate: rotateInterpolate },
      ],
      opacity: opacity,
    };

    return (
      <View style={styles.containerDark}>
        <StatusBar hidden={true} />
        {/* Top card (swipeable) */}
        <Animated.View
          style={[styles.card, animatedCardStyle]}
          {...panResponder.panHandlers}
        >
          <Image 
            key={`current-${currentIndex}-${currentUri}`} 
            source={{ uri: currentUri as string }} 
            style={styles.photo} 
            resizeMode="contain" 
          />
          {/* Green overlay for right swipe */}
          <Animated.View
            style={[
              styles.colorOverlay,
              styles.greenOverlay,
              { opacity: greenOverlay },
            ]}
            pointerEvents="none"
          />
          {/* Red overlay for left swipe */}
          <Animated.View
            style={[
              styles.colorOverlay,
              styles.redOverlay,
              { opacity: redOverlay },
            ]}
            pointerEvents="none"
          />
        </Animated.View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>Swipe left or right to see next photo</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.containerDark}>
      <StatusBar hidden={true} />
      <View style={styles.centerContent}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  containerDark: {
    flex: 1,
    backgroundColor: '#000',
  },
  containerLight: {
    flex: 1,
    backgroundColor: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    color: '#666',
    paddingHorizontal: 20,
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cardBehind: {
    // No inset - edge to edge
  },
  photo: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  colorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  greenOverlay: {
    backgroundColor: 'rgba(0, 255, 0, 1)',
  },
  redOverlay: {
    backgroundColor: 'rgba(255, 0, 0, 1)',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  infoText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  counterText: {
    color: '#aaa',
    fontSize: 14,
  },
});

export default App;
