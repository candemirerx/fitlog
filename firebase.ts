// firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDPiGnm3cbwb5t1UupYkIAIH6QgompC5Xk",
  authDomain: "fitlog-8e522.firebaseapp.com",
  projectId: "fitlog-8e522",
  
  // DÜZELTİLEN KISIM BURASI:
  // Sizin oluşturduğunuz özel kova ismini tam olarak yazıyoruz.
  // Başına 'gs://' eklemek, özel oluşturulan kovalarda daha garanti çalışır.
  storageBucket: "gs://benim-projem-dosyalar", 
  
  messagingSenderId: "122983404430",
  appId: "1:122983404430:web:c5cde4dd9c1b79e4fe4adf"
};

// Firebase'i başlatıyoruz
const app = initializeApp(firebaseConfig);

// Servisleri dışa aktarıyoruz
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;