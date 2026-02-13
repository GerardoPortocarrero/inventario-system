// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAYa_xZXYok5YxD4qKamAidS0ohTgx1FPg",
  authDomain: "inventario-aya.firebaseapp.com",
  projectId: "inventario-aya",
  storageBucket: "inventario-aya.firebasestorage.app",
  messagingSenderId: "501631962044",
  appId: "1:501631962044:web:4ea3c8c5f196e54b2af9b9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase app for use in other modules
export { app };

// TODO: Export other Firebase services you plan to use, e.g.,
// import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore";
// const auth = getAuth(app);
// const db = getFirestore(app);
// export { auth, db };
