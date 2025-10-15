import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBQjIjpNYIUAnvFp1rK7agRNRWjxcee4BY",
    authDomain: "rychlopocty.firebaseapp.com",
    projectId: "rychlopocty",
    storageBucket: "rychlopocty.firebasestorage.app",
    messagingSenderId: "521437849587",
    appId: "1:521437849587:web:849bac388f1eddb8351486",
    measurementId: "G-PM6QYYD13L",
    databaseURL: "https://rychlopocty-default-rtdb.europe-west1.firebasedatabase.app"
};

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const rtdb = getDatabase(firebaseApp);