import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  FlatList,
  StatusBar,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  PermissionsAndroid,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RNFS from 'react-native-fs';
import { authorize } from 'react-native-app-auth';
import * as Keychain from 'react-native-keychain';

// const API_BASE_URL = 'http://localhost:5000/api';
const API_BASE_URL = 'https://live-feed-socials-926fb17c8f89.herokuapp.com/api';

// Twitter OAuth 2.0 configuration
const twitterConfig = {
  clientId: 'Z1A1LWZVWHZRRXlZNl95Nm5WVnk6MTpjaQ',
  redirectUrl: 'mylivefeed://callback',
  scopes: ['tweet.read', 'tweet.write', 'users.read', 'like.read', 'like.write', 'offline.access'],
  serviceConfiguration: {
    authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
    tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
  },
  usePKCE: true,
};

// Define navigation param list
type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: { email: string };
  EditProfile: { email: string };
  Users: undefined;
};

// Define screen props
type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
type SignupScreenProps = NativeStackScreenProps<RootStackParamList, 'Signup'>;
type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
type EditProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
type UsersScreenProps = NativeStackScreenProps<RootStackParamList, 'Users'>;

// Set up stack navigator
const Stack = createNativeStackNavigator<RootStackParamList>();

type User = {
  email: string;
  name: string;
  username: string;
  phone: string;
  dateOfBirth: string;
  image: string;
};

type Post = {
  id: string;
  username: string;
  content: string;
  timestamp: string;
  image?: string;
  isTwitter?: boolean;
  twitterId?: string;
  conversationId?: string;
};

// Default profile image
const DEFAULT_PROFILE_IMAGE = 'default-avatar-icon-of-social-media-user-vector.jpg';


const TWITTER_CLIENT_ID = 'Z1A1LWZVWHZRRXlZNl95Nm5WVnk6MTpjaQ';
const REDIRECT_URI = 'mylivefeed://callback'; // must be registered in Twitter dev portal + manifest
const AUTH_ENDPOINT = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_ENDPOINT = 'https://api.twitter.com/2/oauth2/token';

// Utility function to convert image to base64 with mime type
const imageToBase64 = async (imagePath: string): Promise<string> => {
  try {
    const extension = imagePath.split('.').pop()?.toLowerCase();
    let mimeType = 'image/jpeg';
    if (extension === 'png') mimeType = 'image/png';
    else if (extension === 'gif') mimeType = 'image/gif';
    else if (extension === 'jpg') mimeType = 'image/jpeg';

    const base64String = await RNFS.readFile(imagePath, 'base64');
    return `data:${mimeType};base64,${base64String}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return '';
  }
};

// Convert asset to base64
const assetToBase64 = async (fileName: string): Promise<string> => {
  try {
    const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    console.log(`Copying asset to: ${destPath}`);
    try {
      if (Platform.OS === 'android') {
        await RNFS.copyFileAssets(fileName, destPath);
        console.log('Copied asset for Android');
      } else if (Platform.OS === 'ios') {
        const sourcePath = `${RNFS.MainBundlePath}/${fileName}`;
        console.log(`Copying from iOS bundle: ${sourcePath}`);
        await RNFS.copyFile(sourcePath, destPath);
        console.log('Copied asset for iOS');
      }
      const base64 = await RNFS.readFile(destPath, 'base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (err) {
      console.error('Base64 error:', err);
      return '';
    }
  } catch (error) {
    console.error('Error converting asset to base64:', error);
    return '';
  }
};

// Pure JavaScript SHA-256 implementation
function sha256(str : string) {
  // Convert string to array of bytes
  const msgBuffer = new TextEncoder().encode(str);
  const msgLength = msgBuffer.length;

  // Initialize hash values (SHA-256 constants)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  // SHA-256 constants
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // Padding and message scheduling
  const paddedLength = Math.ceil((msgLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(msgBuffer);
  padded[msgLength] = 0x80;
  for (let i = msgLength + 1; i < paddedLength - 8; i++) padded[i] = 0;
  const bitLength = msgLength * 8;
  for (let i = 0; i < 8; i++) {
    padded[paddedLength - 8 + i] = (bitLength / Math.pow(2, (7 - i) * 8)) & 0xff;
  }

  // Process in 512-bit chunks
  for (let i = 0; i < paddedLength; i += 64) {
    const w = new Uint32Array(64);
    for (let j = 0; j < 16; j++) {
      w[j] = (padded[i + j * 4] << 24) |
             (padded[i + j * 4 + 1] << 16) |
             (padded[i + j * 4 + 2] << 8) |
             padded[i + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
      const s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  // Convert hash to bytes
  const hash = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const h = [h0, h1, h2, h3, h4, h5, h6, h7][i];
    hash[i * 4] = (h >>> 24) & 0xff;
    hash[i * 4 + 1] = (h >>> 16) & 0xff;
    hash[i * 4 + 2] = (h >>> 8) & 0xff;
    hash[i * 4 + 3] = h & 0xff;
  }

  return hash;
}

// AuthService with API calls
const AuthService = {
  async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string; sessionId: string } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem('accessToken', data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
        await AsyncStorage.setItem('sessionId', data.sessionId);
        return data;
      }
      throw new Error(data.message || 'Network error');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  async signup(user: User & { password: string }): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (response.ok) {
        return true;
      }
      throw new Error((await response.json()).message || 'Network error');
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },
  async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const sessionId = await AsyncStorage.getItem('sessionId');
      if (!refreshToken || !sessionId) {
        throw new Error('No refresh token or session ID available');
      }
      const response = await fetch(`${API_BASE_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, sessionId }),
      });
      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem('accessToken', data.accessToken);
        return data.accessToken;
      }
      throw new Error(data.message || 'Refresh failed');
    } catch (error) {
      console.error('Refresh token error:', error);
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('sessionId');
      await AsyncStorage.removeItem('twitterUserId');
      return null;
    }
  },
  async makeAuthenticatedRequest(url: string, options: RequestInit): Promise<Response> {
    let accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) {
      accessToken = await AuthService.refreshToken();
      if (!accessToken) {
        throw new Error('Authentication failed');
      }
    }
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && (await response.json()).message === 'Access token expired') {
      accessToken = await AuthService.refreshToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
        return fetch(url, { ...options, headers });
      }
    }
    return response;
  },
  async updateProfile(user: User): Promise<User> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        body: JSON.stringify(user),
      });
      const data = await response.json();
      if (response.ok) {
        return data.user;
      }
      throw new Error(data.message || 'Network error');
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },
  async deleteAccount(email: string): Promise<void> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/profile`, {
        method: 'DELETE',
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error((await response.json()).message || 'Network error');
      }
      await AsyncStorage.removeItem('sessionId');
      await AsyncStorage.removeItem('twitterUserId');
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  },
  async logout(): Promise<void> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/logout`, {
        method: 'POST',
      });
      if (response.ok) {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
        await AsyncStorage.removeItem('sessionId');
        await AsyncStorage.removeItem('twitterUserId');
      } else {
        throw new Error((await response.json()).message || 'Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },
  async getAllUsers(): Promise<User[]> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/users`, {
        method: 'GET',
      });
      const data = await response.json();
      if (response.ok) {
        return data.users;
      }
      throw new Error(data.message || 'Network error');
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  },
  async getPosts(): Promise<Post[]> {
    try {
      return [{
        id: "local1",
        content: "Sample local post",
        image: "",
        username: "localuser",
        timestamp: new Date().toISOString()
      }];
    } catch (error) {
      console.error('Get posts error:', error);
      throw error;
    }
  },
  async initiateTwitterAuth(): Promise<void> {
    try {
      console.log('Starting Twitter auth with config:', JSON.stringify(twitterConfig, null, 2));
      const result = await authorize(twitterConfig);
      console.log('Twitter auth result:', JSON.stringify(result, null, 2));
      // Fetch Twitter user data
      const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          Authorization: `Bearer ${result.accessToken}`,
        },
      });
      const userData = await userResponse.json();
      console.log('Twitter user data:', JSON.stringify(userData, null, 2));
      if (!userResponse.ok) {
        throw new Error(userData.message || 'Failed to fetch user data');
      }
      // Store Twitter user ID securely
      await Keychain.setGenericPassword('twitterUserId', userData.data.id);
      // Send tokens to backend for session storage
      const sessionId = await AsyncStorage.getItem('sessionId');
      if (!sessionId) {
        throw new Error('No session ID available');
      }
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/twitter/store-token`, {
        method: 'POST',
        body: JSON.stringify({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken || '',
          expiresIn: Math.floor((new Date(result.accessTokenExpirationDate).getTime() - Date.now()) / 1000),
          twitterUserId: userData.data.id,
        }),
      });
      const responseData = await response.json();
      console.log('Store token response:', JSON.stringify(responseData, null, 2));
      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to store Twitter token');
      }
    } catch (error: any) {
      console.error('Twitter auth error:', error.message, error.stack, JSON.stringify(error, null, 2));
      Alert.alert('Twitter Auth Error', error.message || 'Failed to complete Twitter authentication');
      throw error;
    }
  },
  async fetchTwitterFeed(): Promise<Post[]> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/twitter/tweets`, {
        method: 'GET',
      });
      const data = await response.json();
      if (response.ok) {
        return data.tweets.map((tweet: any) => ({
          id: tweet.id,
          username: tweet.author_id || 'Unknown',
          content: tweet.text,
          timestamp: tweet.created_at || new Date().toISOString(),
          isTwitter: true,
          twitterId: tweet.id,
          conversationId: tweet.conversation_id,
        }));
      }
      throw new Error(data.message || 'Failed to fetch tweets');
    } catch (error) {
      console.error('Fetch Twitter feed error:', error);
      return [];
    }
  },
  async postTwitterComment(tweetId: string, comment: string): Promise<boolean> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/twitter/tweet`, {
        method: 'POST',
        body: JSON.stringify({ text: comment, reply: { in_reply_to_tweet_id: tweetId } }),
      });
      const data = await response.json();
      if (response.ok) {
        return true;
      }
      throw new Error(data.message || 'Failed to post comment');
    } catch (error) {
      console.error('Post Twitter comment error:', error);
      return false;
    }
  },
  async likeTwitterPost(tweetId: string): Promise<boolean> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/twitter/like`, {
        method: 'POST',
        body: JSON.stringify({ tweetId }),
      });
      const data = await response.json();
      if (response.ok) {
        return true;
      }
      throw new Error(data.message || 'Failed to like post');
    } catch (error) {
      console.error('Like Twitter post error:', error);
      return false;
    }
  },
  async unlikeTwitterPost(tweetId: string): Promise<boolean> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/twitter/unlike`, {
        method: 'POST',
        body: JSON.stringify({ tweetId }),
      });
      const data = await response.json();
      if (response.ok) {
        return true;
      }
      throw new Error(data.message || 'Failed to unlike post');
    } catch (error) {
      console.error('Unlike Twitter post error:', error);
      return false;
    }
  },
  async fetchTwitterReplies(conversationId: string): Promise<Post[]> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(`${API_BASE_URL}/twitter/tweets`, {
        method: 'GET',
        body: JSON.stringify({ conversationId }),
      });
      const data = await response.json();
      if (response.ok) {
        return data.tweets.map((reply: any) => ({
          id: reply.id,
          username: reply.author_id || 'Unknown',
          content: reply.text,
          timestamp: reply.created_at || new Date().toISOString(),
          isTwitter: true,
          twitterId: reply.id,
        }));
      }
      throw new Error(data.message || 'Failed to fetch replies');
    } catch (error) {
      console.error('Fetch Twitter replies error:', error);
      return [];
    }
  },
};

// Custom Drawer Component (unchanged)
const CustomDrawer: React.FC<{
  visible: boolean;
  toggleDrawer: () => void;
  navigation: any;
  email: string;
}> = ({ visible, toggleDrawer, navigation, email }) => {
  const translateX = useRef(new Animated.Value(-Dimensions.get('window').width * 0.5)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -Dimensions.get('window').width * 0.5,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleLogout = () => {
    Alert.alert('Confirm', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await AuthService.logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
            toggleDrawer();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Logout failed');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Confirm', 'Are you sure you want to delete your account? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await AuthService.deleteAccount(email);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
            toggleDrawer();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.drawer,
        {
          transform: [{ translateX }],
        },
      ]}
    >
      <View style={styles.drawerContent}>
        <Text
          style={styles.drawerItem}
          onPress={() => {
            navigation.navigate('EditProfile', { email });
            toggleDrawer();
          }}
        >
          Edit Profile
        </Text>
        <Text
          style={styles.drawerItem}
          onPress={() => {
            navigation.navigate('Users');
            toggleDrawer();
          }}
        >
          View All Users
        </Text>
        <Text style={styles.drawerItem} onPress={handleLogout}>
          Sign Out
        </Text>
        <Text style={styles.drawerItem} onPress={handleDeleteAccount}>
          Delete Account
        </Text>
      </View>
      <TouchableOpacity style={styles.drawerOverlay} onPress={toggleDrawer} />
    </Animated.View>
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  const { email } = route.params;
  const [userImage, setUserImage] = useState<string>('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [twitterUserId, setTwitterUserId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
  const [showReplies, setShowReplies] = useState<{ [key: string]: Post[] }>({});

  useEffect(() => {
    const loadUser = async () => {
      try {
        const users = await AuthService.getAllUsers();
        const userData = users.find(u => u.email === email);
        if (userData && userData.image) {
          setUserImage(userData.image);
        } else {
          const defaultImage = await assetToBase64(DEFAULT_PROFILE_IMAGE);
          setUserImage(defaultImage);
        }
      } catch (error) {
        console.error('Failed to load user image:', error);
        const defaultImage = await assetToBase64(DEFAULT_PROFILE_IMAGE);
        setUserImage(defaultImage);
      }
    };
    loadUser();
  }, [email]);

  useEffect(() => {
    const checkTwitterAuth = async () => {
      const credentials = await Keychain.getGenericPassword();
      const userId = credentials && credentials.username === 'twitterUserId' ? credentials.password : null;
      if (userId) {
        setTwitterUserId(userId);
      }
    };
    checkTwitterAuth();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const localPosts = await AuthService.getPosts();
      let twitterPosts: Post[] = [];
      if (twitterUserId) {
        twitterPosts = await AuthService.fetchTwitterFeed();
      }
      setPosts([...localPosts, ...twitterPosts]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [twitterUserId]);

  const handleTwitterLogin = async () => {
    try {
      await AuthService.initiateTwitterAuth();
      const credentials = await Keychain.getGenericPassword();
      const userId = credentials && credentials.username === 'twitterUserId' ? credentials.password : null;
      if (userId) {
        setTwitterUserId(userId);
        fetchPosts();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to initiate Twitter login');
    }
  };

  const handleComment = async (post: Post) => {
    if (!twitterUserId || !post.twitterId || !commentText[post.id]) {
      Alert.alert('Error', 'Please log in to Twitter and enter a comment');
      return;
    }
    const success = await AuthService.postTwitterComment(post.twitterId, commentText[post.id]);
    if (success) {
      Alert.alert('Success', 'Comment posted');
      setCommentText({ ...commentText, [post.id]: '' });
      await fetchPosts();
    } else {
      Alert.alert('Error', 'Failed to post comment');
    }
  };

  const handleLike = async (post: Post) => {
    if (!twitterUserId || !post.twitterId) {
      Alert.alert('Error', 'Please log in to Twitter');
      return;
    }
    const success = await AuthService.likeTwitterPost(post.twitterId);
    if (success) {
      Alert.alert('Success', 'Post liked');
      await fetchPosts();
    } else {
      Alert.alert('Error', 'Failed to like post');
    }
  };

  const handleUnlike = async (post: Post) => {
    if (!twitterUserId || !post.twitterId) {
      Alert.alert('Error', 'Please log in to Twitter');
      return;
    }
    const success = await AuthService.unlikeTwitterPost(post.twitterId);
    if (success) {
      Alert.alert('Success', 'Post unliked');
      await fetchPosts();
    } else {
      Alert.alert('Error', 'Failed to unlike post');
    }
  };

  const handleViewReplies = async (post: Post) => {
    if (!twitterUserId || !post.conversationId) {
      Alert.alert('Error', 'Please log in to Twitter or select a Twitter post');
      return;
    }
    const replies = await AuthService.fetchTwitterReplies(post.conversationId);
    setShowReplies({ ...showReplies, [post.id]: replies });
    await fetchPosts();
  };

  const toggleDrawer = () => {
    setDrawerVisible(!drawerVisible);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postTile}>
      <View style={styles.postHeader}>
        <Image
          source={{ uri: item.image || '' }}
          style={styles.postUserImage}
          onError={async () => {
            const defaultImage = await assetToBase64(DEFAULT_PROFILE_IMAGE);
            return { uri: defaultImage };
          }}
        />
        <View>
          <Text style={styles.postUsername}>{item.username}</Text>
          <Text style={styles.postTimestamp}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      </View>
      <Text style={styles.postContent}>{item.content}</Text>
      {item.image && (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      )}
      {item.isTwitter && (
        <View style={styles.twitterActions}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#8899A6"
            value={commentText[item.id] || ''}
            onChangeText={text => setCommentText({ ...commentText, [post.id]: text })}
          />
          <TouchableOpacity style={styles.actionButton} onPress={() => handleComment(item)}>
            <Text style={styles.actionButtonText}>Comment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
            <Text style={styles.actionButtonText}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleUnlike(item)}>
            <Text style={styles.actionButtonText}>Unlike</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleViewReplies(item)}>
            <Text style={styles.actionButtonText}>View Replies</Text>
          </TouchableOpacity>
        </View>
      )}
      {showReplies[item.id] && (
        <View style={styles.repliesContainer}>
          <Text style={styles.repliesTitle}>Replies</Text>
          {showReplies[item.id].map(reply => (
            <View key={reply.id} style={styles.replyTile}>
              <Text style={styles.replyUsername}>{reply.username}</Text>
              <Text style={styles.replyContent}>{reply.content}</Text>
              <Text style={styles.replyTimestamp}>
                {new Date(reply.timestamp).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleDrawer}>
          <Image
            source={{ uri: userImage }}
            style={styles.headerProfileImage}
            onError={async () => {
              const defaultImage = await assetToBase64(DEFAULT_PROFILE_IMAGE);
              setUserImage(defaultImage);
            }}
          />
        </TouchableOpacity>
        {!twitterUserId && (
          <TouchableOpacity style={styles.twitterLoginButton} onPress={handleTwitterLogin}>
            <Text style={styles.twitterLoginButtonText}>Log in to Twitter</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.feedContainer}>
        {loading ? (
          <Text style={styles.text}>Loading posts...</Text>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.text}>No posts found</Text>}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
      <CustomDrawer
        visible={drawerVisible}
        toggleDrawer={toggleDrawer}
        navigation={navigation}
        email={email}
      />
    </View>
  );
};

// LoginScreen (unchanged)
const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const result = await AuthService.login(email, password);
      if (result) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home', params: { email: result.user.email } }],
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8899A6"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8899A6"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.link}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// SignupScreen (unchanged)
const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [defaultImage, setDefaultImage] = useState('');

  useEffect(() => {
    const loadDefaultImage = async () => {
      const base64Image = await assetToBase64(DEFAULT_PROFILE_IMAGE);
      setDefaultImage(base64Image);
    };
    loadDefaultImage();
  }, []);

  const handleImagePick = async () => {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      if (Object.values(granted).every(status => status === PermissionsAndroid.RESULTS.GRANTED)) {
        ImagePicker.launchImageLibrary(
          { mediaType: 'photo', includeBase64: true, maxHeight: 200, maxWidth: 200 },
          async (response) => {
            if (response.didCancel) {
              console.log('User cancelled image picker');
            } else if (response.errorCode) {
              Alert.alert('Error', 'Image selection failed');
            } else if (response.assets && response.assets[0].uri) {
              const base64Image = await imageToBase64(response.assets[0].uri);
              setImage(base64Image);
            }
          }
        );
      } else {
        Alert.alert('Error', 'Permissions not granted');
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !name || !username || !phone || !dateOfBirth) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      const finalImage = image || (await assetToBase64(DEFAULT_PROFILE_IMAGE));
      const success = await AuthService.signup({
        email,
        password,
        name,
        username,
        phone,
        image: finalImage,
        dateOfBirth: dateOfBirth.toISOString(),
      });
      if (success) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home', params: { email } }],
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Signup failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
          <Image
            source={{ uri: image || defaultImage }}
            style={styles.profileImage}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#8899A6"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#8899A6"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8899A6"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#8899A6"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8899A6"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>
            {dateOfBirth ? dateOfBirth.toDateString() : 'Select Date of Birth'}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dateOfBirth || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>Sign up</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// EditProfileScreen (unchanged)
const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation, route }) => {
  const { email } = route.params;
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [image, setImage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [defaultImage, setDefaultImage] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const users = await AuthService.getAllUsers();
        const userData = users.find(u => u.email === email);
        if (userData) {
          setUser(userData);
          setName(userData.name || '');
          setUsername(userData.username || '');
          setPhone(userData.phone || '');
          setDateOfBirth(userData.dateOfBirth ? new Date(userData.dateOfBirth) : null);
          setImage(userData.image || '');
          const base64Image = await assetToBase64(DEFAULT_PROFILE_IMAGE);
          setDefaultImage(base64Image);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load user data');
      }
    };
    loadUser();
  }, [email]);

  const handleImagePick = async () => {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      if (Object.values(granted).every(status => status === PermissionsAndroid.RESULTS.GRANTED)) {
        ImagePicker.launchImageLibrary(
          { mediaType: 'photo', includeBase64: true, maxHeight: 200, maxWidth: 200 },
          async (response) => {
            if (response.didCancel) {
              console.log('User cancelled image picker');
            } else if (response.errorCode) {
              Alert.alert('Error', 'Image selection failed');
            } else if (response.assets && response.assets[0].uri) {
              const base64Image = await imageToBase64(response.assets[0].uri);
              setImage(base64Image);
            }
          }
        );
      } else {
        Alert.alert('Error', 'Permissions not granted');
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const finalImage = image || (await assetToBase64(DEFAULT_PROFILE_IMAGE));
      const updatedUser = await AuthService.updateProfile({
        email: user.email,
        name,
        username,
        phone,
        dateOfBirth: dateOfBirth?.toISOString() || '',
        image: finalImage,
      });
      setUser(updatedUser);
      Alert.alert('Success', 'Profile updated');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Update failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Profile Image</Text>
        <TouchableOpacity style={styles.imageButton} onPress={handleImagePick}>
          <Image
            source={{ uri: image || defaultImage }}
            style={styles.profileImage}
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#8899A6"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#8899A6"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#8899A6"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>
            {dateOfBirth ? dateOfBirth.toDateString() : 'Select Date of Birth'}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dateOfBirth || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// UsersScreen (unchanged)
const UsersScreen: React.FC<UsersScreenProps> = ({ navigation }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userList = await AuthService.getAllUsers();
        setUsers(userList);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <Image
        source={{ uri: item.image || '' }}
        style={styles.userImage}
        onError={async () => {
          const defaultImage = await assetToBase64(DEFAULT_PROFILE_IMAGE);
          return { uri: defaultImage };
        }}
      />
      <Text style={styles.userText}>Email: {item.email}</Text>
      <Text style={styles.userText}>Username: {item.username}</Text>
      <Text style={styles.userText}>Name: {item.name}</Text>
      <Text style={styles.userText}>Phone: {item.phone}</Text>
      <Text style={styles.userText}>
        Date of Birth: {item.dateOfBirth ? new Date(item.dateOfBirth).toDateString() : 'N/A'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Users</Text>
      <View style={styles.card}>
        {loading ? (
          <Text style={styles.text}>Loading...</Text>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={(item) => item.email}
            ListEmptyComponent={<Text style={styles.text}>No users found</Text>}
            contentContainerStyle={styles.listContent}
          />
        )}
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonSecondaryText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15202B',
    paddingHorizontal: 0,
    paddingTop: 24,
    justifyContent: 'center',
  },
  header: {
    height: Dimensions.get('window').height * 0.12,
    backgroundColor: '#192734',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#38444D',
  },
  headerProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#253341',
    marginLeft: 0,
  },
  twitterLoginButton: {
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  twitterLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  feedContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 40,
  },
  postTile: {
    backgroundColor: '#192734',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 0,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUserImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#253341',
  },
  postUsername: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  postTimestamp: {
    color: '#8899A6',
    fontSize: 12,
  },
  postContent: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  twitterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#38444D',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 8,
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 12,
    paddingLeft: 16,
  },
  repliesTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  replyTile: {
    backgroundColor: '#253341',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  replyUsername: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  replyContent: {
    color: '#FFFFFF',
    fontSize: 14,
    marginVertical: 4,
  },
  replyTimestamp: {
    color: '#8899A6',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#192734',
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#38444D',
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#1DA1F2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonSecondaryText: {
    color: '#1DA1F2',
    fontSize: 16,
    fontWeight: '500',
  },
  link: {
    color: '#1DA1F2',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  userCard: {
    backgroundColor: '#253341',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  text: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 8,
  },
  imageButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#253341',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#253341',
  },
  userImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: Dimensions.get('window').width,
    flexDirection: 'row',
    zIndex: 1000,
  },
  drawerContent: {
    width: Dimensions.get('window').width * 0.5,
    backgroundColor: '#192734',
    padding: 20,
    justifyContent: 'flex-start',
  },
  drawerItem: {
    fontSize: 18,
    color: '#FFFFFF',
    marginVertical: 15,
    fontWeight: '500',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default function App() {

  
 useEffect(() => {
    // Handle deep links
    const handleDeepLink = (event: { url: string }) => {
      console.log('Deep link received:', event.url);
      if (event.url.startsWith('mylivefeed://callback')) {
        console.log('Twitter OAuth redirect:', event.url);
        // Parse URL parameters
        try {
          const url = new URL(event.url);
          // const code = url.searchParams.get('code');
          // const state = url.searchParams.get('state');
          // console.log('OAuth parameters:', { code, state });
          // if (!code) {
          //   console.warn('No OAuth code in redirect URL');
          // }
        } catch (error) {
          console.error('Error parsing deep link URL:', error);
        }
      }
    };

    // Add event listener for incoming deep links
    Linking.addEventListener('url', handleDeepLink);

    // Check for initial URL
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('Initial deep link:', url);
        if (url.startsWith('mylivefeed://callback')) {
          console.log('Initial Twitter OAuth redirect:', url);
          // Parse URL parameters
          try {
            const parsedUrl = new URL(url);
            // const code = parsedUrl.searchParams.get('code');
            // const state = parsedUrl.searchParams.get('state');
            // console.log('Initial OAuth parameters:', { code, state });
            // if (!code) {
            //   console.warn('No OAuth code in initial redirect URL');
            // }
          } catch (error) {
            console.error('Error parsing initial deep link URL:', error);
          }
        }
      }
    });

    // Cleanup listener on unmount
    return () => {
      Linking.removeAllListeners('url');
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor="#15202B" barStyle="light-content" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Users" component={UsersScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}