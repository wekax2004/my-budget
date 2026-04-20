import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB43p2CQBgAfhs1pDS9nVBM2o5Ty4-3aeU",
  authDomain: "expensetrackerpro-d216d.firebaseapp.com",
  projectId: "expensetrackerpro-d216d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
