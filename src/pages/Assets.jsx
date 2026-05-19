import React from 'react';
import { useData } from '../context/DataContext';
import { addDoc, updateDoc, deleteDoc, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Trash2, CreditCard, Gift, Target } from 'lucide-react';
import { triggerConfetti } from '../utils/confetti';

export default function Assets() {
  const { savings, creditCards, cards, user, showToast } = useData();

  const addSavingsGoal = async () => {
    const n = prompt("שם היעד:"); if (!n) return;
    const t = prompt("סכום היעד:"); if (!t) return;
    await addDoc(collection(db, "savings"), { name: n, target: parseFloat(t), current: 0, owner: user.email });
    showToast('יעד חיסכון נוסף', 'success');
  };

  const depositSavings = async (id, cur, target) => {
    const a = prompt("כמה להפקיד?"); 
    if (!a) return;
    const newAmt = cur + parseFloat(a);
    await updateDoc(doc(db, "savings", id), { current: newAmt });
    showToast('הפקדה בוצעה!', 'success');
    
    if (newAmt >= target && cur < target) {
      triggerConfetti();
      showToast('כל הכבוד! הגעת ליעד!', 'success');
    }
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

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Target size={20} color="var(--success)" /> יעדי חיסכון</h3>
          <button onClick={addSavingsGoal} style={{ background: 'var(--success)', color: 'white', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={18} /></button>
        </div>
        {savings.length ? savings.map(s => {
          const perc = Math.min((s.current / s.target) * 100, 100);
          return (
            <div key={s.id} style={{ padding: 15, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: perc >= 100 ? 'var(--success)' : 'var(--text-main)' }}>₪{s.current.toLocaleString()} / ₪{s.target.toLocaleString()}</div>
              </div>
              <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', background: 'var(--success)', width: `${perc}%`, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => depositSavings(s.id, s.current, s.target)} style={{ fontSize: 12, padding: '6px 12px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>💰 הפקדה</button>
                <button onClick={() => deleteSavingsGoal(s.id)} style={{ fontSize: 12, padding: '6px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        }) : <div style={{ textAlign: 'center', color: 'gray', fontSize: 13, padding: 10 }}>אין יעדים עדיין</div>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><CreditCard size={20} color="var(--primary)" /> כרטיסי אשראי</h3>
          <button onClick={addCreditCard} style={{ background: 'var(--primary)', color: 'white', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={18} /></button>
        </div>
        {creditCards.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'white', padding: 8, borderRadius: 8 }}><CreditCard size={20} color="#1E40AF" /></div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#1E40AF' }}>**** {c.last4}</div>
              </div>
            </div>
            <button onClick={() => deleteCreditCard(c.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
          </div>
        ))}
        {creditCards.length === 0 && <div style={{ textAlign: 'center', color: 'gray', fontSize: 13, padding: 10 }}>אין כרטיסי אשראי</div>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Gift size={20} color="#0D9488" /> גיפט קארדס</h3>
          <button onClick={addGiftCard} style={{ background: '#0D9488', color: 'white', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={18} /></button>
        </div>
        {cards.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'white', padding: 8, borderRadius: 8 }}><Gift size={20} color="#0D9488" /></div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#0D9488', fontWeight: 'bold' }}>₪{c.current?.toLocaleString()} נותר</div>
              </div>
            </div>
            <button onClick={() => deleteGiftCard(c.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
          </div>
        ))}
        {cards.length === 0 && <div style={{ textAlign: 'center', color: 'gray', fontSize: 13, padding: 10 }}>אין גיפט קארדס</div>}
      </div>
    </div>
  );
}
