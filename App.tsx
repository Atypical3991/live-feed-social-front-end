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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { TwitterApi } from 'twitter-api-v2';
import {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  TWITTER_REDIRECT_URI,
} from '@env';


console.log('Environment variables:', {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  TWITTER_REDIRECT_URI,
});

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

// AuthService with API calls
const AuthService = {
  async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string } | null> {
    try {
      const response = await fetch('http://10.0.2.2:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem('accessToken', data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
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
      const response = await fetch('http://10.0.2.2:5000/api/signup', {
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
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      const response = await fetch('http://10.0.2.2:5000/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
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
      const response = await AuthService.makeAuthenticatedRequest('http://10.0.2.2:5000/api/profile', {
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
      const response = await AuthService.makeAuthenticatedRequest('http://10.0.2.2:5000/api/profile', {
        method: 'DELETE',
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error((await response.json()).message || 'Network error');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  },
  async logout(): Promise<void> {
    try {
      const response = await AuthService.makeAuthenticatedRequest('http://10.0.2.2:5000/api/logout', {
        method: 'POST',
      });
      if (response.ok) {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
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
      const response = await AuthService.makeAuthenticatedRequest('http://10.0.2.2:5000/api/users', {
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
  async initiateTwitterAuth(): Promise<string> {
    const twitterClient = new TwitterApi({
      clientId: TWITTER_CLIENT_ID,
      clientSecret: TWITTER_CLIENT_SECRET,
    });
    const authLink = twitterClient.generateOAuth2AuthLink(TWITTER_REDIRECT_URI, {
      scope: ['tweet.read', 'tweet.write', 'users.read', 'like.read', 'like.write'],
    });
    await AsyncStorage.setItem('twitterCodeVerifier', authLink.codeVerifier);
    return authLink.url;
  },
  async completeTwitterAuth(code: string): Promise<string | null> {
    try {
      const codeVerifier = await AsyncStorage.getItem('twitterCodeVerifier');
      if (!codeVerifier) {
        throw new Error('No code verifier found');
      }
      const twitterClient = new TwitterApi({
        clientId: TWITTER_CLIENT_ID,
        clientSecret: TWITTER_CLIENT_SECRET,
      });
      const { accessToken } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: TWITTER_REDIRECT_URI,
      });
      await AsyncStorage.setItem('twitterAccessToken', accessToken);
      return accessToken;
    } catch (error) {
      console.error('Twitter auth error:', error);
      return null;
    }
  },
  async fetchTwitterFeed(accessToken: string, query: string = 'from:username'): Promise<Post[]> {
    try {
      const twitterClient = new TwitterApi(accessToken);
      const tweets = await twitterClient.v2.search(query, { max_results: 10 });
      const posts: Post[] = [];
      for await (const tweet of tweets) {
        posts.push({
          id: tweet.id,
          username: tweet.author_id || 'Unknown',
          content: tweet.text,
          timestamp: tweet.created_at || new Date().toISOString(),
          isTwitter: true,
          twitterId: tweet.id,
          conversationId: tweet.conversation_id,
        });
      }
      return posts;
    } catch (error) {
      console.error('Fetch Twitter feed error:', error);
      return [];
    }
  },
  async postTwitterComment(accessToken: string, tweetId: string, comment: string): Promise<boolean> {
    try {
      const twitterClient = new TwitterApi(accessToken);
      await twitterClient.v2.tweet({
        text: comment,
        reply: { in_reply_to_tweet_id: tweetId },
      });
      return true;
    } catch (error) {
      console.error('Post Twitter comment error:', error);
      return false;
    }
  },
  async likeTwitterPost(accessToken: string, userId: string, tweetId: string): Promise<boolean> {
    try {
      const twitterClient = new TwitterApi(accessToken);
      await twitterClient.v2.like(userId, tweetId);
      return true;
    } catch (error) {
      console.error('Like Twitter post error:', error);
      return false;
    }
  },
  async unlikeTwitterPost(accessToken: string, userId: string, tweetId: string): Promise<boolean> {
    try {
      const twitterClient = new TwitterApi(accessToken);
      await twitterClient.v2.unlike(userId, tweetId);
      return true;
    } catch (error) {
      console.error('Unlike Twitter post error:', error);
      return false;
    }
  },
  async fetchTwitterReplies(accessToken: string, conversationId: string): Promise<Post[]> {
    try {
      const twitterClient = new TwitterApi(accessToken);
      const replies = await twitterClient.v2.search(`conversation_id:${conversationId}`, { max_results: 10 });
      const posts: Post[] = [];
      for await (const reply of replies) {
        posts.push({
          id: reply.id,
          username: reply.author_id || 'Unknown',
          content: reply.text,
          timestamp: reply.created_at || new Date().toISOString(),
          isTwitter: true,
          twitterId: reply.id,
        });
      }
      return posts;
    } catch (error) {
      console.error('Fetch Twitter replies error:', error);
      return [];
    }
  },
};

// Custom Drawer Component
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
  const [twitterAccessToken, setTwitterAccessToken] = useState<string | null>(null);
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
      const token = await AsyncStorage.getItem('twitterAccessToken');
      if (token) {
        setTwitterAccessToken(token);
        const twitterClient = new TwitterApi(token);
        const user = await twitterClient.v2.me();
        setTwitterUserId(user.data.id);
      }
    };
    checkTwitterAuth();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const localPosts = await AuthService.getPosts();
      let twitterPosts: Post[] = [];
      if (twitterAccessToken) {
        twitterPosts = await AuthService.fetchTwitterFeed(twitterAccessToken, 'from:elonmusk');
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
  }, [twitterAccessToken]);

  const handleTwitterLogin = async () => {
    try {
      const authUrl = await AuthService.initiateTwitterAuth();
      Linking.openURL(authUrl);
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate Twitter login');
    }
  };

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = new URL(event.url);
      const code = url.searchParams.get('code');
      if (code) {
        AuthService.completeTwitterAuth(code).then(token => {
          if (token) {
            setTwitterAccessToken(token);
            const twitterClient = new TwitterApi(token);
            twitterClient.v2.me().then(user => {
              setTwitterUserId(user.data.id);
            });
          }
        });
      }
    };
    Linking.addEventListener('url', handleDeepLink);
    return () => {
      Linking.removeAllListeners('url');
    };
  }, []);

  const handleComment = async (post: Post) => {
    if (!twitterAccessToken || !post.twitterId || !commentText[post.id]) {
      Alert.alert('Error', 'Please log in to Twitter and enter a comment');
      return;
    }
    const success = await AuthService.postTwitterComment(twitterAccessToken, post.twitterId, commentText[post.id]);
    if (success) {
      Alert.alert('Success', 'Comment posted');
      setCommentText({ ...commentText, [post.id]: '' });
      await fetchPosts(); // Reload feed
    } else {
      Alert.alert('Error', 'Failed to post comment');
    }
  };

  const handleLike = async (post: Post) => {
    if (!twitterAccessToken || !twitterUserId || !post.twitterId) {
      Alert.alert('Error', 'Please log in to Twitter');
      return;
    }
    const success = await AuthService.likeTwitterPost(twitterAccessToken, twitterUserId, post.twitterId);
    if (success) {
      Alert.alert('Success', 'Post liked');
      await fetchPosts(); // Reload feed
    } else {
      Alert.alert('Error', 'Failed to like post');
    }
  };

  const handleUnlike = async (post: Post) => {
    if (!twitterAccessToken || !twitterUserId || !post.twitterId) {
      Alert.alert('Error', 'Please log in to Twitter');
      return;
    }
    const success = await AuthService.unlikeTwitterPost(twitterAccessToken, twitterUserId, post.twitterId);
    if (success) {
      Alert.alert('Success', 'Post unliked');
      await fetchPosts(); // Reload feed
    } else {
      Alert.alert('Error', 'Failed to unlike post');
    }
  };

  const handleViewReplies = async (post: Post) => {
    if (!twitterAccessToken || !post.conversationId) {
      Alert.alert('Error', 'Please log in to Twitter or select a Twitter post');
      return;
    }
    const replies = await AuthService.fetchTwitterReplies(twitterAccessToken, post.conversationId);
    setShowReplies({ ...showReplies, [post.id]: replies });
    await fetchPosts(); // Reload feed
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
            onChangeText={text => setCommentText({ ...commentText, [item.id]: text })}
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
        {!twitterAccessToken && (
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

// Other components (LoginScreen, SignupScreen, EditProfileScreen, UsersScreen) remain unchanged
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