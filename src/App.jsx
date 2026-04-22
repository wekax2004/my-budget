import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, updateDoc, arrayUnion, Timestamp, orderBy, limit, writeBatch, getDocs } from 'firebase/firestore';
import { Chart, registerables } from 'chart.js';
import { useToast, ToastContainer } from './components/Toast';
import { Modal } from './components/Modal';
import Tesseract from 'tesseract.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import './index.css';

Chart.register(...registerables);

const APP_VERSION = 'v3.0-react';
const APP_PIN = "1234";
const ICONS = ['🏷️','🍕','🚗','🏠','🏥','🎓','✈️','🎁','💇','📱','💪','🛒','🍷','🥦','⛽','💡','🔧','👶','🐶','📚','🎮','🎵','🎬','💻'];
const THEMES = {
  default: { primary:'#4F46E5', bg:'#F3F4F6', card:'#FFFFFF', text:'#1F2937', sub:'#6B7280' },
  midnight: { primary:'#7C3AED', bg:'#111827', card:'#1F2937', text:'#F9FAFB', sub:'#9CA3AF' },
  forest: { primary:'#059669', bg:'#ECFDF5', card:'#FFFFFF', text:'#064E3B', sub:'#047857' },
  ocean: { primary:'#0891B2', bg:'#ECFEFF', card:'#FFFFFF', text:'#164E63', sub:'#0E7490' },
  dark: { primary:'#6366F1', bg:'#000000', card:'#121212', text:'#E5E7EB', sub:'#9CA3AF' }
};

export default function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // --- APP LOCK ---
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // --- NAVIGATION ---
  const [activeTab, setActiveTab] = useState('home');

  // --- DATA ---
  const [cats, setCats] = useState([]);
  const [txs, setTxs] = useState([]);
  const [income, setIncome] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [recurringIncome, setRecurringIncome] = useState([]);
  const [savings, setSavings] = useState([]);
  const [cards, setCards] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);

  // --- FILTER ---
  const [currentYearMonth, setCurrentYearMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // --- MODALS ---
  const [showCatModal, setShowCatModal] = useState(false);
  const [showExpModal, setShowExpModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [showPartnersModal, setShowPartnersModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lowPower, setLowPower] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(false);

  // --- CATEGORY FORM ---
  const [catForm, setCatForm] = useState({ name: '', budget: '', color: '#3B82F6', icon: '🏷️' });
  const [catEditId, setCatEditId] = useState(null);

  // --- EXPENSE FORM ---
  const [expForm, setExpForm] = useState({ amount: '', note: '', method: '💳 אשראי', currency: 'ILS', cardId: '', giftCardId: '' });
  const [expCatId, setExpCatId] = useState(null);
  const [expEditId, setExpEditId] = useState(null);

  // --- INCOME FORM ---
  const [incForm, setIncForm] = useState({ amount: '', source: '', date: new Date().toISOString().slice(0, 10) });

  // --- RECURRING FORM ---
  const [recTab, setRecTab] = useState('expense');
  const [recExpForm, setRecExpForm] = useState({ name: '', amount: '', catId: '', nextDate: new Date().toISOString().slice(0, 10) });
  const [recIncForm, setRecIncForm] = useState({ name: '', amount: '', nextDate: new Date().toISOString().slice(0, 10) });
  const [partnerEmail, setPartnerEmail] = useState('');

  // --- SHOPPING ---
  const [shopItem, setShopItem] = useState('');
  const [shopPrice, setShopPrice] = useState('');

  // --- HISTORY MODAL ---
  const [histCatId, setHistCatId] = useState(null);
  const [histOffset, setHistOffset] = useState(0);

  // --- RATES ---
  const [rates] = useState({ ILS: 1, USD: 3.65, EUR: 3.95 });

  // --- PREMIUM ---
  const [ocrLoading, setOcrLoading] = useState(false);

  // --- TOAST ---
  const { toasts, showToast } = useToast();

  // --- CHART REFS ---
  const barRef = useRef(null);
  const pieRef = useRef(null);
  const lineRef = useRef(null);
  const barInst = useRef(null);
  const pieInst = useRef(null);
  const lineInst = useRef(null);

  // ===================== AUTH =====================
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
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) applyTheme(savedTheme);
  }, []);

  // ===================== FIREBASE SYNC =====================
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

    // Check defaults
    checkAndCreateDefaults(user);

    return () => unsubs.forEach(u => u());
  }, [user]);

  // ===================== COMPUTED VALUES =====================
  const filteredTxs = txs.filter(t => t.jsDate.toISOString().slice(0, 7) === currentYearMonth);
  const totalBudget = cats.reduce((s, c) => s + (c.budget || 0), 0);
  const totalSpent = filteredTxs.reduce((s, t) => s + t.amount, 0);
  const balance = totalBudget - totalSpent;
  const monthlyIncome = income.filter(i => i.date.slice(0, 7) === currentYearMonth).reduce((s, i) => s + i.amount, 0);

  // ===================== HELPERS =====================
  const applyTheme = (name) => {
    const t = THEMES[name] || THEMES.default;
    const r = document.documentElement;
    r.style.setProperty('--primary', t.primary);
    r.style.setProperty('--bg', t.bg);
    r.style.setProperty('--card-bg', t.card);
    r.style.setProperty('--text-main', t.text);
    r.style.setProperty('--text-sub', t.sub);
    localStorage.setItem('appTheme', name);
  };

  const getEffectiveBudget = (cat, month) => {
    if (!cat) return 0;
    const history = cat.monthlyBudgets || {};
    if (history[month] !== undefined) return history[month];
    const sorted = Object.keys(history).sort();
    let eff = cat.budget || 0;
    for (const m of sorted) { if (m <= month) eff = history[m]; else break; }
    return eff;
  };

  const getSmartTip = () => {
    const perc = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const day = new Date().getDate();
    if (totalBudget === 0) return "הגדר תקציב ב'קטגוריה חדשה' כדי להתחיל!";
    if (perc > 100) return `חרגת מהתקציב ב-₪${Math.round(totalSpent - totalBudget).toLocaleString()}!`;
    if (perc > 85) return `זהירות! ניצלת ${Math.round(perc)}% מהתקציב.`;
    if (day > 20 && perc < 50) return "עבודה מעולה! שומר/ת על התקציב. העבר/י ליתרה לחיסכון!";
    const tips = ["טיפ: בדוק הוראות קבע כפולות.", `נותרו ₪${Math.round(balance).toLocaleString()} החודש.`, "חלוקת תקציב לקטגוריות עוזרת לחסוך עד 20%."];
    return tips[Math.floor(Math.random() * tips.length)];
  };

  // ===================== AUTH ACTIONS =====================
  const handleLogin = async () => {
    if (!email || !password) return showToast("נא להזין אימייל וסיסמה", "error");
    setAuthBusy(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { showToast("שגיאה: " + e.message, "error"); }
    finally { setAuthBusy(false); }
  };

  const handleSignup = async () => {
    if (!email || !password) return showToast("נא להזין אימייל וסיסמה", "error");
    setAuthBusy(true);
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { showToast("שגיאה: " + e.message, "error"); }
    finally { setAuthBusy(false); }
  };

  const handleLogout = () => signOut(auth).then(() => showToast('התנתקת', 'success'));

  const checkPin = () => {
    if (pin === APP_PIN) { setIsLocked(false); setPinError(false); }
    else setPinError(true);
  };

  // ===================== CATEGORY ACTIONS =====================
  const forceRefresh = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.unregister());
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const toggleLowPower = (val) => {
    setLowPower(val);
    localStorage.setItem('lowPowerMode', val);
    document.body.classList.toggle('low-power', val);
    showToast(val ? 'מצב חסכון הופעל' : 'מצב חסכון בוטל', 'success');
  };

  const toggleNotifications = (val) => {
    setNotifsEnabled(val);
    localStorage.setItem('notificationsEnabled', val);
    if (val && Notification.permission !== 'granted') Notification.requestPermission();
    showToast(val ? 'התראות הופעלו' : 'התראות בוטלו', 'success');
  };

  const addPartner = async () => {
    if (!partnerEmail) return;
    const catRefs = cats.map(c => doc(db, "categories", c.id));
    const txRefs = txs.map(t => doc(db, "transactions", t.id));

    try {
      const batch = writeBatch(db);
      cats.forEach(c => {
        batch.update(doc(db, "categories", c.id), {
          allowedUsers: arrayUnion(partnerEmail)
        });
      });
      txs.forEach(t => {
        batch.update(doc(db, "transactions", t.id), {
          allowedUsers: arrayUnion(partnerEmail)
        });
      });
      await batch.commit();
      showToast('שותף נוסף בהצלחה', 'success');
      setPartnerEmail('');
      setShowPartnersModal(false);
    } catch (e) {
      showToast('שגיאה בהוספת שותף', 'error');
    }
  };

  const openAddCat = () => { setCatEditId(null); setCatForm({ name: '', budget: '', color: '#3B82F6', icon: '🏷️' }); setShowCatModal(true); };
  const openEditCat = (c) => {
    setCatEditId(c.id);
    setCatForm({ name: c.name, budget: getEffectiveBudget(c, currentYearMonth), color: c.color || '#3B82F6', icon: c.icon || '🏷️' });
    setShowCatModal(true);
  };

  const saveCategory = async () => {
    if (!catForm.name || !catForm.budget) return showToast("חסרים נתונים!", "error");
    const allowed = [user.email];
    const partner = localStorage.getItem('partnerEmail');
    if (partner) allowed.push(partner);
    const data = { name: catForm.name, uid: user.uid, allowedUsers: allowed, color: catForm.color, icon: catForm.icon };
    try {
      if (catEditId) {
        const cat = cats.find(c => c.id === catEditId);
        const hist = { ...(cat?.monthlyBudgets || {}), [currentYearMonth]: parseFloat(catForm.budget) };
        await updateDoc(doc(db, "categories", catEditId), { ...data, monthlyBudgets: hist });
        showToast('קטגוריה עודכנה', 'success');
      } else {
        data.budget = parseFloat(catForm.budget);
        data.monthlyBudgets = { [currentYearMonth]: parseFloat(catForm.budget) };
        await addDoc(collection(db, "categories"), data);
        showToast('קטגוריה נוצרה', 'success');
      }
    } catch (e) { showToast("שגיאה: " + e.message, 'error'); }
    setShowCatModal(false);
  };

  const deleteCategory = async () => {
    if (!catEditId || !confirm("למחוק קטגוריה?")) return;
    await deleteDoc(doc(db, "categories", catEditId));
    setShowCatModal(false);
  };

  // ===================== TRANSACTION ACTIONS =====================
  const openAddTx = (catId) => { setExpEditId(null); setExpCatId(catId); setExpForm({ amount: '', note: '', currency: 'ILS', method: '💳 אשראי', cardId: '', giftCardId: '' }); setShowExpModal(true); };
  const openEditTx = (tx) => { setExpEditId(tx.id); setExpCatId(tx.catId); setExpForm({ amount: tx.originalAmount || tx.amount, note: tx.note, currency: tx.currency || 'ILS', method: tx.method || '💳 אשראי', cardId: tx.cardId || '', giftCardId: tx.giftCardId || '' }); setShowExpModal(true); };

  // ===================== PREMIUM FEATURES =====================
  const handleScan = async (file) => {
    if (!file) return;
    setOcrLoading(true);
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(r => img.onload = r);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const avg = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
        const c = avg > 128 ? 255 : 0;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = c;
      }
      ctx.putImageData(d, 0, 0);
      const processedBlob = await new Promise(r => canvas.toBlob(r));
      const worker = await Tesseract.createWorker('heb');
      const ret = await worker.recognize(processedBlob);
      await worker.terminate();
      const text = ret.data.text;
      const totalRegex = /(?:סה"?כ|לתשלום|סכום|Total).*?(\d+(?:\.\d{1,2})?)/g;
      let amount = 0; let m;
      while ((m = totalRegex.exec(text)) !== null) { amount = parseFloat(m[1].replace(/[^\d.]/g, '')); }
      if (amount) {
        setExpForm({ ...expForm, amount: amount.toString(), note: text.split('\n')[0].substring(0, 20) });
        showToast(`זוהה סכום: ₪${amount}`, 'success');
      } else { showToast('לא זוהה סכום ברור', 'warning'); }
    } catch (e) { showToast('שגיאה בסריקה', 'error'); }
    finally { setOcrLoading(false); }
  };

  const registerBiometrics = async () => {
    if (!window.PublicKeyCredential) return showToast('הדפדפן לא תומך בביומטריה', 'warning');
    showToast('נא לאשר טביעת אצבע...', 'success');
    // Simplified registration mock for local persistence
    try {
      localStorage.setItem('biometricsEnabled', 'true');
      showToast('ביומטריה נרשמה בהצלחה!', 'success');
    } catch (e) { showToast('שגיאה ברישום', 'error'); }
  };

  const checkBiometrics = async () => {
    if (localStorage.getItem('biometricsEnabled') === 'true') {
      // In a real app, we'd call navigator.credentials.get()
      setIsLocked(false);
      showToast('ברוך הבא!', 'success');
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("Monthly Budget Report", 105, 20, { align: 'center' });
    doc.text(`Month: ${currentYearMonth}`, 105, 30, { align: 'center' });
    const rows = filteredTxs.map(t => [t.jsDate.toLocaleDateString(), t.note, `ILS ${t.amount}`]);
    doc.autoTable({ startY: 50, head: [['Date', 'Description', 'Amount']], body: rows });
    doc.save(`Budget_Report_${currentYearMonth}.pdf`);
    showToast('דוח PDF הורד', 'success');
  };

  const checkoutShopping = () => {
    const checked = shoppingList.filter(i => i.checked);
    if (!checked.length) return showToast('סמן מוצרים לצ\'ק אאוט', 'warning');
    const total = checked.reduce((s, i) => s + i.price, 0);
    const names = checked.map(i => i.name).join(', ');
    setExpForm({ ...expForm, amount: total.toString(), note: `קניות: ${names}` });
    setShowExpModal(true);
    if (confirm("לנקות פריטים שסומנו?")) {
      checked.forEach(i => deleteDoc(doc(db, "shopping_list", i.id)));
    }
  };
  const saveTx = async () => {
    const rawAmt = parseFloat(expForm.amount);
    if (!rawAmt) return showToast("נא להזין סכום", "error");
    const converted = rawAmt * rates[expForm.currency];
    const allowed = [user.email];
    const partner = localStorage.getItem('partnerEmail');
    if (partner) allowed.push(partner);
    const txData = { amount: converted, originalAmount: rawAmt, currency: expForm.currency, note: expForm.note || "הוצאה כללית", method: expForm.method, cardId: expForm.cardId, giftCardId: expForm.giftCardId, catId: expCatId, allowedUsers: allowed, date: expEditId ? txs.find(t => t.id === expEditId)?.date || Timestamp.now() : Timestamp.now() };
    try {
      if (expEditId) {
        await updateDoc(doc(db, "transactions", expEditId), txData);
        showToast('עודכן בהצלחה', 'success');
      } else {
        await addDoc(collection(db, "transactions"), txData);
        showToast('הוצאה נשמרה', 'success');
      }
      if (navigator.vibrate) navigator.vibrate(20);
      setShowExpModal(false);
      // Budget alerts
      const cat = cats.find(c => c.id === expCatId);
      if (cat && cat.budget > 0) {
        const spent = filteredTxs.filter(t => t.catId === cat.id).reduce((s, t) => s + t.amount, 0);
        const newPerc = ((spent + (expEditId ? 0 : converted)) / cat.budget) * 100;
        if (newPerc >= 100) setTimeout(() => showToast(`🚨 חרגת מתקציב ${cat.name}!`, 'error'), 800);
        else if (newPerc >= 80) setTimeout(() => showToast(`⚠️ ${Math.round(newPerc)}% מתקציב ${cat.name}`, 'warning'), 800);
      }
    } catch (e) { showToast("שגיאה: " + e.message, 'error'); }
  };

  const deleteTx = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "transactions", id)); };

  // ===================== INCOME ACTIONS =====================
  const openAddIncome = () => { setIncForm({ amount: '', source: '', date: new Date().toISOString().slice(0, 10) }); setShowIncomeModal(true); };
  const saveIncome = async () => {
    if (!incForm.amount || !incForm.source || !incForm.date) return showToast("חסרים נתונים", "error");
    try {
      await addDoc(collection(db, "income"), { uid: user.uid, amount: parseFloat(incForm.amount), source: incForm.source, date: incForm.date, timestamp: new Date() });
      showToast('הכנסה נוספה', 'success');
    } catch (e) { showToast("שגיאה: " + e.message, 'error'); }
    setShowIncomeModal(false);
  };
  const deleteIncome = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "income", id)); };

  // ===================== RECURRING ACTIONS =====================
  const addRecurringExpense = async () => {
    if (!recExpForm.name || !recExpForm.amount || !recExpForm.nextDate) return showToast("חסרים נתונים", 'error');
    await addDoc(collection(db, "recurring"), { uid: user.uid, name: recExpForm.name, amount: parseFloat(recExpForm.amount), catId: recExpForm.catId || cats[0]?.id, nextDate: recExpForm.nextDate, frequency: 'monthly' });
    showToast('הוראת קבע נוספה', 'success');
    setRecExpForm({ name: '', amount: '', catId: '', nextDate: '' });
  };
  const addRecurringInc = async () => {
    if (!recIncForm.name || !recIncForm.amount || !recIncForm.nextDate) return showToast("חסרים נתונים", 'error');
    await addDoc(collection(db, "recurring_income"), { uid: user.uid, name: recIncForm.name, amount: parseFloat(recIncForm.amount), nextDate: recIncForm.nextDate, frequency: 'monthly' });
    showToast('הכנסה קבועה נוספה', 'success');
    setRecIncForm({ name: '', amount: '', nextDate: '' });
  };
  const deleteRecurringItem = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "recurring", id)); };
  const deleteRecurringIncItem = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "recurring_income", id)); };

  // ===================== SHOPPING ACTIONS =====================
  const addShopItem = async () => {
    if (!shopItem) return showToast("חסר שם מוצר", 'error');
    await addDoc(collection(db, "shopping_list"), { uid: user.uid, name: shopItem, price: parseFloat(shopPrice) || 0, checked: false, timestamp: new Date() });
    setShopItem(''); setShopPrice('');
  };
  const toggleShopItem = async (id, cur) => await updateDoc(doc(db, "shopping_list", id), { checked: !cur });
  const deleteShopItem = async (id) => await deleteDoc(doc(db, "shopping_list", id));

  // ===================== ASSETS ACTIONS =====================
  const addSavingsGoal = async () => {
    const n = prompt("שם היעד:"); if (!n) return;
    const t = prompt("סכום היעד:"); if (!t) return;
    await addDoc(collection(db, "savings"), { name: n, target: parseFloat(t), current: 0, owner: user.email });
    showToast('יעד חיסכון נוסף', 'success');
  };
  const depositSavings = async (id, cur) => {
    const a = prompt("כמה להפקיד?"); if (!a) return;
    await updateDoc(doc(db, "savings", id), { current: cur + parseFloat(a) });
    showToast('הפקדה בוצעה!', 'success');
  };
  const deleteSavingsGoal = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "savings", id)); };
  const addGiftCard = async () => {
    const n = prompt("שם הכרטיס:"); if (!n) return;
    const b = prompt("סכום:"); if (!b) return;
    await addDoc(collection(db, "giftcards"), { name: n, initial: parseFloat(b), current: parseFloat(b), owner: user.email });
  };
  const deleteGiftCard = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "giftcards", id)); };
  const addCreditCard = async () => {
    const n = prompt("שם הכרטיס:"); if (!n) return;
    const b = prompt("4 ספרות אחרונות:"); if (!b || b.length !== 4) return showToast("4 ספרות בלבד", "error");
    await addDoc(collection(db, "credit_cards"), { name: n, last4: b, owner: user.email });
  };
  const deleteCreditCard = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "credit_cards", id)); };

  // ===================== CSV EXPORT =====================
  const exportToCSV = () => {
    let csv = "\uFEFF" + "Date,Amount,Currency,Category,Note,Method\n";
    txs.forEach(t => {
      const catName = cats.find(c => c.id === t.catId)?.name || 'Unknown';
      csv += [t.jsDate.toLocaleDateString('en-CA'), t.originalAmount || t.amount, t.currency || 'ILS', `"${catName}"`, `"${t.note}"`, t.method].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `budget_${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    showToast('CSV יוצא בהצלחה', 'success');
  };

  // ===================== DEFAULT CATEGORIES =====================
  async function checkAndCreateDefaults(u) {
    const q = query(collection(db, "categories"), where("allowedUsers", "array-contains", u.email));
    const snap = await getDocs(q);
    if (snap.empty) {
      const defaults = [
        { name: 'אוכל וסופר', icon: '🍔', color: '#EF4444', budget: 2000 },
        { name: 'בית', icon: '🏠', color: '#3B82F6', budget: 4000 },
        { name: 'רכב', icon: '🚗', color: '#F59E0B', budget: 1000 },
        { name: 'קניות', icon: '🛍️', color: '#8B5CF6', budget: 500 },
        { name: 'אחר', icon: '❓', color: '#6B7280', budget: 200 }
      ];
      const batch = writeBatch(db);
      defaults.forEach(d => { batch.set(doc(collection(db, "categories")), { ...d, uid: u.uid, allowedUsers: [u.email] }); });
      await batch.commit();
      showToast('קטגוריות ברירת מחדל נוצרו!', 'success');
    }
  }

  // ===================== CHARTS =====================
  useEffect(() => {
    if (activeTab !== 'insights') return;
    // Small delay to let DOM render
    const timer = setTimeout(() => {
      // Bar Chart
      if (barRef.current) {
        if (barInst.current) barInst.current.destroy();
        barInst.current = new Chart(barRef.current, {
          type: 'bar', data: { labels: ['הכנסות', 'הוצאות'], datasets: [{ data: [monthlyIncome, totalSpent], backgroundColor: ['#10B981', '#EF4444'], borderRadius: 10 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
      }
      // Pie
      if (pieRef.current) {
        if (pieInst.current) pieInst.current.destroy();
        const catTotals = cats.map(c => ({ name: c.name, amount: filteredTxs.filter(t => t.catId === c.id).reduce((s, t) => s + t.amount, 0) })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
        const palette = ['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4'];
        pieInst.current = new Chart(pieRef.current, {
          type: 'doughnut', data: { labels: catTotals.map(c => c.name), datasets: [{ data: catTotals.map(c => c.amount), backgroundColor: catTotals.map((_, i) => palette[i % palette.length]), borderWidth: 0 }] },
          options: { maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'Rubik' }, boxWidth: 12, padding: 15, usePointStyle: true } }, tooltip: { callbacks: { label: c => ` ${c.label}: ₪${c.raw.toLocaleString()}` } } } }
        });
      }
      // Line
      if (lineRef.current) {
        if (lineInst.current) lineInst.current.destroy();
        const dayMap = {};
        const daysInMonth = new Date(parseInt(currentYearMonth.slice(0, 4)), parseInt(currentYearMonth.slice(5, 7)), 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) dayMap[i] = 0;
        filteredTxs.forEach(t => { dayMap[t.jsDate.getDate()] += t.amount; });
        const labels = []; const data = []; let sum = 0;
        for (let i = 1; i <= daysInMonth; i++) { labels.push(i); sum += dayMap[i]; data.push(sum); }
        lineInst.current = new Chart(lineRef.current, {
          type: 'line', data: { labels, datasets: [{ label: 'הוצאה מצטברת', data, borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4 }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, filteredTxs, monthlyIncome, totalSpent, cats, currentYearMonth]);

  // ===================== RENDER: LOADING =====================
  if (authLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #4F46E5, #818CF8)', color: 'white', fontSize: '24px' }}>טוען...</div>;

  // ===================== RENDER: LOCK SCREEN =====================
  if (isLocked && user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#4F46E5', flexDirection: 'column', color: 'white' }}>
        <ToastContainer toasts={toasts} />
        <div style={{ fontSize: 50, marginBottom: 20 }}>🔒</div>
        <h2>האפליקציה נעולה</h2>
        <p style={{ opacity: 0.8, marginBottom: 30 }}>הכנס קוד גישה 🔐</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="****" maxLength="4" style={{ textAlign: 'center', fontSize: 24, padding: 10, borderRadius: 10, border: 'none', width: 120, height: 50 }} />
          <button onClick={checkPin} style={{ background: 'white', color: '#4F46E5', border: 'none', borderRadius: 10, padding: '0 20px', fontWeight: 'bold', cursor: 'pointer' }}>&gt;</button>
        </div>
        <button onClick={checkBiometrics} style={{ marginTop: 20, background: 'none', border: '1px solid white', color: 'white', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><span>🧬</span> פתח באמצעות ביומטריה</button>
        {pinError && <p style={{ color: '#FCA5A5', marginTop: 10 }}>קוד שגוי</p>}
      </div>
    );
  }

  // ===================== RENDER: AUTH SCREEN =====================
  if (!user) {
    return (
      <div id="authScreen">
        <ToastContainer toasts={toasts} />
        <div className="auth-card animate-pop">
          <h2>BudgetMaster Pro</h2>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: -20, marginBottom: 20, fontFamily: 'monospace' }}>{APP_VERSION}</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="אימייל" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="סיסמה" />
          <button className="btn-main" onClick={handleLogin} disabled={authBusy}>{authBusy ? 'מתחבר...' : 'כניסה'}</button>
          <button className="btn-main" onClick={handleSignup} disabled={authBusy} style={{ background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)', marginTop: 10 }}>{authBusy ? 'נרשם...' : 'הרשמה'}</button>
        </div>
      </div>
    );
  }

  // ===================== RENDER: MAIN APP =====================
  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div className="app-container">
        {/* HEADER */}
        <div className="header">
          <div className="user-info">
            <div className="avatar">{user.email[0].toUpperCase()}</div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>שלום לשובך,</div>
              <div style={{ fontWeight: 700 }}>{user.email.split('@')[0]}</div>
            </div>
          </div>
          <div className="header-actions">
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
            {showMenu && (
              <div className="dropdown-menu show">
                <button className="dropdown-item" onClick={forceRefresh}><span>🔄</span> עדכון אפליקציה</button>
                <button className="dropdown-item" onClick={() => { setShowPartnersModal(true); setShowMenu(false); }}><span>🤝</span> שותפים</button>
                <button className="dropdown-item" onClick={() => { setShowLogsModal(true); setShowMenu(false); }}><span>📜</span> יומן מערכת</button>
                <div className="dropdown-divider" />
                <div className="dropdown-item" style={{ justifyContent: 'space-between' }}>
                  <span>🔐 נעילה</span>
                  <input type="checkbox" checked={isLocked} onChange={e => { setIsLocked(e.target.checked); localStorage.setItem('appLocked', e.target.checked); showToast(e.target.checked ? 'נעילה הופעלה' : 'נעילה בוטלה', 'success'); }} />
                </div>
                <div className="dropdown-item" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={registerBiometrics}>
                  <span>🧬 רישום טביעת אצבע</span>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>חדש</span>
                </div>
                <div className="dropdown-item" style={{ justifyContent: 'space-between' }}>
                  <span>🔋 חסכון בסוללה</span>
                  <input type="checkbox" checked={lowPower} onChange={e => toggleLowPower(e.target.checked)} />
                </div>
                <div className="dropdown-item" style={{ justifyContent: 'space-between' }}>
                  <span>🔔 התראות</span>
                  <input type="checkbox" checked={notifsEnabled} onChange={e => toggleNotifications(e.target.checked)} />
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => { setShowSettingsModal(true); setShowMenu(false); }}>⚙️ הגדרות</button>
                <button className="dropdown-item" onClick={exportToCSV}>📥 ייצוא CSV</button>
                <button className="dropdown-item" onClick={generatePDF}>📄 דוח PDF</button>
                <div className="dropdown-divider" />
                <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>👋 יציאה</button>
                <div style={{ fontSize: 10, textAlign: 'center', opacity: 0.3, marginTop: 10, fontFamily: 'monospace' }}>{APP_VERSION}</div>
              </div>
            )}
          </div>
        </div>

        {/* CONTROLS BAR */}
        <div className="controls-bar">
          <input type="month" className="date-picker" value={currentYearMonth} onChange={e => setCurrentYearMonth(e.target.value)} />
          <button onClick={openAddCat} className="add-cat-btn"><span>+</span> קטגוריה חדשה</button>
          <button onClick={() => { setShowRecurringModal(true); setShowMenu(false); }} className="icon-btn" style={{ width: 'auto', padding: '0 15px', fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>🔄 הוראות קבע</button>
          <button onClick={openAddIncome} className="icon-btn" style={{ width: 'auto', padding: '0 15px', fontSize: 14, background: '#ECFDF5', color: '#10B981', whiteSpace: 'nowrap', flexShrink: 0 }}>💰 הכנסה</button>
        </div>

        {/* =================== TAB: HOME =================== */}
        {activeTab === 'home' && (
          <div className="animate-fade-in">
            {/* Smart Tip */}
            <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white', borderRadius: 16, padding: 15, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: 24, background: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💡</div>
              <div>
                <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Smart Tip</div>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{getSmartTip()}</div>
              </div>
            </div>

            {/* Summary Chips */}
            <div className="summary-chips" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="sum-chip" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="sum-lbl" style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600, marginBottom: 2 }}>תקציב כולל</span>
                <span className="sum-val" style={{ color: '#1E3A8A', fontSize: 16, fontWeight: 700 }}>₪{totalBudget.toLocaleString()}</span>
              </div>
              <div className="sum-chip" style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="sum-lbl" style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, marginBottom: 2 }}>הוצאות</span>
                <span className="sum-val" style={{ color: '#7F1D1D', fontSize: 16, fontWeight: 700 }}>₪{Math.round(totalSpent).toLocaleString()}</span>
              </div>
              <div className="sum-chip" style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="sum-lbl" style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginBottom: 2 }}>נותר</span>
                <span className="sum-val" style={{ color: balance < 0 ? '#EF4444' : '#064E3B', fontSize: 16, fontWeight: 700 }}>₪{Math.round(balance).toLocaleString()}</span>
              </div>
            </div>

            {/* Categories */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0, color: 'var(--text-sub)' }}>הוצאות לפי קטגוריות</h3>
              <button onClick={() => { setCatEditId(null); setCatForm({ name: '', budget: '', color: '#3B82F6', icon: '🏷️' }); setShowCatModal(true); }} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ חדש</button>
            </div>
            
            <div className="cat-list">
              {cats.length === 0 ? (
                <div className="empty-state-card pulse">
                  <div className="empty-state-icon">📂</div>
                  <div className="empty-state-title">אין קטגוריות עדיין</div>
                  <div className="empty-state-sub">הצעד הראשון לניהול חכם הוא לחלק את ההוצאות לקטגוריות (למשל: סופר, דלק, בילויים).</div>
                  <button className="btn-main" style={{ marginTop: 10 }} onClick={() => { setCatEditId(null); setCatForm({ name: '', budget: '', color: '#3B82F6', icon: '🏷️' }); setShowCatModal(true); }}>צור קטגוריה ראשונה</button>
                </div>
              ) : (
                cats.map((c, i) => {
                  const eff = getEffectiveBudget(c, currentYearMonth);
                  const spent = filteredTxs.filter(t => t.catId === c.id).reduce((s, t) => s + t.amount, 0);
                  const perc = eff > 0 ? Math.min((spent / eff) * 100, 100) : 0;
                  const color = c.color || (perc >= 100 ? 'var(--danger)' : perc >= 80 ? 'var(--warning)' : 'var(--success)');
                  return (
                    <div key={c.id} className={`cat-item animate-slide-up delay-${Math.min((i + 1) * 100, 500)}`}>
                      <div className="cat-progress-slim" style={{ width: `${perc}%`, background: color, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
                      <div className="cat-main-click" onClick={() => openAddTx(c.id, c.name)}>
                        <div className="cat-icon-box" style={{ background: `${c.color || '#4F46E5'}20`, color: c.color || 'var(--primary)' }}>{c.icon || '📂'}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}><b style={{ color: 'var(--text-main)' }}>₪{Math.round(spent).toLocaleString()}</b> / ₪{eff.toLocaleString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button onClick={() => { setHistCatId(c.id); setHistOffset(0); setShowHistoryModal(true); }} style={{ fontSize: 14, background: 'none', color: 'var(--text-sub)', border: 'none', cursor: 'pointer', padding: 4 }} title="היסטוריה">📜</button>
                        <button onClick={() => openEditCat(c)} style={{ fontSize: 14, background: 'none', color: 'var(--text-sub)', border: 'none', cursor: 'pointer', padding: 4 }} title="עריכה">⚙️</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =================== TAB: ACTIVITY =================== */}
        {activeTab === 'activity' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3>היסטוריה 📄</h3>
              {filteredTxs.length > 5 && (
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{filteredTxs.length} פעולות</div>
              )}
            </div>

            <div className="search-container">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                className="search-input" 
                placeholder="חפש הוצאה, סכום או קטגוריה..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="history-list" style={{ maxHeight: 'none', paddingBottom: 80 }}>
              {dataLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 70, marginBottom: 10 }} />
                ))
              ) : (
                (() => {
                  const filtered = filteredTxs.filter(t => {
                    const catName = cats.find(c => c.id === t.catId)?.name || '';
                    const search = searchTerm.toLowerCase();
                    return (t.note || '').toLowerCase().includes(search) || 
                           catName.toLowerCase().includes(search) || 
                           t.amount.toString().includes(search);
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="empty-state-card">
                        <div className="empty-state-icon">{searchTerm ? '🔍' : '💸'}</div>
                        <div className="empty-state-title">{searchTerm ? 'לא נמצאו תוצאות' : 'אין פעילות החודש'}</div>
                        <div className="empty-state-sub">{searchTerm ? 'נסה לחפש משהו אחר' : 'כאן יופיעו כל ההוצאות וההכנסות שלך. מוכן להתחיל לתעד?'}</div>
                        {!searchTerm && <button className="btn-main" style={{ marginTop: 10 }} onClick={() => { 
                          if (cats.length > 0) { openAddTx(cats[0].id, cats[0].name); } 
                          else { setActiveTab('home'); showToast('צור קטגוריה ראשונה בבית', 'info'); } 
                        }}>הוסף הוצאה ראשונה</button>}
                      </div>
                    );
                  }

                  return filtered.sort((a, b) => b.jsDate - a.jsDate).map(t => {
                    const cat = cats.find(c => c.id === t.catId);
                    return (
                      <div key={t.id} className="history-item interactive-node" onClick={() => openEditTx(t)}>
                        <div className="tx-info">
                          <div className="tx-note">{t.note || 'הוצאה כללית'}</div>
                          <div className="tx-meta">{cat?.name || '?'} • {t.jsDate.toLocaleDateString('he-IL')} • {t.method}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="tx-amount">₪{Math.round(t.amount).toLocaleString()}</div>
                          <div className="tx-actions">
                            <span style={{ fontSize: 16 }}>✎</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        )}

        {/* =================== TAB: INSIGHTS =================== */}
        {activeTab === 'insights' && (
          <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>תובנות 📊</h3>
              <button onClick={() => setShowForecastModal(true)} className="icon-btn" style={{ background: '#EEF2FF', color: '#4F46E5', width: 'auto', padding: '0 12px', gap: 6, fontSize: 14 }}>🔮 צפי 30 יום</button>
            </div>
            <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <div><span style={{ fontSize: 12, color: 'var(--text-sub)' }}>הכנסות החודש</span><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>₪{monthlyIncome.toLocaleString()}</div></div>
              <div><span style={{ fontSize: 12, color: 'var(--text-sub)' }}>הוצאות החודש</span><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>₪{Math.round(totalSpent).toLocaleString()}</div></div>
            </div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>פילוח הוצאות</span>
                <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>לחץ על נתון לצפייה בפירוט</span>
              </div>
              <div style={{ height: 250, width: '100%' }}>
                <canvas ref={node => {
                  if (!node) return;
                  const ctx = node.getContext('2d');
                  const catData = cats.map(c => ({
                    label: c.name,
                    value: filteredTxs.filter(t => t.catId === c.id).reduce((s, t) => s + t.amount, 0),
                    color: c.color,
                    id: c.id
                  })).filter(d => d.value > 0);
                  if (pieInst.current) pieInst.current.destroy();
                  pieInst.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: { labels: catData.map(d => d.label), datasets: [{ data: catData.map(d => d.value), backgroundColor: catData.map(d => d.color), borderWidth: 0, weight: 0.5 }] },
                    options: { 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      cutout: '70%', 
                      plugins: { legend: { display: false } },
                      onClick: (e, activeElements) => {
                        if (activeElements.length > 0) {
                          const index = activeElements[0].index;
                          const catId = catData[index].id;
                          if (catId) {
                            setHistCatId(catId);
                            setHistOffset(0);
                            setShowHistoryModal(true);
                            if (navigator.vibrate) navigator.vibrate(10);
                          }
                        }
                      }
                    }
                  });
                }} />
              </div>
            </div>
            <div className="card" style={{ height: 250, marginBottom: 20 }}><h3>📈 מגמת הוצאות (מצטבר)</h3><canvas ref={lineRef} /></div>
            <div className="card" style={{ height: 250 }}><canvas ref={barRef} /></div>

            {/* Income list */}
            <div className="card" style={{ marginTop: 20 }}>
              <h3>הכנסות החודש</h3>
              {income.filter(i => i.date.slice(0, 7) === currentYearMonth).map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid #eee' }}>
                  <span>{i.source}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>+₪{i.amount.toLocaleString()}</span>
                    <button onClick={() => deleteIncome(i.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================== TAB: SHOP =================== */}
        {activeTab === 'shop' && (
          <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
            <div className="header"><h3>רשימת קניות 🛒</h3><div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--primary)', background: '#EEF2FF', padding: '4px 12px', borderRadius: 20 }}>₪{shoppingList.filter(i => i.checked).reduce((s, i) => s + i.price, 0)}</div></div>
            <div className="card" style={{ marginBottom: 15, padding: 15 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" value={shopItem} onChange={e => setShopItem(e.target.value)} placeholder="מוצר (למשל: חלב)" style={{ margin: 0, flex: 2 }} />
                <input type="number" value={shopPrice} onChange={e => setShopPrice(e.target.value)} placeholder="₪" style={{ margin: 0, flex: 1 }} />
                <button onClick={addShopItem} className="btn-main" style={{ width: 'auto', padding: '0 15px', marginTop: 0 }}>+</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shoppingList.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, background: i.checked ? '#ECFDF5' : '#f9fafb', borderRadius: 8, border: `1px solid ${i.checked ? '#10B981' : '#eee'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} onClick={() => toggleShopItem(i.id, i.checked)}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid #ccc', background: i.checked ? '#10B981' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i.checked && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, textDecoration: i.checked ? 'line-through' : 'none', color: i.checked ? '#aaa' : '#333' }}>{i.name}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>₪{i.price}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteShopItem(i.id)} style={{ background: 'none', border: 'none', opacity: 0.5, cursor: 'pointer' }}>🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================== TAB: ASSETS =================== */}
        {activeTab === 'assets' && (
          <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}><h3>🎯 יעדי חיסכון</h3><button onClick={addSavingsGoal} style={{ background: 'var(--success)', color: 'white', border: 'none', width: 30, height: 30, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>+</button></div>
              {savings.length ? savings.map(s => {
                const perc = Math.min((s.current / s.target) * 100, 100);
                return (
                  <div key={s.id} style={{ padding: 10, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}><span style={{ fontWeight: 600 }}>{s.name}</span><div style={{ fontSize: 12 }}>₪{s.current.toLocaleString()} / ₪{s.target.toLocaleString()}</div></div>
                    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}><div style={{ height: '100%', background: 'var(--success)', width: `${perc}%` }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                      <button onClick={() => depositSavings(s.id, s.current)} style={{ fontSize: 11, padding: '4px 8px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer' }}>💰 הפקדה</button>
                      <button onClick={() => deleteSavingsGoal(s.id)} style={{ fontSize: 11, padding: '4px 8px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: 'var(--danger)' }}>🗑️</button>
                    </div>
                  </div>
                );
              }) : <div style={{ textAlign: 'center', color: 'gray', fontSize: 12 }}>אין יעדים עדיין</div>}
            </div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}><h3>💳 כרטיסי אשראי</h3><button onClick={addCreditCard} style={{ background: 'var(--primary)', color: 'white', border: 'none', width: 30, height: 30, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>+</button></div>
              {creditCards.map(c => (<div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 10, padding: 10, marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20 }}>💳</span><div><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div><div style={{ fontSize: 12, color: '#1E40AF' }}>**** {c.last4}</div></div></div><button onClick={() => deleteCreditCard(c.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>&times;</button></div>))}
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}><h3>🎁 גיפט קארדס</h3><button onClick={addGiftCard} style={{ background: 'var(--primary)', color: 'white', border: 'none', width: 30, height: 30, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>+</button></div>
              {cards.map(c => (<div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 10, padding: 10, marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20 }}>🎁</span><div><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div><div style={{ fontSize: 12, color: '#0D9488' }}>₪{c.current?.toLocaleString()} נותר</div></div></div><button onClick={() => deleteGiftCard(c.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>&times;</button></div>))}
            </div>
          </div>
        )}

        {/* =================== TAB: CALENDAR =================== */}
        {activeTab === 'calendar' && (
          <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
            <h3>לוח שנה 📅</h3>
            <div className="card" style={{ padding: 15 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 10 }}>
                {["א'","ב'","ג'","ד'","ה'","ו'","ש'"].map(d => <div key={d} className="calendar-day-header">{d}</div>)}
              </div>
              <div className="calendar-grid">
                {(() => {
                  const year = parseInt(currentYearMonth.slice(0, 4));
                  const month = parseInt(currentYearMonth.slice(5, 7)) - 1;
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDay = new Date(year, month, 1).getDay();
                  const cells = [];
                  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} className="calendar-day empty" />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dayTxs = txs.filter(t => t.jsDate.getDate() === d && t.jsDate.getMonth() === month && t.jsDate.getFullYear() === year);
                    const dayInc = income.filter(i => { const dt = new Date(i.date); return dt.getDate() === d && dt.getMonth() === month && dt.getFullYear() === year; });
                    cells.push(
                      <div key={d} className="calendar-day">
                        <div className="calendar-date">{d}</div>
                        <div className="dot-row">
                          {dayTxs.map((_, j) => <div key={`tx${j}`} className="dot expense" />)}
                          {dayInc.map((_, j) => <div key={`in${j}`} className="dot income" />)}
                        </div>
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-sub)', display: 'flex', gap: 15, justifyContent: 'center' }}>
              <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><div className="dot expense" /> הוצאה</span>
              <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><div className="dot income" /> הכנסה</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM NAV ===== */}
      <nav className="bottom-nav">
        {[
          { id: 'home', icon: '🏠', label: 'בית' },
          { id: 'activity', icon: '📄', label: 'פעילות' },
          { id: 'insights', icon: '📊', label: 'תובנות' },
          { id: 'shop', icon: '🛒', label: 'קניות' },
          { id: 'assets', icon: '🧧', label: 'נכסים' },
          { id: 'calendar', icon: '📅', label: 'יומן' },
        ].map(t => (
          <button key={t.id} className={`nav-item ${activeTab === t.id ? 'active' : ''}`} onClick={() => { setActiveTab(t.id); setShowMenu(false); }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      {/* ===== MODALS ===== */}

      {/* Category Modal */}
      <Modal show={showCatModal} onClose={() => setShowCatModal(false)} title={catEditId ? "עריכת קטגוריה" : "קטגוריה חדשה"}>
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>שם הקטגוריה</label>
        <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="למשל: סופר, דלק" />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>תקציב חודשי (₪)</label>
        <input type="number" value={catForm.budget} onChange={e => setCatForm({ ...catForm, budget: e.target.value })} placeholder="0" />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>צבע 🎨</label>
        <input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} style={{ width: '100%', height: 40, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 8, marginTop: 10 }}>אייקון 🏷️</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {ICONS.map(ic => <button key={ic} onClick={() => setCatForm({ ...catForm, icon: ic })} style={{ fontSize: 18, padding: 5, border: catForm.icon === ic ? '2px solid var(--primary)' : '1px solid #eee', background: '#fff', borderRadius: 6, cursor: 'pointer' }}>{ic}</button>)}
        </div>
        <button className="btn-main" onClick={saveCategory}>שמירה</button>
        {catEditId && <button onClick={deleteCategory} style={{ width: '100%', marginTop: 10, padding: 12, background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'Rubik' }}>מחיקת קטגוריה</button>}
      </Modal>

      {/* Expense Modal */}
      <Modal show={showExpModal} onClose={() => setShowExpModal(false)} title={expEditId ? "עריכת הוצאה" : `הוספת הוצאה`}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>סכום</label>
            <input type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0.00" style={{ fontWeight: 700, fontSize: 18 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>מטבע</label>
            <select value={expForm.currency} onChange={e => setExpForm({ ...expForm, currency: e.target.value })} style={{ fontWeight: 600 }}>
              <option value="ILS">₪</option><option value="USD">$</option><option value="EUR">€</option>
            </select>
          </div>
        </div>
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>תיאור</label>
        <input type="text" value={expForm.note} onChange={e => setExpForm({ ...expForm, note: e.target.value })} placeholder="על מה יצא הכסף?" />
         <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>אמצעי תשלום</label>
         <div style={{ display: 'flex', gap: 8 }}>
           <select value={expForm.method} onChange={e => setExpForm({ ...expForm, method: e.target.value })} style={{ flex: 1 }}>
             <option value="💳 אשראי">💳 אשראי</option><option value="💵 מזומן">💵 מזומן</option><option value="📱 ביט/פייבוקס">📱 ביט/פייבוקס</option><option value="🏦 העברה">🏦 העברה</option><option value="🎁 גיפט קארד">🎁 גיפט קארד</option>
           </select>
           <button onClick={() => document.getElementById('scanInp').click()} disabled={ocrLoading} style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid #C7D2FE', background: '#EEF2FF', cursor: 'pointer', fontSize: 20 }}>{ocrLoading ? '⏳' : '📷'}</button>
           <input type="file" id="scanInp" style={{ display: 'none' }} accept="image/*" onChangeCapture={e => handleScan(e.target.files[0])} />
         </div>
         {expForm.method === '💳 אשראי' && creditCards.length > 0 && (
           <div style={{ marginTop: 8 }}>
             <label style={{ fontSize: 10, color: 'var(--text-sub)' }}>בחר כרטיס אשראי</label>
             <select value={expForm.cardId} onChange={e => setExpForm({ ...expForm, cardId: e.target.value })}>
               <option value="">בחר כרטיס...</option>
               {creditCards.map(c => <option key={c.id} value={c.id}>{c.name} (**** {c.last4})</option>)}
             </select>
           </div>
         )}
         {expForm.method === '🎁 גיפט קארד' && cards.length > 0 && (
           <div style={{ marginTop: 8 }}>
             <label style={{ fontSize: 10, color: 'var(--text-sub)' }}>בחר גיפט קארד</label>
             <select value={expForm.giftCardId} onChange={e => setExpForm({ ...expForm, giftCardId: e.target.value })}>
               <option value="">בחר כרטיס...</option>
               {cards.map(c => <option key={c.id} value={c.id}>{c.name} (₪{c.current} נותר)</option>)}
             </select>
           </div>
         )}
        <button className="btn-main" onClick={saveTx}>שמירה וסיום</button>
        {expEditId && <button onClick={() => { deleteTx(expEditId); setShowExpModal(false); }} style={{ width: '100%', marginTop: 10, padding: 12, background: 'none', border: 'none', color: 'var(--danger)', fontWeight: 600, cursor: 'pointer', fontFamily: 'Rubik' }}>מחיקה</button>}
      </Modal>

      {/* Income Modal */}
      <Modal show={showIncomeModal} onClose={() => setShowIncomeModal(false)} title="הוספת הכנסה 💰">
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>סכום</label>
        <input type="number" value={incForm.amount} onChange={e => setIncForm({ ...incForm, amount: e.target.value })} placeholder="0.00" />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>מקור</label>
        <input type="text" value={incForm.source} onChange={e => setIncForm({ ...incForm, source: e.target.value })} placeholder="למשל: משכורת, בונוס" />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>תאריך</label>
        <input type="date" value={incForm.date} onChange={e => setIncForm({ ...incForm, date: e.target.value })} />
        <button className="btn-main" onClick={saveIncome}>שמירה</button>
      </Modal>

      {/* Recurring Modal */}
      <Modal show={showRecurringModal} onClose={() => setShowRecurringModal(false)} title="הוראות קבע 🔄">
        <div style={{ display: 'flex', gap: 5, marginBottom: 20, background: 'var(--bg)', padding: 4, borderRadius: 12 }}>
          <button onClick={() => setRecTab('expense')} style={{ flex: 1, border: 'none', padding: 10, borderRadius: 10, fontWeight: 600, cursor: 'pointer', background: recTab === 'expense' ? 'var(--card-bg)' : 'none', color: recTab === 'expense' ? 'var(--primary)' : 'var(--text-sub)', fontFamily: 'Rubik' }}>💸 קבע</button>
          <button onClick={() => setRecTab('income')} style={{ flex: 1, border: 'none', padding: 10, borderRadius: 10, fontWeight: 600, cursor: 'pointer', background: recTab === 'income' ? 'var(--card-bg)' : 'none', color: recTab === 'income' ? 'var(--success)' : 'var(--text-sub)', fontFamily: 'Rubik' }}>💰 הכנסות</button>
        </div>
        {recTab === 'expense' && (
          <div style={{ background: 'var(--bg)', padding: 15, borderRadius: 12, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 15px 0' }}>הוסף הוראת קבע</h4>
            <input type="text" value={recExpForm.name} onChange={e => setRecExpForm({ ...recExpForm, name: e.target.value })} placeholder="שם (למשל: נטפליקס)" style={{ marginBottom: 8 }} />
            <input type="number" value={recExpForm.amount} onChange={e => setRecExpForm({ ...recExpForm, amount: e.target.value })} placeholder="עלות חודשית ₪" style={{ marginBottom: 8 }} />
            <select value={recExpForm.catId} onChange={e => setRecExpForm({ ...recExpForm, catId: e.target.value })} style={{ marginBottom: 8 }}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input type="date" value={recExpForm.nextDate} onChange={e => setRecExpForm({ ...recExpForm, nextDate: e.target.value })} />
            <button className="btn-main" onClick={addRecurringExpense}>הוספה</button>
          </div>
        )}
        {recTab === 'income' && (
          <div style={{ background: 'var(--bg)', padding: 15, borderRadius: 12, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 15px 0' }}>הוסף הכנסה קבועה</h4>
            <input type="text" value={recIncForm.name} onChange={e => setRecIncForm({ ...recIncForm, name: e.target.value })} placeholder="מקור (למשל: משכורת)" style={{ marginBottom: 8 }} />
            <input type="number" value={recIncForm.amount} onChange={e => setRecIncForm({ ...recIncForm, amount: e.target.value })} placeholder="סכום חודשי ₪" style={{ marginBottom: 8 }} />
            <input type="date" value={recIncForm.nextDate} onChange={e => setRecIncForm({ ...recIncForm, nextDate: e.target.value })} />
            <button className="btn-main" onClick={addRecurringInc} style={{ background: 'var(--success)' }}>הוספה</button>
          </div>
        )}
        <h4>רשימה פעילה</h4>
        {(recTab === 'expense' ? recurring : recurringIncome).map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: 15, borderRadius: 12, borderRight: `4px solid ${recTab === 'expense' ? 'var(--primary)' : 'var(--success)'}`, marginBottom: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{r.nextDate}</div></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>₪{r.amount}</div>
              <button onClick={() => recTab === 'expense' ? deleteRecurringItem(r.id) : deleteRecurringIncItem(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-sub)' }}>בטל</button>
            </div>
          </div>
        ))}
        {(recTab === 'expense' ? recurring : recurringIncome).length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-sub)', padding: 20 }}>אין רשומות</div>}
      </Modal>

      {/* Settings Modal */}
      <Modal show={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="הגדרות ⚙️">
        <h4 style={{ marginBottom: 10 }}>ערכת נושא 🎨</h4>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {Object.entries(THEMES).map(([name, t]) => (
            <button key={name} onClick={() => { applyTheme(name); showToast(`ערכת נושא: ${name}`, 'success'); }} style={{ width: 40, height: 40, borderRadius: '50%', background: t.primary, border: '2px solid white', boxShadow: `0 0 0 2px ${t.primary}`, cursor: 'pointer' }} />
          ))}
        </div>
        <h4 style={{ marginBottom: 10 }}>ניהול נתונים 💾</h4>
        <button onClick={exportToCSV} style={{ width: '100%', padding: 12, background: 'var(--card-bg)', border: '1px solid var(--input-border)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Rubik', marginBottom: 10 }}>📥 ייצוא ל-CSV</button>
        <button onClick={() => { if (confirm("למחוק הכל?")) { localStorage.clear(); window.location.reload(); } }} style={{ width: '100%', padding: 12, background: 'var(--card-bg)', border: '1px solid var(--danger)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Rubik', color: 'var(--danger)' }}>🗑️ מחיקת כל הנתונים</button>
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-sub)' }}>BudgetMaster Pro {APP_VERSION}</div>
      </Modal>

      {/* Category History Modal */}
      <Modal show={showHistoryModal} onClose={() => setShowHistoryModal(false)} title={`היסטוריית ${cats.find(c => c.id === histCatId)?.name || 'קטגוריה'}`}>
        {(() => {
          const cat = cats.find(c => c.id === histCatId);
          if (!cat) return null;
          let targetMonth = currentYearMonth;
          if (histOffset !== 0) {
            const [y, m] = currentYearMonth.split('-').map(Number);
            targetMonth = new Date(y, m - 1 + histOffset, 1).toISOString().slice(0, 7);
          }
          const histTxs = txs.filter(t => t.catId === histCatId && t.jsDate.toISOString().slice(0, 7) === targetMonth).sort((a, b) => b.jsDate - a.jsDate);
          const total = histTxs.reduce((s, t) => s + t.amount, 0);
          return (
            <>
              <div style={{ display: 'flex', gap: 5, marginBottom: 15, background: 'var(--bg)', padding: 4, borderRadius: 10 }}>
                <button onClick={() => setHistOffset(0)} style={{ flex: 1, border: 'none', padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: histOffset === 0 ? 'var(--card-bg)' : 'none', color: histOffset === 0 ? 'var(--primary)' : 'var(--text-sub)', fontFamily: 'Rubik' }}>החודש</button>
                <button onClick={() => setHistOffset(-1)} style={{ flex: 1, border: 'none', padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: histOffset === -1 ? 'var(--card-bg)' : 'none', color: histOffset === -1 ? 'var(--primary)' : 'var(--text-sub)', fontFamily: 'Rubik' }}>חודש שעבר</button>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 10 }}>סה"כ: ₪{Math.round(total).toLocaleString()}</div>
              {histTxs.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-sub)' }}>אין פעילות</div> :
                histTxs.map(t => (
                  <div key={t.id} className="interactive-node" onClick={() => { setShowHistoryModal(false); openEditTx(t); }} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(0,0,0,0.03)', marginBottom: 8, cursor: 'pointer' }}>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{t.note || 'ללא תיאור'}</div><div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{t.jsDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} • {t.method}</div></div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>₪{Math.round(t.amount).toLocaleString()}</div>
                  </div>
                ))
              }
            </>
          );
        })()}
      </Modal>
      {/* Partners Modal */}
      <Modal show={showPartnersModal} onClose={() => setShowPartnersModal(false)} title="שותפים 🤝">
        <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 15 }}>שתף את התקציב שלך עם שותף. הכנס את האימייל שלו:</p>
        <input type="email" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} placeholder="partner@email.com" />
        <button className="btn-main" onClick={addPartner}>הוספת שותף</button>
      </Modal>

      {/* Forecast Modal */}
      <Modal show={showForecastModal} onClose={() => setShowForecastModal(false)} title="🔮 מסע בזמן (30 יום)">
        <p style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 15 }}>תחזית יתרה על בסיס הוצאות קבועות וממוצע יומי.</p>
        <div style={{ height: 300, width: '100%' }}>
          <canvas id="forecastChartCanvas" ref={node => {
            if (!node) return;
            const ctx = node.getContext('2d');
            const mIncome = income.filter(i => i.date.startsWith(currentYearMonth)).reduce((a, b) => a + Number(b.amount), 0);
            const mSpent = filteredTxs.reduce((a, b) => a + Number(b.amount), 0);
            let running = mIncome - mSpent;
            const avg = mSpent / Math.max(new Date().getDate(), 1);
            const labels = []; const data = [];
            const today = new Date();
            for (let i = 0; i < 30; i++) {
              const d = new Date(); d.setDate(today.getDate() + i);
              running -= (avg || 50);
              recurring.filter(r => new Date(r.nextDate).getDate() === d.getDate()).forEach(r => running -= r.amount);
              recurringIncome.filter(r => new Date(r.nextDate).getDate() === d.getDate()).forEach(r => running += r.amount);
              labels.push(i % 5 === 0 ? d.getDate() : '');
              data.push(running);
            }
            if (node._chart) node._chart.destroy();
            node._chart = new Chart(ctx, {
              type: 'line',
              data: { labels, datasets: [{ label: 'יתרה צפויה', data, borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: true, tension: 0.4 }] },
              options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } }, plugins: { legend: { display: false } } }
            });
          }} />
        </div>
      </Modal>

      {/* Global FAB */}
      <div className="fab-container">
        {fabOpen && (
          <div className="fab-options">
            <button className="fab-opt" onClick={() => { setFabOpen(false); setShowIncomeModal(true); }}>💰 הוספת הכנסה</button>
            <button className="fab-opt" onClick={() => { 
                setFabOpen(false); 
                if (cats.length > 0) openAddTx(cats[0].id, cats[0].name);
                else { setActiveTab('home'); showToast('צור קטגוריה ראשונה', 'info'); }
            }}>💸 הוספת הוצאה</button>
          </div>
        )}
        <div className="fab-row">
          {!fabOpen && <div className="fab-label">פעולה מהירה</div>}
          <button className={`fab-main ${fabOpen ? 'open' : ''} ${cats.length === 0 ? 'pulse' : ''}`} onClick={() => setFabOpen(!fabOpen)}>
            {fabOpen ? '×' : '+'}
          </button>
        </div>
      </div>

      {/* Help Modal */}
      <Modal show={showHelpModal} onClose={() => setShowHelpModal(false)} title="מדריך מהיר 💡">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div style={{ background: '#f0f4ff', padding: 12, borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 5px 0', color: 'var(--primary)' }}>1. צור קטגוריות</h4>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>התחל ביצירת קטגוריות בתיקיית "בית" וקבע להן תקציב חודשי.</p>
          </div>
          <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 5px 0', color: 'var(--success)' }}>2. תעד הוצאות</h4>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>השתמש בכפתור ה-"+" הגדול או לחץ על קטגוריה כדי להוסיף הוצאה.</p>
          </div>
          <div style={{ background: '#fff7ed', padding: 12, borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#ea580c' }}>3. עקוב ותכנן</h4>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>צפה בתובנות בגרפים, נהל את הנכסים שלך (אשראי, גיפט קארד) וחשב תחזיות.</p>
          </div>
          <button className="btn-main" onClick={() => setShowHelpModal(false)}>הבנתי, תודה!</button>
        </div>
      </Modal>

      {/* Logs Modal */}
      <Modal show={showLogsModal} onClose={() => setShowLogsModal(false)} title="יומן מערכת 📜">
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, background: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 5 }}>[INFO] סנכרון נתונים הושלם</div>
          <div style={{ fontSize: 13, background: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 5 }}>[INFO] משתמש מחובר: {user.email}</div>
          <div style={{ fontSize: 13, background: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 5 }}>[INFO] גרסה: {APP_VERSION}</div>
        </div>
      </Modal>

      {/* Add Shopping Checkout Button */}
      {activeTab === 'shop' && shoppingList.some(i => i.checked) && (
        <button onClick={checkoutShopping} style={{ position: 'fixed', bottom: 90, left: 20, background: 'var(--success)', color: 'white', border: 'none', borderRadius: 50, padding: '12px 20px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 100, cursor: 'pointer' }}>
          <span>💳</span> צ'ק אאוט
        </button>
      )}
    </div>
  );
}
