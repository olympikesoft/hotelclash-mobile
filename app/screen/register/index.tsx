import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Alert, // For simple confirmations or errors if needed
  Linking, // For opening terms link if it's external
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, NavigationProp } from "@react-navigation/native"; // Import NavigationProp
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle, Polygon, Defs, Stop } from "react-native-svg";
import Animated, {
  FadeIn,
  FadeOut,
  FadeInUp,
  FadeOutDown,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  Easing as ReanimatedEasing,
  Layout, // Import Layout for animating layout changes (like error message appearance)
} from "react-native-reanimated";
import { authAPI, gameAPI, userAPI } from "../../../services/index"; // Assuming this path is correct
import TermsModal from "../../components/TermsModal";

// Define ParamList for type safety with navigation
type RootStackParamList = {
  Login: undefined;
  Game: undefined;
  Register: undefined; // Add other routes if needed
};

// Define User structure (can be more detailed based on API response)
interface User {
  id: string;
  username: string;
  isGuest?: boolean;
  // Add other relevant user properties
}

// Define GameState structure (can be more detailed)
interface GameState {
  name: string;
  type: string;
  day: number;
  money: number;
  reputation: number;
  rooms: any[]; // Define more specific types if possible
  staff: any[];
  facilities: any[];
  guests: any[];
  policies: Record<string, boolean>;
  competitors: any[];
  marketShare: number;
  achievements: any[];
  marketData: any[];
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// --- Animated Star Component --- (Reused from LoginScreen)
const AnimatedStar = ({ index }: { index: number }) => {
  const starOpacity = useSharedValue(0.2);
  const starScale = useSharedValue(1);
  const starLeft = `${5 + index * 6}%`;
  const starBottom = `${20 + Math.random() * 60}%`;
  const animDuration = 1500 + Math.random() * 2000;
  const animDelay = Math.random() * 2000;

  React.useEffect(() => {
    starOpacity.value = withDelay(
      animDelay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: animDuration / 2 }),
          withTiming(0.2, { duration: animDuration / 2 })
        ),
        -1,
        true
      )
    );
    starScale.value = withDelay(
      animDelay,
      withRepeat(
        withSequence(
          withTiming(1.5, { duration: animDuration / 2 }),
          withTiming(1, { duration: animDuration / 2 })
        ),
        -1,
        true
      )
    );
  }, [starOpacity, starScale, animDuration, animDelay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: starOpacity.value,
    transform: [{ scale: starScale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        { left: starLeft, bottom: starBottom },
        animatedStyle,
      ]}
    />
  );
};
// --- End Animated Star Component ---

const RegisterScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>(); // Typed navigation
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [hotelType, setHotelType] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [step, setStep] = useState(1); // 1 for account, 2 for hotel
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [username, setUserName] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showGuestWarning, setShowGuestWarning] = useState(false);

  // Shared values for animations
  const buttonScale = useSharedValue(1);
  const checkboxScale = useSharedValue(0);
  const checkboxOpacity = useSharedValue(0);

  // Refs for focusing inputs
  const usernameInputRef = React.useRef<TextInput>(null);
  const passwordInputRef = React.useRef<TextInput>(null);
  const confirmPasswordInputRef = React.useRef<TextInput>(null);
  const hotelNameInputRef = React.useRef<TextInput>(null);

  const hotelTypes = [
    {
      id: "budget",
      name: "Budget Hotel",
      description: "Affordable stays, basic amenities",
    },
    {
      id: "boutique",
      name: "Boutique Hotel",
      description: "Stylish & intimate, unique character",
    },
    {
      id: "luxury",
      name: "Luxury Resort",
      description: "High-end stays, premium amenities",
    },
    {
      id: "business",
      name: "Business Hotel",
      description: "Practical for business travelers",
    },
  ];

  // Animation effect for checkbox
  React.useEffect(() => {
    const targetValue = agreeTerms ? 1 : 0;
    checkboxScale.value = withTiming(targetValue, { duration: 200 });
    checkboxOpacity.value = withTiming(targetValue, { duration: 200 });
  }, [agreeTerms, checkboxScale, checkboxOpacity]);

  const checkboxAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkboxOpacity.value,
    transform: [{ scale: checkboxScale.value }],
  }));

  // Button press animations
  const onPressInButton = () => {
    buttonScale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  };
  const onPressOutButton = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleNextStep = () => {
    setError(""); // Reset error

    if (!email.trim()) return setError("Email is required");
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      return setError("Please enter a valid email");
    if (!username.trim()) return setError("Username is required");
    if (!password) return setError("Password is required");
    if (password.length < 6)
      return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setStep(2);
  };

  const handleRegister = async () => {
    setError(""); // Reset error

    if (!hotelName.trim()) return setError("Hotel name is required");
    if (!hotelType) return setError("Please select a hotel type");
    if (!agreeTerms)
      return setError("You must agree to the terms and conditions");

    setIsLoading(true);

    try {
      // Step 1: Register user
      const registerResponse = await authAPI.register(
        email.trim(),
        username.trim(),
        password,
        hotelName.trim(),
        hotelType
      );

      // Assuming authAPI.register handles storing token/user data internally (e.g., using AsyncStorage)
      // If not, you'd get the token/user from registerResponse and store it here:
      // await AsyncStorage.setItem('token', registerResponse.data.token);
      // await AsyncStorage.setItem('user', JSON.stringify(registerResponse.data.user));

      // Step 2: Create initial game state locally
      const initialGameState = createInitialGameState(
        hotelName.trim(),
        hotelType
      );

      // Step 3: Save initial game state (attempt server first, then local)
      try {
        const timeStampVal = new Date().getTime();
        // gameAPI.saveGame should ideally take user ID or token for association
        await gameAPI.saveGame(
          `${hotelName.trim()} - ${timeStampVal}`,
          initialGameState
        );
      } catch (saveError: any) {
        console.warn(
          "Error saving initial game state to server (saving locally):",
          saveError.message
        );
        // Save locally as fallback if server save fails
        await AsyncStorage.setItem(
          "gameState",
          JSON.stringify(initialGameState)
        );
      }

      // Navigate to game screen
      navigation.navigate("Game");
    } catch (err: any) {
      console.error(
        "Registration error:",
        err.response?.data || err.message || err
      );
      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = async () => {
    setShowGuestWarning(false); // Close modal first
    setIsLoading(true); // Show loading indicator briefly

    try {
      const guestToken = "guest_" + Math.random().toString(36).substring(2, 11);
      const guestUser: User = {
        id: "guest_" + Math.random().toString(36).substring(2, 11),
        username: "Guest Player",
        isGuest: true,
      };
      const guestHotelName = "Guest Hotel";
      const guestHotelType = "budget"; // Default guest hotel type

      // Store guest credentials
      await AsyncStorage.setItem("token", guestToken);
      await AsyncStorage.setItem("user", JSON.stringify(guestUser));

      // Create and store initial game state locally for guest
      const initialGameState = createInitialGameState(
        guestHotelName,
        guestHotelType
      );
      await AsyncStorage.setItem("gameState", JSON.stringify(initialGameState));

      // Navigate to game
      navigation.navigate("Game");
    } catch (err: any) {
      console.error("Guest mode error:", err.message);
      setError("Failed to enter guest mode.");
      // Don't set isLoading false here if error occurs, let user retry or cancel
    } finally {
      // Only set loading false if navigation didn't happen or on success
      // Let the navigation itself transition away from the loading state
      setIsLoading(false); // Set loading false here regardless
    }
  };

  // Memoize star rendering
  const renderStars = useCallback(() => {
    return Array.from({ length: 15 }).map((_, i) => (
      <AnimatedStar key={`star-${i}`} index={i} />
    ));
  }, []);

  const createInitialGameState = (hName: string, hType: string): GameState => {
    const initialMoney = 10000;
    const initialReputation = 3.0;
    const initialRooms = [
      {
        id: 1,
        type: "Standard",
        price: 80,
        occupied: false,
        quality: 1,
        guest: null,
      },
      {
        id: 2,
        type: "Standard",
        price: 80,
        occupied: false,
        quality: 1,
        guest: null,
      },
    ];
    const initialStaff = [
      {
        id: 1,
        name: "Jane",
        role: "Receptionist",
        salary: 100,
        skill: 2,
        happiness: 4,
      },
    ];
    const initialFacilities = [{ id: 1, name: "Lobby", level: 1, upkeep: 50 }];

    return {
      name: hName,
      type: hType,
      day: 1,
      money: initialMoney,
      reputation: initialReputation,
      rooms: initialRooms,
      staff: initialStaff,
      facilities: initialFacilities,
      guests: [], // Start with no guests initially
      policies: {
        /* default policies */
      },
      competitors: [], // Start with no competitors initially
      marketShare: 0,
      achievements: [], // Start with no achievements
      marketData: [{ day: 1, share: 0, reputation: initialReputation }],
    };
  };

  return (
    <LinearGradient
      colors={["#0f172a", "#1e293b"]}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -100}
      >
        <View style={styles.skylineContainer}>
          <Svg
            height="100%"
            width="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={styles.svgBackground}
          >
            <Defs>
              <LinearGradient
                colors={["#3b82f6", "#60a5fa"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ flex: 1 }}
              >
                <Stop offset="0" stopColor="#3b82f6" stopOpacity="0.1" />
                <Stop offset="1" stopColor="#3b82f6" stopOpacity="0.3" />
              </LinearGradient>
            </Defs>

            <Polygon
              points="0,60 5,50 10,55 15,40 20,45 25,30 30,40 35,25 40,40 45,20 50,25 55,15 60,35 65,25 70,40 75,20 80,35 85,30 90,45 95,35 100,50 100,100 0,100"
              fill="url(#gradSky)"
            />
          </Svg>

          {/* Stars overlay */}
          {renderStars()}
        </View>

        {/* Guest Warning Modal */}
        <Modal
          visible={showGuestWarning}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowGuestWarning(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View
              style={styles.guestModalContainer}
              entering={FadeInUp.duration(300)}
              exiting={FadeOutDown.duration(200)}
            >
              <View style={styles.modalIconContainer}>
                <Svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></Path>
                  <Path d="M12 9v4"></Path>
                  <Path d="M12 17h.01"></Path>
                </Svg>
              </View>
              <Text style={styles.modalTitle}>Guest Mode Limits</Text>
              <Text style={styles.modalText}>Playing as a guest means:</Text>
              <View style={styles.modalList}>
                <View style={styles.modalListItem}>
                  <Text style={styles.modalListBullet}>•</Text>
                  <Text style={styles.modalListText}>
                    Progress isn't saved permanently.
                  </Text>
                </View>
                <View style={styles.modalListItem}>
                  <Text style={styles.modalListBullet}>•</Text>
                  <Text style={styles.modalListText}>
                    Some features may be restricted.
                  </Text>
                </View>
                <View style={styles.modalListItem}>
                  <Text style={styles.modalListBullet}>•</Text>
                  <Text style={styles.modalListText}>
                    You won't have a persistent account.
                  </Text>
                </View>
              </View>
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowGuestWarning(false)}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleGuestMode}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalConfirmButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Terms Modal (using imported component) */}
        <TermsModal
          isOpen={showTermsModal}
          onClose={() => setShowTermsModal(false)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={styles.contentWrapper}
            entering={FadeInUp.delay(200).duration(600)}
          >
            {/* Header */}
            <View style={styles.headerContainer}>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Image
                                source={require('../../assets/images/logo.png')} // Ensure this path is correct
                  style={styles.logo}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <Text style={styles.title}>
                Hotel<Text style={styles.titleHero}>Hero</Text>
              </Text>
              <Text style={styles.tagline}>
                Build Your Empire, Crush Your Rivals
              </Text>
            </View>

            {/* Form Container */}
            <Animated.View
              style={styles.formContainer}
              layout={Layout.easing(ReanimatedEasing.ease).duration(300)}
            >
              <Text style={styles.formTitle}>
                {step === 1 ? "Create Your Account" : "Set Up Your Hotel"}
              </Text>

              {/* Step Indicator */}
              <View style={styles.stepIndicatorContainer}>
                <View
                  style={[
                    styles.stepIndicatorBar,
                    step === 1 && styles.stepIndicatorActive,
                  ]}
                />
                <Text style={styles.stepIndicatorText}>Step {step}/2</Text>
                <View
                  style={[
                    styles.stepIndicatorBar,
                    step === 2 && styles.stepIndicatorActive,
                  ]}
                />
              </View>

              {/* Error Message */}
              {error ? (
                <Animated.View
                  style={styles.errorContainer}
                  entering={FadeIn.duration(300)}
                  exiting={FadeOut.duration(300)}
                >
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              {/* Step 1 Form */}
              {step === 1 && (
                <Animated.View
                  entering={FadeIn.duration(400)}
                  exiting={FadeOut.duration(200)}
                >
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="next"
                    onSubmitEditing={() => usernameInputRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                  <TextInput
                    ref={usernameInputRef}
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor="#9ca3af"
                    value={username}
                    onChangeText={setUserName}
                    autoCapitalize="none"
                    autoComplete="username"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="Password (min 6 chars)"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="new-password"
                    returnKeyType="next"
                    onSubmitEditing={() =>
                      confirmPasswordInputRef.current?.focus()
                    }
                    blurOnSubmit={false}
                  />
                  <TextInput
                    ref={confirmPasswordInputRef}
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#9ca3af"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleNextStep}
                  />
                  <TouchableOpacity
                    onPress={handleNextStep}
                    style={styles.buttonPrimary}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>Continue</Text>
                  </TouchableOpacity>
                  <View style={styles.bottomLinks}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("Login")}
                    >
                      <Text style={styles.bottomText}>
                        Already have an account?{" "}
                        <Text style={styles.linkText}>Log In</Text>
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowGuestWarning(true)}>
                      <Text style={[styles.linkText, styles.guestLink]}>
                        Play as Guest
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {/* Step 2 Form */}
              {step === 2 && (
                <Animated.View
                  entering={FadeIn.duration(400)}
                  exiting={FadeOut.duration(200)}
                >
                  <TextInput
                    ref={hotelNameInputRef}
                    style={styles.input}
                    placeholder="Hotel Name"
                    placeholderTextColor="#9ca3af"
                    value={hotelName}
                    onChangeText={setHotelName}
                    returnKeyType="done" // Or "next" if more fields
                  />

                  <Text style={styles.label}>Hotel Type</Text>
                  <View style={styles.hotelTypeContainer}>
                    {hotelTypes.map((type) => (
                      <TouchableOpacity
                        key={type.id}
                        style={[
                          styles.hotelTypeOption,
                          hotelType === type.id &&
                            styles.hotelTypeOptionSelected,
                        ]}
                        onPress={() => setHotelType(type.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.hotelTypeName,
                            hotelType === type.id &&
                              styles.hotelTypeNameSelected,
                          ]}
                        >
                          {type.name}
                        </Text>
                        <Text
                          style={[
                            styles.hotelTypeDesc,
                            hotelType === type.id &&
                              styles.hotelTypeDescSelected,
                          ]}
                        >
                          {type.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                      style={styles.checkboxBase}
                      onPress={() => setAgreeTerms(!agreeTerms)}
                      activeOpacity={0.7}
                    >
                      {agreeTerms && (
                        <Animated.View style={checkboxAnimatedStyle}>
                          <Svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <Path d="M20 6L9 17l-5-5" />
                          </Svg>
                        </Animated.View>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>
                      I agree to the{" "}
                      <Text
                        style={styles.linkText}
                        onPress={() => setShowTermsModal(true)}
                      >
                        Terms & Conditions
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.buttonGroup}>
                    <TouchableOpacity
                      onPress={() => setStep(1)}
                      style={styles.buttonSecondary}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      <Text style={styles.buttonSecondaryText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleRegister}
                      style={[
                        styles.buttonPrimary,
                        isLoading && styles.buttonDisabled,
                      ]}
                      activeOpacity={0.8}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.buttonText}>Create Hotel</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        <Animated.View style={styles.footer} entering={FadeIn.delay(800)}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} HotelHero. All rights reserved.
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  // Skyline and Stars (similar to LoginScreen)
  skylineContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.35, // Adjusted height
    zIndex: 0,
  },
  svgBackground: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
  },
  star: {
    position: "absolute",
    width: 2,
    height: 2,
    backgroundColor: "#fcd34d", // amber-300
    borderRadius: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 80, // Space for footer + buffer
    paddingTop: screenHeight * 0.08,
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 450, // Max width for larger screens
    alignItems: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: screenWidth * 0.18,
    height: screenWidth * 0.18,
    marginBottom: 12,
  },
  title: {
    fontSize: Math.min(screenWidth * 0.08, 36),
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  titleHero: {
    color: "#f97316", // orange-500
    borderBottomWidth: 2,
    borderBottomColor: "#f97316",
    paddingBottom: 2,
  },
  tagline: {
    fontSize: Math.min(screenWidth * 0.035, 15),
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 8,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: Math.max(screenWidth * 0.05, 20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    fontSize: Math.min(screenWidth * 0.055, 22),
    fontWeight: "600",
    color: "#1f2937", // slate-800
    textAlign: "center",
    marginBottom: 16,
  },
  stepIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stepIndicatorBar: {
    height: 8,
    width: 60,
    borderRadius: 4,
    backgroundColor: "#dbeafe", // blue-100
  },
  stepIndicatorActive: {
    backgroundColor: "#2563eb", // blue-600
  },
  stepIndicatorText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#6b7280", // slate-500
    fontWeight: "500",
  },
  errorContainer: {
    marginBottom: 16,
    backgroundColor: "#fee2e2", // red-100
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca", // red-200
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    color: "#b91c1c", // red-700
    fontSize: Math.min(screenWidth * 0.035, 14),
    textAlign: "center",
    fontWeight: "500",
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#f9fafb", // slate-50
    borderWidth: 1,
    borderColor: "#e5e7eb", // slate-200
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: Math.min(screenWidth * 0.04, 16),
    color: "#1f2937",
    marginBottom: 16, // Space between inputs
  },
  buttonPrimary: {
    backgroundColor: "#2563eb", // blue-600
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8, // Space above button
    minHeight: 50,
  },
  buttonSecondary: {
    backgroundColor: "#e5e7eb", // slate-200
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    flex: 1, // Take available space in group
  },
  buttonSecondaryText: {
    color: "#374151", // slate-700
    fontSize: Math.min(screenWidth * 0.04, 16),
    fontWeight: "600",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: Math.min(screenWidth * 0.04, 16),
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd", // blue-300 (lighter blue)
  },
  bottomLinks: {
    marginTop: 20,
    alignItems: "center",
  },
  bottomText: {
    fontSize: Math.min(screenWidth * 0.035, 14),
    color: "#4b5563", // slate-600
    marginBottom: 8,
  },
  linkText: {
    color: "#2563eb", // blue-600
    fontWeight: "600",
  },
  guestLink: {
    color: "#10b981", // emerald-500
    marginTop: 4,
  },
  label: {
    fontSize: Math.min(screenWidth * 0.038, 15),
    fontWeight: "500",
    color: "#374151", // slate-700
    marginBottom: 8,
  },
  hotelTypeContainer: {
    marginBottom: 20,
    // Removed grid, use flex column for simplicity in RN or implement grid logic if needed
  },
  hotelTypeOption: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb", // slate-200
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  hotelTypeOptionSelected: {
    borderColor: "#2563eb", // blue-600
    backgroundColor: "#eff6ff", // blue-50
  },
  hotelTypeName: {
    fontSize: Math.min(screenWidth * 0.04, 16),
    fontWeight: "600",
    color: "#1f2937",
  },
  hotelTypeNameSelected: {
    color: "#1e40af", // blue-800
  },
  hotelTypeDesc: {
    fontSize: Math.min(screenWidth * 0.032, 13),
    color: "#6b7280", // slate-500
    marginTop: 4,
  },
  hotelTypeDescSelected: {
    color: "#1d4ed8", // blue-700
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  checkboxBase: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: "#9ca3af", // slate-400
    borderRadius: 4,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  checkboxChecked: {
    // Applied dynamically via style array
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  checkboxLabel: {
    fontSize: Math.min(screenWidth * 0.035, 14),
    color: "#4b5563", // slate-600
    flex: 1, // Allow text to wrap
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12, // Use gap for spacing between buttons
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 15,
    alignItems: "center",
    zIndex: 1,
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: Math.min(screenWidth * 0.03, 12),
  },
  // Guest Warning Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  guestModalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalIconContainer: {
    marginBottom: 16,
    backgroundColor: "#fffbeb", // yellow-50
    padding: 12,
    borderRadius: 999,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  modalText: {
    fontSize: 15,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  modalList: {
    alignSelf: "stretch",
    marginBottom: 24,
    paddingLeft: 10, // Indent list slightly
  },
  modalListItem: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-start",
  },
  modalListBullet: {
    color: "#6b7280",
    marginRight: 8,
    fontSize: 16,
    lineHeight: 22, // Match text line height
  },
  modalListText: {
    flex: 1, // Allow text wrapping
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 22,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end", // Align buttons right
    width: "100%",
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
  },
  modalCancelButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 14,
  },
  modalConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    minWidth: 80, // Ensure consistent width
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
});

export default RegisterScreen;
