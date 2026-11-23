import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA4kspl_j_a88UggqKXE8WjwUHYPO8sk_Kw",
  authDomain: "pettracker-36a9b.firebaseapp.com",
  projectId: "pettracker-36a9b",
  storageBucket: "pettracker-36a9b.firebasestorage.app",
  messagingSenderId: "728218343869",
  appId: "1:728218343869:web:d07c001d50fe270ca25ad4"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar autenticación
const auth = getAuth(app);

// Exportar funciones
export {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
};
