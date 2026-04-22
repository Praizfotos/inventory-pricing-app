import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAvsqS7MzHKFjLU3WeeWFljfcsrUumn6Gk",
  authDomain: "inventory-app-31f06.firebaseapp.com",
  projectId: "inventory-app-31f06",
  storageBucket: "inventory-app-31f06.firebasestorage.app",
  messagingSenderId: "155610951063",
  appId: "1:155610951063:web:14c42a82daa84eb4cd28d2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
