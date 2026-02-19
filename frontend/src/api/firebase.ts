// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyAYa_xZXYok5YxD4qKamAidS0ohTgx1FPg",
  authDomain: "inventario-aya.firebaseapp.com",
  projectId: "inventario-aya",
  storageBucket: "inventario-aya.firebasestorage.app",
  messagingSenderId: "501631962044",
  appId: "1:501631962044:web:4ea3c8c5f196e54b2af9b9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services for use in other modules
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
