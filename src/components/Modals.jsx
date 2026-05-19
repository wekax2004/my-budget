import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { Modal } from './Modal';
import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import Tesseract from 'tesseract.js';
import { Chart } from 'chart.js';

const ICONS = ['tag','shopping-cart','car','home','cross','graduation-cap','plane','gift','scissors','smartphone','dumbbell','shopping-bag','wine','apple','fuel','lightbulb','wrench','baby','dog','book','gamepad-2','music','clapperboard','laptop'];
const THEMES = {
  default: { primary:'#4F46E5', bg:'#F3F4F6', card:'#FFFFFF', text:'#1F2937', sub:'#6B7280' },
  midnight: { primary:'#7C3AED', bg:'#111827', card:'#1F2937', text:'#F9FAFB', sub:'#9CA3AF' },
  forest: { primary:'#059669', bg:'#ECFDF5', card:'#FFFFFF', text:'#064E3B', sub:'#047857' },
  ocean: { primary:'#0891B2', bg:'#ECFEFF', card:'#FFFFFF', text:'#164E63', sub:'#0E7490' },
  dark: { primary:'#6366F1', bg:'#000000', card:'#121212', text:'#E5E7EB', sub:'#9CA3AF' }
};
const rates = { ILS: 1, USD: 3.65, EUR: 3.95 };

export default function Modals() {
  const { user, cats, txs, income, recurring, recurringIncome, currentYearMonth, showToast, creditCards, cards } = useData();
  const {
    showCatModal, setShowCatModal, catForm, setCatForm, catEditId,
    showExpModal, setShowExpModal, expForm, setExpForm, expCatId, setExpCatId, expEditId,
    showIncomeModal, setShowIncomeModal, incForm, setIncForm,
    showRecurringModal, setShowRecurringModal,
    showSettingsModal, setShowSettingsModal,
    showHistoryModal, setShowHistoryModal, histCatId, histOffset, setHistOffset,
    showForecastModal, setShowForecastModal,
    showPartnersModal, setShowPartnersModal,
    showLogsModal, setShowLogsModal,
    showHelpModal, setShowHelpModal,
    openEditTx
  } = useModals();

  const [ocrLoading, setOcrLoading] = useState(false);
  const [recTab, setRecTab] = useState('expense');
  const [recExpForm, setRecExpForm] = useState({ name: '', amount: '', catId: '', nextDate: new Date().toISOString().slice(0, 10) });
  const [recIncForm, setRecIncForm] = useState({ name: '', amount: '', nextDate: new Date().toISOString().slice(0, 10) });
  const [partnerEmail, setPartnerEmail] = useState('');

  // Helpers
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

  const hardResetApp = async () => {
    if (!confirm("האם אתה בטוח שברצונך לאפס את האפליקציה? זה ימחק הגדרות מקומיות אך הנתונים בענן ישמרו.")) return;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let reg of regs) { await reg.unregister(); }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let key of keys) { await caches.delete(key); }
      }
      localStorage.clear();
      window.location.reload(true);
    } catch (e) {
      showToast('שגיאה באיפוס: ' + e.message, 'error');
    }
  };

  // Actions
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
      const cat = cats.find(c => c.id === expCatId);
      if (cat && cat.budget > 0) {
        const spent = txs.filter(t => t.catId === cat.id && t.jsDate.toISOString().slice(0, 7) === currentYearMonth).reduce((s, t) => s + t.amount, 0);
        const newPerc = ((spent + (expEditId ? 0 : converted)) / cat.budget) * 100;
        if (newPerc >= 100) setTimeout(() => showToast(`🚨 חרגת מתקציב ${cat.name}!`, 'error'), 800);
        else if (newPerc >= 80) setTimeout(() => showToast(`⚠️ ${Math.round(newPerc)}% מתקציב ${cat.name}`, 'warning'), 800);
      }
    } catch (e) { showToast("שגיאה: " + e.message, 'error'); }
  };

  const deleteTx = async (id) => { if (confirm("למחוק?")) await deleteDoc(doc(db, "transactions", id)); };

  const saveIncome = async () => {
    if (!incForm.amount || !incForm.source || !incForm.date) return showToast("חסרים נתונים", "error");
    try {
      await addDoc(collection(db, "income"), { uid: user.uid, amount: parseFloat(incForm.amount), source: incForm.source, date: incForm.date, timestamp: new Date() });
      showToast('הכנסה נוספה', 'success');
    } catch (e) { showToast("שגיאה: " + e.message, 'error'); }
    setShowIncomeModal(false);
  };

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

  const addPartner = async () => {
    if (!partnerEmail) return;
    try {
      const batch = writeBatch(db);
      cats.forEach(c => batch.update(doc(db, "categories", c.id), { allowedUsers: [...(c.allowedUsers||[]), partnerEmail] }));
      txs.forEach(t => batch.update(doc(db, "transactions", t.id), { allowedUsers: [...(t.allowedUsers||[]), partnerEmail] }));
      await batch.commit();
      showToast('שותף נוסף בהצלחה', 'success');
      setPartnerEmail('');
      setShowPartnersModal(false);
    } catch (e) { showToast('שגיאה בהוספת שותף', 'error'); }
  };

  const addCreditCard = async () => {
    const n = prompt("שם הכרטיס:"); if (!n) return;
    const b = prompt("4 ספרות אחרונות:"); if (!b || b.length !== 4) return showToast("4 ספרות בלבד", "error");
    await addDoc(collection(db, "credit_cards"), { name: n, last4: b, owner: user.email });
  };

  const addGiftCard = async () => {
    const n = prompt("שם הכרטיס:"); if (!n) return;
    const b = prompt("סכום:"); if (!b) return;
    await addDoc(collection(db, "giftcards"), { name: n, initial: parseFloat(b), current: parseFloat(b), owner: user.email });
  };

  return (
    <>
      <Modal show={showCatModal} onClose={() => setShowCatModal(false)} title={catEditId ? "עריכת קטגוריה" : "קטגוריה חדשה"}>
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>שם הקטגוריה</label>
        <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="למשל: סופר, דלק" />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>תקציב חודשי (₪)</label>
        <input type="number" value={catForm.budget} onChange={e => setCatForm({ ...catForm, budget: e.target.value })} placeholder="0" />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>צבע 🎨</label>
        <input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} style={{ width: '100%', height: 40, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 8, marginTop: 10 }}>אייקון (שם Lucide)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 150, overflowY: 'auto' }}>
          {ICONS.map(ic => <button key={ic} onClick={() => setCatForm({ ...catForm, icon: ic })} style={{ fontSize: 12, padding: '5px 10px', border: catForm.icon === ic ? '2px solid var(--primary)' : '1px solid #eee', background: '#fff', borderRadius: 6, cursor: 'pointer' }}>{ic}</button>)}
        </div>
        <button className="btn-main" onClick={saveCategory} style={{ marginTop: 15 }}>שמירה</button>
        {catEditId && <button onClick={deleteCategory} style={{ width: '100%', marginTop: 10, padding: 12, background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'Rubik' }}>מחיקת קטגוריה</button>}
      </Modal>

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
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>קטגוריה</label>
        <select value={expCatId || ''} onChange={e => setExpCatId(e.target.value)} style={{ width: '100%', fontWeight: 600 }}>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
         {expForm.method === '💳 אשראי' && (
           <div style={{ marginTop: 8 }}>
             <label style={{ fontSize: 10, color: 'var(--text-sub)' }}>בחר כרטיס אשראי</label>
             <select value={expForm.cardId} onChange={e => {
               if (e.target.value === 'new') {
                 addCreditCard();
                 setExpForm({ ...expForm, cardId: '' });
               } else {
                 setExpForm({ ...expForm, cardId: e.target.value });
               }
             }}>
               <option value="">בחר כרטיס...</option>
               {creditCards.map(c => <option key={c.id} value={c.id}>{c.name} (**** {c.last4})</option>)}
               <option value="new">+ הוסף כרטיס חדש</option>
             </select>
           </div>
         )}
         {expForm.method === '🎁 גיפט קארד' && (
           <div style={{ marginTop: 8 }}>
             <label style={{ fontSize: 10, color: 'var(--text-sub)' }}>בחר גיפט קארד</label>
             <select value={expForm.giftCardId} onChange={e => {
               if (e.target.value === 'new') {
                 addGiftCard();
                 setExpForm({ ...expForm, giftCardId: '' });
               } else {
                 setExpForm({ ...expForm, giftCardId: e.target.value });
               }
             }}>
               <option value="">בחר כרטיס...</option>
               {cards.map(c => <option key={c.id} value={c.id}>{c.name} (₪{c.current} נותר)</option>)}
               <option value="new">+ הוסף גיפט קארד חדש</option>
             </select>
           </div>
         )}
        <button className="btn-main" onClick={saveTx}>שמירה וסיום</button>
        {expEditId && <button onClick={() => { deleteTx(expEditId); setShowExpModal(false); }} style={{ width: '100%', marginTop: 10, padding: 12, background: 'none', border: 'none', color: 'var(--danger)', fontWeight: 600, cursor: 'pointer', fontFamily: 'Rubik' }}>מחיקה</button>}
      </Modal>

      <Modal show={showIncomeModal} onClose={() => setShowIncomeModal(false)} title="הוספת הכנסה 💰">
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4 }}>סכום</label>
        <input type="number" value={incForm.amount} onChange={e => setIncForm({ ...incForm, amount: e.target.value })} placeholder="0.00" />
        <label style={{ fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 4, marginTop: 10 }}>מקור</label>
        <input type="text" value={incForm.source} onChange={e => setIncForm({ ...incForm, source: e.target.value })} placeholder="למשל: משכורת, בונוס" />
        <button className="btn-main" onClick={saveIncome}>שמירה</button>
      </Modal>

      <Modal show={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="הגדרות ⚙️">
        <h4 style={{ marginBottom: 10 }}>ערכת נושא 🎨</h4>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {Object.entries(THEMES).map(([name, t]) => (
            <button key={name} onClick={() => { applyTheme(name); showToast(`ערכת נושא: ${name}`, 'success'); }} style={{ width: 40, height: 40, borderRadius: '50%', background: t.primary, border: '2px solid white', boxShadow: `0 0 0 2px ${t.primary}`, cursor: 'pointer' }} />
          ))}
        </div>
        <h4 style={{ marginBottom: 10 }}>ניהול נתונים 💾</h4>
        <button onClick={() => { if (confirm("למחוק הכל?")) { localStorage.clear(); window.location.reload(); } }} style={{ width: '100%', padding: 12, background: 'var(--card-bg)', border: '1px solid var(--danger)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Rubik', color: 'var(--danger)', marginBottom: 10 }}>🗑️ מחיקת כל הנתונים</button>
        <button onClick={hardResetApp} style={{ width: '100%', padding: 12, background: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Rubik', color: 'white', fontWeight: 'bold' }}>⚠️ איפוס ותיקון שגיאות (Hard Reset)</button>
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-sub)' }}>BudgetMaster Pro v4.1-react</div>
      </Modal>

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

      <Modal show={showPartnersModal} onClose={() => setShowPartnersModal(false)} title="שותפים 🤝">
        <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 15 }}>שתף את התקציב שלך עם שותף. הכנס את האימייל שלו:</p>
        <input type="email" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} placeholder="partner@email.com" />
        <button className="btn-main" onClick={addPartner}>הוספת שותף</button>
      </Modal>

      <Modal show={showForecastModal} onClose={() => setShowForecastModal(false)} title="🔮 מסע בזמן (30 יום)">
        <p style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 15 }}>תחזית יתרה על בסיס הוצאות קבועות וממוצע יומי.</p>
        <div style={{ height: 300, width: '100%' }}>
          <canvas id="forecastChartCanvas" ref={node => {
            if (!node) return;
            const ctx = node.getContext('2d');
            const mIncome = income.filter(i => i.date.startsWith(currentYearMonth)).reduce((a, b) => a + Number(b.amount), 0);
            const filteredTxs = txs.filter(t => t.jsDate.toISOString().slice(0, 7) === currentYearMonth);
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

      <Modal show={showLogsModal} onClose={() => setShowLogsModal(false)} title="יומן מערכת 📜">
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, background: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 5 }}>[INFO] סנכרון נתונים הושלם</div>
          <div style={{ fontSize: 13, background: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 5 }}>[INFO] משתמש מחובר: {user?.email}</div>
          <div style={{ fontSize: 13, background: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 5 }}>[INFO] גרסה: v4.1-react</div>
        </div>
      </Modal>
      
      <Modal show={showHelpModal} onClose={() => setShowHelpModal(false)} title="מדריך מהיר 💡">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div style={{ background: '#f0f4ff', padding: 12, borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 5px 0', color: 'var(--primary)' }}>1. צור קטגוריות</h4>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>התחל ביצירת קטגוריות בתיקיית "בית" וקבע להן תקציב חודשי.</p>
          </div>
          <button className="btn-main" onClick={() => setShowHelpModal(false)}>הבנתי, תודה!</button>
        </div>
      </Modal>
    </>
  );
}
