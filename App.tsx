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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RNFS from 'react-native-fs';
import { Image as RNImage } from 'react-native';

// Define navigation param list
type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Home: { email: string };
  EditProfile: { email: string };
  Users: undefined;
  Feed: { email: string };
};

// Define screen props
type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
type SignupScreenProps = NativeStackScreenProps<RootStackParamList, 'Signup'>;
type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
type EditProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
type UsersScreenProps = NativeStackScreenProps<RootStackParamList, 'Users'>;
type FeedScreenProps = NativeStackScreenProps<RootStackParamList, 'Feed'>;

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
};

// Default profile image
const DEFAULT_PROFILE_IMAGE = require('./assets/default-avatar-icon-of-social-media-user-vector.jpg');

// Utility function to convert image to base64 with mime type
const imageToBase64 = async (imagePath: string): Promise<string> => {
  try {
    const extension = imagePath.split('.').pop()?.toLowerCase();
    let mimeType = 'image/jpeg';
    if (extension === 'png') mimeType = 'image/png';
    else if (extension === 'gif') mimeType = 'image/gif';
    else if (extension === ' jpg') mimeType = 'image/jpg';

    const base64String = await RNFS.readFile(imagePath, 'base64');
    return `data:${mimeType};base64,${base64String}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return '';
  }
};

// Convert asset to base64
const assetToBase64 = async (asset: any): Promise<string> => {
  try {
    // Resolve asset source to get URI
    const assetSource = RNImage.resolveAssetSource(asset);
    // console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ assetSource")
    // console.log(assetSource)
    // if (!assetSource || !assetSource.uri) {
    //   throw new Error('Unable to resolve asset source');
    // }
    // return await imageToBase64(assetSource.uri);
    return await imageToBase64('/Users/biplabdholey/Documents/Projects/AuthApp/assets/default-avatar-icon-of-social-media-user-vector.jpg')
  } catch (error) {
    console.error('Error converting asset to base64:', error);
    // Fallback to a hardcoded base64 string or empty string
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
      const response = await AuthService.makeAuthenticatedRequest('http://10.0.2.2:5000/api/posts', {
        method: 'GET',
      });
      const data = await response.json();
      if (response.ok) {
        return data.posts;
      }
      throw new Error(data.message || 'Network error');
    } catch (error) {
      console.error('Get posts error:', error);
      throw error;
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
          {image ? (
            <Image source={{ uri: image }} style={styles.profileImage} />
          ) : (
            <Image source={DEFAULT_PROFILE_IMAGE} style={styles.profileImage} />
          )}
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

const FeedScreen: React.FC<FeedScreenProps> = ({ route }) => {
  const { email } = route.params;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const postList = await AuthService.getPosts();
        setPosts(postList);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to fetch posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

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
    </View>
  );

  return (
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
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  const { email } = route.params;
  const [userImage, setUserImage] = useState<string>('');
  const [drawerVisible, setDrawerVisible] = useState(false);

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

  const toggleDrawer = () => {
    setDrawerVisible(!drawerVisible);
  };

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
      </View>
      <FeedScreen route={{ params: { email } }} navigation={navigation} />
      <CustomDrawer
        visible={drawerVisible}
        toggleDrawer={toggleDrawer}
        navigation={navigation}
        email={email}
      />
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
          {image ? (
            <Image source={{ uri: image }} style={styles.profileImage} />
          ) : (
            <Image source={DEFAULT_PROFILE_IMAGE} style={styles.profileImage} />
          )}
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
  },
  header: {
    height: Dimensions.get('window').height * 0.1,
    backgroundColor: '#192734',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#38444D',
  },
  headerProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#253341',
  },
  feedContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  postTile: {
    backgroundColor: '#192734',
    borderRadius: 8,
    padding: 12,
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
  card: {
    backgroundColor: '#192734',
    borderRadius: 12,
    padding: 16,
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
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#38444D',
    paddingVertical: 8,
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
  emailText: {
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  imageButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#253341',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  profileImageContainer: {
    alignItems: 'center',
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
          <Stack.Screen name="Feed" component={FeedScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}