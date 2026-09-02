import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    google?: any;
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Provider with Spreadsheets & Profile Scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.setCustomParameters({
  prompt: 'select_account',
});

const ACCESS_TOKEN_KEY = 'addarasa_google_access_token';
const USER_EMAIL_KEY = 'addarasa_google_user_email';
const USER_NAME_KEY = 'addarasa_google_user_name';
const TOKEN_TIME_KEY = 'addarasa_google_token_time';
const WEBAPP_URL_KEY = 'addarasa_sheets_webapp_url';

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
})();

export const DEFAULT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzdMA2xIoOwR4QMveYghf9bqXAI1CYMLxrHeQzff3J9R0J4dQ4GV8NJQuImSpNXBqeU/exec';

export const getCurrentDomain = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return 'localhost';
};

export const getSavedWebAppUrl = (): string => {
  try {
    return localStorage.getItem(WEBAPP_URL_KEY) || DEFAULT_WEBAPP_URL;
  } catch {
    return DEFAULT_WEBAPP_URL;
  }
};

export const saveWebAppUrl = (url: string) => {
  try {
    if (url) {
      localStorage.setItem(WEBAPP_URL_KEY, url);
    } else {
      localStorage.removeItem(WEBAPP_URL_KEY);
    }
  } catch {
    // ignore
  }
};

/**
 * Initialize auth state listener and restore cached access token
 */
export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser | { email?: string; displayName?: string }, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check if we already have a cached token in localStorage
  const savedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const savedEmail = localStorage.getItem(USER_EMAIL_KEY);
  const savedName = localStorage.getItem(USER_NAME_KEY);

  if (savedToken && savedEmail) {
    cachedAccessToken = savedToken;
    if (onAuthSuccess) {
      onAuthSuccess(
        { email: savedEmail, displayName: savedName || 'Google User' },
        savedToken
      );
    }
  }

  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      const currentToken = cachedAccessToken || localStorage.getItem(ACCESS_TOKEN_KEY);
      if (currentToken) {
        if (onAuthSuccess) onAuthSuccess(user, currentToken);
      }
    } else {
      if (!localStorage.getItem(ACCESS_TOKEN_KEY) && !isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Google Identity Services (GSI) Token Client Sign-In
 * Bypasses Firebase Authorized Domain check by authenticating directly with Google OAuth 2.0
 */
export const signInWithGSI = async (): Promise<{
  user: { email?: string | null; displayName?: string | null };
  accessToken: string;
}> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services belum dimuat. Mohon tunggu sejenak atau muat ulang halaman.'));
      return;
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      reject(new Error('OAuth Client ID tidak ditemukan dalam konfigurasi aplikasi.'));
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        prompt: 'consent',
        callback: async (resp: any) => {
          if (resp.error) {
            reject(new Error(`Gagal otentikasi Google (${resp.error}): ${resp.error_description || ''}`));
            return;
          }

          const token = resp.access_token;
          if (!token) {
            reject(new Error('Token akses tidak diterima dari Google.'));
            return;
          }

          cachedAccessToken = token;
          let userEmail = 'Akun Google Terhubung';
          let userName = 'Google User';

          // Try fetching user profile info
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (userRes.ok) {
              const userInfo = await userRes.json();
              if (userInfo.email) userEmail = userInfo.email;
              if (userInfo.name) userName = userInfo.name;
            }
          } catch {
            // ignore profile fetch error
          }

          try {
            localStorage.setItem(ACCESS_TOKEN_KEY, token);
            localStorage.setItem(USER_EMAIL_KEY, userEmail);
            localStorage.setItem(USER_NAME_KEY, userName);
            localStorage.setItem(TOKEN_TIME_KEY, Date.now().toString());
          } catch {
            // ignore
          }

          resolve({
            user: { email: userEmail, displayName: userName },
            accessToken: token,
          });
        },
      });

      tokenClient.requestAccessToken();
    } catch (err: any) {
      reject(new Error(err?.message || 'Gagal memulai koneksi Google Identity Services.'));
    }
  });
};

/**
 * Interactive Sign-In via Pop-up window with smart GSI / Firebase fallback
 */
export const googleSignIn = async (): Promise<{
  user: { email?: string | null; displayName?: string | null };
  accessToken: string;
} | null> => {
  isSigningIn = true;
  const currentDomain = getCurrentDomain();

  // 1. Try Google Identity Services (GSI) first if loaded
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    try {
      const gsiResult = await signInWithGSI();
      return gsiResult;
    } catch (gsiErr: any) {
      console.warn('GSI attempt result/fallback to Firebase:', gsiErr?.message);
    }
  }

  // 2. Try Firebase Auth popup
  try {
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error(
        'Gagal mendapatkan token akses Google Sheets dari pop-up. Pastikan Anda menyetujui izin akses spreadsheet.'
      );
    }

    cachedAccessToken = token;
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      if (result.user.email) localStorage.setItem(USER_EMAIL_KEY, result.user.email);
      if (result.user.displayName) localStorage.setItem(USER_NAME_KEY, result.user.displayName);
      localStorage.setItem(TOKEN_TIME_KEY, Date.now().toString());
    } catch {
      // ignore
    }

    return {
      user: {
        email: result.user.email,
        displayName: result.user.displayName,
      },
      accessToken: token,
    };
  } catch (error: any) {
    console.error('Google Popup Sign-in Error:', error);

    if (error?.code === 'auth/popup-blocked') {
      throw new Error(
        'Jendela pop-up login diblokir oleh browser. Silakan izinkan pop-up di bilah URL browser Anda lalu klik Hubungkan kembali.'
      );
    } else if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      throw new Error('Jendela login pop-up ditutup sebelum otentikasi selesai.');
    } else if (error?.code === 'auth/unauthorized-domain') {
      throw new Error(
        `Domain [${currentDomain}] belum terdaftar di Firebase Authorized Domains. Gunakan metode Google Apps Script Web App (bebas domain) atau tambahkan domain ini di Firebase Console.`
      );
    } else if (error?.code === 'auth/network-request-failed') {
      throw new Error('Koneksi internet bermasalah atau gagal menghubungi server Google.');
    }

    throw new Error(error?.message || 'Gagal login dengan Google Pop-up.');
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current stored Google OAuth Access Token
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const saved = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (saved) {
      cachedAccessToken = saved;
      return saved;
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * Manually set or update access token
 */
export const setAccessToken = (token: string | null, email?: string) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      if (email) localStorage.setItem(USER_EMAIL_KEY, email);
      localStorage.setItem(TOKEN_TIME_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
      localStorage.removeItem(USER_NAME_KEY);
      localStorage.removeItem(TOKEN_TIME_KEY);
    }
  } catch {
    // ignore
  }
};

/**
 * Logout and clear token and credentials
 */
export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
  setAccessToken(null);
};
