import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  StyleProp, // Import StyleProp
  ViewStyle, // Import ViewStyle
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';
import { authAPI } from '../../../services/index'; // Assuming this path is correct
import Animated, { // Import Animated from reanimated
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withSpring,
  Easing as ReanimatedEasing, // Alias Easing to avoid conflict if needed later
  FadeInUp, // Use built-in entering animations
  FadeOut,
  runOnJS,
  withDelay, // Needed for callbacks from animation worklets
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Define ParamList for type safety with navigation
type RootStackParamList = {
    Login: undefined;
    Game: undefined;
    Register: undefined; // Add other routes if needed
  };

interface AnimatedStarProps {
    index: number;
  }
  
  const AnimatedStar: React.FC<AnimatedStarProps> = ({ index }) => {
  const starOpacity = useSharedValue(0.2);
  const starScale = useSharedValue(1);
  const starLeft = `${5 + (index * 6)}%`;
  const starBottom = `${20 + Math.random() * 60}%`;
  const animDuration = 1500 + Math.random() * 2000;
  const animDelay = Math.random() * 2000;

  useEffect(() => {
    starOpacity.value = withDelay(animDelay, withRepeat(
      withSequence(
        withTiming(1, { duration: animDuration / 2 }),
        withTiming(0.2, { duration: animDuration / 2 })
      ),
      -1, // Repeat indefinitely
      true // Reverse animation
    ));

    starScale.value = withDelay(animDelay, withRepeat(
      withSequence(
        withTiming(1.5, { duration: animDuration / 2 }),
        withTiming(1, { duration: animDuration / 2 })
      ),
      -1, // Repeat indefinitely
      true // Reverse animation
    ));
  }, [starOpacity, starScale, animDuration, animDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: starOpacity.value,
    transform: [{ scale: starScale.value }],
  }));

  const starStyle: StyleProp<any> = { // Use StyleProp<ViewStyle>
    position: 'absolute',
    left: starLeft,
    bottom: starBottom,
    width: 2,
    height: 2,
    backgroundColor: '#f9d71c',
    borderRadius: 1, // Make it smaller for star-like appearance
  };

  return <Animated.View style={[starStyle, animatedStyle]} />;
};
// --- End Animated Star Component ---

interface User {
    id: string;
    username: string;
    isGuest?: boolean;
    email?: string;
  }
  
  // Define the props for the LoginScreen component
  interface LoginScreenProps {
    onLoginSuccess: (token: string, user: User) => void; // Function signature
  }

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>(); // Typed navigation
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle'); // More specific type

  // Reanimated Shared Values
  const formTranslateX = useSharedValue(0);
  const rememberMeCheckScale = useSharedValue(0);
  const rememberMeCheckOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  // Load remembered email
  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const rememberedEmail = await AsyncStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
          setEmail(rememberedEmail);
          setRememberMe(true); // Update state directly
        }
      } catch (loadError: any) { // Type the error
        console.error('Error loading remembered email:', loadError?.message || loadError);
      }
    };
    loadRememberedEmail();
  }, []);

  // Trigger animations based on state changes
  useEffect(() => {
    // Shake animation on error
    if (formState === 'error') {
      formTranslateX.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(0, { duration: 50 }, (finished) => {
          // Reset form state after animation only if it truly finished
          if (finished) {
             runOnJS(setFormState)('idle'); // Ensure state update runs on JS thread
          }
        })
      );
    } else {
        // Reset position if not erroring
        formTranslateX.value = withTiming(0, {duration: 200});
    }
  }, [formState, formTranslateX]);

  useEffect(() => {
    // Checkbox animation
    const targetValue = rememberMe ? 1 : 0;
    rememberMeCheckScale.value = withTiming(targetValue, { duration: 200, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) });
    rememberMeCheckOpacity.value = withTiming(targetValue, { duration: 200, easing: ReanimatedEasing.inOut(ReanimatedEasing.ease) });
  }, [rememberMe, rememberMeCheckScale, rememberMeCheckOpacity]);


  // Animated Styles
  const formAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: formTranslateX.value }],
  }));

  const rememberMeCheckAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rememberMeCheckOpacity.value,
    transform: [{ scale: rememberMeCheckScale.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));


  const handleLogin = async () => {
    setError('');
    if (!email) {
      setError('Email is required');
      setFormState('error');
      return;
    }
    if (!password) {
      setError('Password is required');
      setFormState('error');
      return;
    }

    setFormState('loading');

    try {
      const response = await authAPI.login(email, password);
      const { token, user } = response.data; // Assuming response structure

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      if (rememberMe) {
        await AsyncStorage.setItem('rememberedEmail', email);
      } else {
        await AsyncStorage.removeItem('rememberedEmail');
      }

      setFormState('success');

      setTimeout(() => {
         if (onLoginSuccess) onLoginSuccess(token, user);
         // Optionally reset form state here or let parent handle it
         // setFormState('idle');
      }, 800); // Delay for success animation visibility

    } catch (err: any) {
      console.error('Login error:', err.response?.data || err.message || err);
      setError(
        err.response?.data?.message ||
        'Login failed. Check credentials.' // Shorter message
      );
      setFormState('error'); // Error state will trigger shake and reset
    }
    // No finally block needed to set loading state, as 'success' or 'error' handles it
  };

  const handleGuestMode = async () => {
    setShowGuestWarning(false);
    setFormState('loading'); // Show loading state briefly

    try {
      const guestToken = 'guest_' + Math.random().toString(36).substring(2, 11); // Longer random part
      const guestUser = {
        id: 'guest_' + Math.random().toString(36).substring(2, 11),
        username: 'Guest Player',
        isGuest: true,
      };

      await AsyncStorage.setItem('token', guestToken);
      await AsyncStorage.setItem('user', JSON.stringify(guestUser));

      // Simulate a small delay if needed, then call success
      // setFormState('success'); // Can optionally show success state
      setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(guestToken, guestUser);
          setFormState('idle'); // Reset state after guest login completes
      }, 200); // Short delay

    } catch (err: any) {
      console.error('Guest login error:', err.message || err);
      setError('Failed to enter guest mode.');
      setFormState('error'); // Trigger error state
    }
  };

  // Button press animations
  const onPressInButton = () => {
    buttonScale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  };

  const onPressOutButton = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  // Memoize renderStars to avoid recreating components unnecessarily
  const renderStars = useCallback(() => {
    // Use a stable key source if possible, index is fine for static lists
    return Array.from({ length: 15 }).map((_, i) => <AnimatedStar index={i} />);
  }, []);

  // Define entering animations for elements
  const getEnteringAnimation = (delayMultiplier: number) =>
    FadeInUp.delay(200 + delayMultiplier * 100).duration(500).easing(ReanimatedEasing.out(ReanimatedEasing.ease));


  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b']} // slate-900 to slate-800
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100} // Adjust offset if needed
      >
        {/* Skyline Background */}
        <View style={styles.skylineContainer}>
          <Svg height="100%" width="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.svgBackground}>
            <SvgLinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#3b82f6" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#3b82f6" stopOpacity="0.3" />
            </SvgLinearGradient>
             <Polygon
              points="0,60 5,50 10,55 15,40 20,45 25,30 30,40 35,25 40,40 45,20 50,25 55,15 60,35 65,25 70,40 75,20 80,35 85,30 90,45 95,35 100,50 100,100 0,100"
              fill="url(#grad)"
            />
          </Svg>
          {/* Animated stars */}
          {renderStars()}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside inputs
        >
          {/* Logo and Brand */}
          <Animated.View style={styles.headerContainer} entering={getEnteringAnimation(0)}>
            <Image
              source={require('../../assets/images/logo.png')} // Ensure this path is correct
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>
              Hotel<Text style={styles.titleHero}>Hero</Text>
            </Text>
            <Text style={styles.tagline}>Build Your Empire, Crush Your Rivals</Text>
          </Animated.View>

          {/* Login Form */}
          <Animated.View
            style={[
              styles.formWrapper,
              formAnimatedStyle // Apply shake animation here
            ]}
            // Apply entering animation to the entire form wrapper once
            entering={getEnteringAnimation(1)}
          >
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Welcome Back</Text>

              {/* Error Message - Animate presence */}
              {error && formState !== 'loading' && ( // Only show error when not loading
                 <Animated.View style={styles.errorContainer} entering={FadeInUp} exiting={FadeOut}>
                   <Text style={styles.errorText}>{error}</Text>
                 </Animated.View>
              )}

              {/* Email Input */}
              {/* Removed individual entering animations here, applied to wrapper */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <View style={styles.inputIconContainer}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <Path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()} // Focus next input
                    blurOnSubmit={false}
                    editable={formState !== 'loading'} // Disable input when loading
                  />
                </View>
              </View>

              {/* Password Input */}
              {/* Removed individual entering animations here */}
              <View style={styles.inputWrapper}>
                 <View style={styles.inputContainer}>
                  <View style={styles.inputIconContainer}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <Path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </Svg>
                  </View>
                  <TextInput
                    ref={passwordInputRef} // Ref for focusing
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    editable={formState !== 'loading'} // Disable input when loading
                  />
                  <TouchableOpacity
                    style={styles.showPasswordButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    disabled={formState === 'loading'}
                  >
                    <Text style={styles.showPasswordText}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                 </View>
              </View>

              {/* Remember Me & Forgot Password */}
              {/* Removed individual entering animations here */}
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.rememberMeContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                  disabled={formState === 'loading'}
                >
                  <View style={styles.checkbox}>
                    {/* Apply checkmark animation */}
                    <Animated.View style={rememberMeCheckAnimatedStyle}>
                      <Text style={styles.checkboxCheckmark}>✓</Text>
                    </Animated.View>
                  </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { /* Implement Forgot Password */ }}
                  activeOpacity={0.7}
                  disabled={formState === 'loading'}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              {/* Removed individual entering animations here */}
               <TouchableOpacity
                  style={[
                    styles.button,
                    (formState === 'loading' || formState === 'success') && styles.buttonDisabled
                  ]}
                  onPress={handleLogin}
                  disabled={formState === 'loading' || formState === 'success'}
                  onPressIn={onPressInButton}
                  onPressOut={onPressOutButton}
                  activeOpacity={1} // Use scale animation for feedback instead
                >
                  <Animated.View
                    style={[
                      styles.buttonContentWrapper,
                      buttonAnimatedStyle // Apply scale animation
                    ]}
                  >
                    {formState === 'loading' ? (
                      <View style={styles.buttonStateContent}>
                        <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Logging in...</Text>
                      </View>
                    ) : formState === 'success' ? (
                      <View style={styles.buttonStateContent}>
                        <Text style={styles.successIcon}>✓</Text>
                        <Text style={styles.buttonText}>Success!</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Log In</Text>
                    )}
                  </Animated.View>
                </TouchableOpacity>

              {/* Bottom Links */}
              {/* Removed individual entering animations here */}
               <View style={styles.bottomLinksWrapper}>
                <View style={styles.bottomLinksContainer}>
                  <Text style={styles.bottomText}>New to HotelHero? </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Register')} // Ensure 'Register' route exists
                    activeOpacity={0.7}
                    disabled={formState === 'loading'}
                  >
                    <Text style={styles.linkText}>Create Account</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.divider} />
                <View style={styles.bottomLinksContainer}>
                  <TouchableOpacity
                    onPress={() => setShowGuestWarning(true)}
                    activeOpacity={0.7}
                    disabled={formState === 'loading'}
                  >
                    <Text style={styles.guestLinkText}>Play as Guest</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Guest Mode Warning Modal */}
        <Modal
          visible={showGuestWarning}
          transparent={true}
          animationType="fade" // Fade is simple and effective
          onRequestClose={() => setShowGuestWarning(false)}
        >
          <View style={styles.modalOverlay}>
             {/* Use Reanimated View for modal entrance animation */}
             <Animated.View
                style={styles.modalContainer}
                entering={FadeInUp.duration(300).easing(ReanimatedEasing.out(ReanimatedEasing.ease))} // Modal entry animation
                exiting={FadeOut.duration(200)} // Modal exit animation
             >
               <View style={styles.modalHeader}>
                 <View style={styles.warningIconContainer}>
                   <Svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                     <Path d="M12 9V11M12 15H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0377 2.66667 10.2679 4L3.33975 16C2.56998 17.3333 3.53223 19 5.07183 19Z" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                   </Svg>
                 </View>
                 <Text style={styles.modalTitle}>Guest Mode Limitations</Text>
               </View>

               <Text style={styles.modalText}>
                 Guest mode allows you to play, but:
               </Text>
               <View style={styles.modalListContainer}>
                  {/* List items */}
                 <View style={styles.modalListItem}>
                   <View style={styles.modalListBullet} />
                   <Text style={styles.modalListText}>Progress might not be saved permanently.</Text>
                 </View>
                 <View style={styles.modalListItem}>
                   <View style={styles.modalListBullet} />
                   <Text style={styles.modalListText}>Some online features may be restricted.</Text>
                 </View>
                 <View style={styles.modalListItem}>
                   <View style={styles.modalListBullet} />
                   <Text style={styles.modalListText}>You won't have a persistent account.</Text>
                 </View>
               </View>

               <View style={styles.modalButtonsContainer}>
                 <TouchableOpacity
                   style={styles.modalCancelButton}
                   onPress={() => setShowGuestWarning(false)}
                   activeOpacity={0.7}
                 >
                   <Text style={styles.modalCancelButtonText}>Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={styles.modalConfirmButton}
                   onPress={handleGuestMode}
                   activeOpacity={0.7}
                 >
                   <Text style={styles.modalConfirmButtonText}>Continue as Guest</Text>
                 </TouchableOpacity>
               </View>
             </Animated.View>
          </View>
        </Modal>

        {/* Footer */}
        <Animated.View style={styles.footer} entering={getEnteringAnimation(2)}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} HotelHero. All rights reserved.
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

// --- Add Ref for password input ---
const passwordInputRef = React.createRef<TextInput>();

// --- Styles (minor adjustments maybe needed) ---
const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  skylineContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.4, // Adjust as needed
    zIndex: 0, // Behind content
  },
  svgBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 80, // Ensure space below form
    paddingTop: screenHeight * 0.1, // Adjust top padding
    zIndex: 1, // Above skyline
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24, // Spacing below header
  },
  logo: {
    width: screenWidth * 0.2, // Responsive logo size
    height: screenWidth * 0.2,
    marginBottom: 16,
  },
  title: {
    fontSize: Math.min(screenWidth * 0.085, 40), // Cap max font size
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  titleHero: {
    color: '#f97316', // Orange accent
  },
  tagline: {
    fontSize: Math.min(screenWidth * 0.035, 16), // Cap max font size
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  formWrapper: {
    width: '100%',
    maxWidth: screenWidth > 500 ? 400 : '100%', // Max width on larger screens
    alignItems: 'center',
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: Math.max(screenWidth * 0.06, 20), // Responsive padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    fontSize: Math.min(screenWidth * 0.055, 24), // Cap max font size
    fontWeight: '600',
    color: '#1f2937', // Darker gray
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    marginBottom: 16,
    backgroundColor: '#fee2e2', // Light red
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca', // Lighter red border
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#b91c1c', // Darker red text
    fontSize: Math.min(screenWidth * 0.035, 14),
    textAlign: 'center',
    fontWeight: '500',
  },
  inputWrapper: {
    marginBottom: 16,
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb', // Very light gray background
    borderWidth: 1,
    borderColor: '#d1d5db', // Gray border
    borderRadius: 8,
    overflow: 'hidden', // Clip children
  },
  inputIconContainer: {
    paddingHorizontal: 12,
    height: '100%', // Match input height
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb', // Light separator line
    backgroundColor: '#f3f4f6', // Slightly different gray for icon area
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: Math.min(screenWidth * 0.04, 16),
    color: '#111827', // Very dark gray
    paddingHorizontal: 12, // Padding inside input area
  },
  showPasswordButton: {
    paddingHorizontal: 15,
    height: '100%',
    justifyContent: 'center',
  },
  showPasswordText: {
    color: '#6b7280', // Medium gray
    fontSize: Math.min(screenWidth * 0.035, 14),
    fontWeight: '500',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap', // Allow wrapping on small screens if needed
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4, // Add touchable area
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#9ca3af', // Medium gray border
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxCheckmark: {
    color: '#2563eb', // Blue checkmark
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18, // Adjust line height for centering
  },
  rememberMeText: {
    fontSize: Math.min(screenWidth * 0.035, 14),
    color: '#4b5563', // Darker gray text
  },
  forgotPasswordText: {
    fontSize: Math.min(screenWidth * 0.035, 14),
    color: '#2563eb', // Blue link
    fontWeight: '500',
    paddingVertical: 4, // Add touchable area
  },
  button: {
    backgroundColor: '#2563eb', // Blue button
    borderRadius: 8,
    minHeight: 50, // Ensure minimum height
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    overflow: 'hidden', // Important for scale animation clipping
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd', // Lighter blue when disabled
  },
  buttonContentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  buttonStateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: Math.min(screenWidth * 0.04, 16),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  successIcon: {
    color: '#ffffff',
    fontSize: 18,
    marginRight: 8,
    fontWeight: 'bold',
  },
  bottomLinksWrapper: {
    marginTop: 24,
    width: '100%', // Ensure divider spans width
  },
  bottomLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4, // Space between links
    flexWrap: 'wrap', // Allow wrapping if text is long
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb', // Lighter divider color
    width: '100%',
    marginVertical: 12, // More space around divider
  },
  bottomText: {
    fontSize: Math.min(screenWidth * 0.035, 14),
    color: '#4b5563', // Darker gray text
  },
  linkText: {
    fontSize: Math.min(screenWidth * 0.035, 14),
    color: '#2563eb', // Blue link
    fontWeight: '500',
    marginLeft: 4, // Space before link
  },
  guestLinkText: {
    fontSize: Math.min(screenWidth * 0.035, 14),
    color: '#10b981', // Green link
    fontWeight: '500',
  },
  footer: {
    position: 'absolute', // Position footer at the bottom
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1, // Above skyline gradient if needed
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.6)', // Semi-transparent white
    fontSize: Math.min(screenWidth * 0.03, 12),
    textAlign: 'center',
  },
  // --- Modal styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 }, // Slightly larger shadow
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fef3c7', // Lighter warning yellow background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: Math.min(screenWidth * 0.05, 20),
    fontWeight: '700',
    color: '#1f2937', // Dark gray
    textAlign: 'center',
    marginBottom: 8,
  },
  modalText: {
    fontSize: Math.min(screenWidth * 0.038, 15), // Slightly larger modal text
    color: '#4b5563', // Darker gray
    marginBottom: 16, // More space below intro text
    lineHeight: 22, // Improve readability
  },
  modalListContainer: {
    marginBottom: 24,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align items top
    marginBottom: 10, // Space between list items
  },
  modalListBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb', // Blue bullet
    marginTop: 7, // Align bullet with text line
    marginRight: 10, // Space after bullet
  },
  modalListText: {
    fontSize: Math.min(screenWidth * 0.038, 15),
    color: '#4b5563',
    flex: 1, // Allow text to wrap
    lineHeight: 22, // Improve readability
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // Align buttons right
    alignItems: 'center',
    marginTop: 8, // Space above buttons
    gap: 12, // Space between buttons
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#e5e7eb', // Light gray cancel button
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#374151', // Darker gray text for cancel
    fontSize: Math.min(screenWidth * 0.035, 14),
    fontWeight: '600',
  },
  modalConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2563eb', // Blue confirm button
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#ffffff',
    fontSize: Math.min(screenWidth * 0.035, 14),
    fontWeight: '600',
  },
});

export default LoginScreen;