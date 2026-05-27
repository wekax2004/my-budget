import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '../components/Toast';

const DataContext = createContext(null);

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Data states
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [income, setIncome] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [recurringIncome, setRecurringIncome] = useState([]);
  const [savings, setSavings] = useState([]);
  const [cards, setCards] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  // App settings
  const [currentYearMonth, setCurrentYearMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dateFilter, setDateFilter] = useState({ type: 'month', value: new Date().toISOString().slice(0, 7) });

  const isDateInFilter = (dateStrOrObj) => {
    if (!dateStrOrObj) return false;
    const dateObj = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : (dateStrOrObj.toDate ? dateStrOrObj.toDate() : dateStrOrObj);
    if (isNaN(dateObj)) return false;
    
    if (dateFilter.type === 'month') {
      return dateObj.toISOString().slice(0, 7) === dateFilter.value;
    } else if (dateFilter.type === 'custom') {
      const d = dateObj.toISOString().slice(0, 10);
      return d >= dateFilter.start && d <= dateFilter.end;
    }
    return true;
  };
  const [isLocked, setIsLocked] = useState(false);
  const { toasts, showToast } = useToast();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const locked = localStorage.getItem('appLocked') === 'true';
    if (locked) setIsLocked(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubs = [];

    unsubs.push(onSnapshot(query(collection(db, "categories"), where("allowedUsers", "array-contains", user.email)), s => {
      setCats(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoading(false);
    }));

    unsubs.push(onSnapshot(query(collection(db, "transactions"), where("allowedUsers", "array-contains", user.email), orderBy("date", "desc"), limit(150)), s => {
      setTxs(s.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, jsDate: data.date?.toDate() || new Date() };
      }));
      setDataLoading(false);
    }));

    unsubs.push(onSnapshot(query(collection(db, "income"), where("uid", "==", user.uid), orderBy("date", "desc")), s => {
      setIncome(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(query(collection(db, "recurring"), where("uid", "==", user.uid)), s => {
      setRecurring(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(query(collection(db, "recurring_income"), where("uid", "==", user.uid)), s => {
      setRecurringIncome(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(query(collection(db, "savings"), where("owner", "==", user.email)), s => {
      setSavings(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(query(collection(db, "giftcards"), where("owner", "==", user.email)), s => {
      setCards(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(query(collection(db, "credit_cards"), where("owner", "==", user.email)), s => {
      setCreditCards(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(query(collection(db, "shopping_list"), where("uid", "==", user.uid)), s => {
      const items = s.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setShoppingList(items);
    }));

    const checkAndCreateDefaults = async (u) => {
      const q = query(collection(db, "categories"), where("allowedUsers", "array-contains", u.email));
      const snap = await getDocs(q);
      if (snap.empty) {
        const defaults = [
          { name: 'אוכל וסופר', icon: 'shopping-cart', color: '#EF4444', budget: 2000 },
          { name: 'בית', icon: 'home', color: '#3B82F6', budget: 4000 },
          { name: 'רכב', icon: 'car', color: '#F59E0B', budget: 1000 },
          { name: 'קניות', icon: 'shopping-bag', color: '#8B5CF6', budget: 500 },
          { name: 'אחר', icon: 'help-circle', color: '#6B7280', budget: 200 }
        ];
        const batch = writeBatch(db);
        defaults.forEach(d => { batch.set(doc(collection(db, "categories")), { ...d, uid: u.uid, allowedUsers: [u.email] }); });
        await batch.commit();
        showToast('קטגוריות ברירת מחדל נוצרו!', 'success');
      }
    };

    checkAndCreateDefaults(user);

    return () => unsubs.forEach(u => u());
  }, [user]);

  const value = {
    user, authLoading,
    cats, txs, income, recurring, recurringIncome, savings, cards, creditCards, shoppingList, dataLoading,
    currentYearMonth, setCurrentYearMonth,
    dateFilter, setDateFilter, isDateInFilter,
    isLocked, setIsLocked,
    toasts, showToast
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
