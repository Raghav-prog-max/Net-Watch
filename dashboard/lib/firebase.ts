import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBlVkmlNyZ7J80Ao9z1az9F556x84VxV6E",
  authDomain: "netwatch-c1bc6.firebaseapp.com",
  projectId: "netwatch-c1bc6",
  storageBucket: "netwatch-c1bc6.firebasestorage.app",
  messagingSenderId: "441120396044",
  appId: "1:441120396044:web:90d35aed9ee72f6b232f29",
  measurementId: "G-F95YQH6KC2"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
