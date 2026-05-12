// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAYa_xZXYok5YxD4qKamAidS0ohTgx1FPg",
  authDomain: "inventario-aya.firebaseapp.com",
  projectId: "inventario-aya",
  storageBucket: "inventario-aya.firebasestorage.app",
  messagingSenderId: "501631962044",
  appId: "1:501631962044:web:4ea3c8c5f196e54b2af9b9",
  databaseURL: "https://inventario-aya-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services for use in other modules
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, db, rtdb };
