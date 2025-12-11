import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace with your specific Firebase project configuration
// You can find these in the Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyDRhSUch-8dCM9zLBcK_hWdX5-b1sqGiWE",
  authDomain: "beedogpage.firebaseapp.com",
  projectId: "beedogpage",
  storageBucket: "beedogpage.firebasestorage.app",
  messagingSenderId: "921378190220",
  appId: "1:921378190220:web:8b8019009084ab5da8dca9",
  measurementId: "G-QRHF8Y2N73"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);