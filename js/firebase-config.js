// Import fungsi inti dari Firebase SDK (menggunakan CDN agar tidak perlu install Node.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// TODO: GANTI DENGAN CONFIG DARI FIREBASE CONSOLE ANDA
const firebaseConfig = {
  apiKey: "AIzaSyCeX0xMhV9IFFDpaN5Lv4qyShSzVlxTJEA",
  authDomain: "curatedbycabbit.firebaseapp.com",
  databaseURL: "https://curatedbycabbit-default-rtdb.firebaseio.com",
  projectId: "curatedbycabbit",
  storageBucket: "curatedbycabbit.firebasestorage.app",
  messagingSenderId: "475274795268",
  appId: "1:475274795268:web:c8585cf73c02bea5f2d851",
  measurementId: "G-68BKJJGBXP" // ID untuk Google Analytics
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app); // Otomatis mencatat pageview

// Export agar bisa dipakai di file lain
export { app, auth, db, analytics };