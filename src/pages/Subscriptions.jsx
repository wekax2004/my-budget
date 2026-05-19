import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { db } from '../firebase';
import { doc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { Trash2, TrendingUp, TrendingDown, Repeat, DollarSign } from 'lucide-react';

export default function Subscriptions() {
  const { recurring, recurringIncome, cats, user, showToast } = useData();
  const [recTab, setRecTab] = useState('expense');
  const [recExpForm, setRecExpForm] = useState({ name: '', amount: '', catId: '', nextDate: new Date().toISOString().slice(0, 10) });
  const [recIncForm, setRecIncForm] = useState({ name: '', amount: '', nextDate: new Date().toISOString().slice(0, 10) });

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

  const totalMonthlyExpenses = recurring.reduce((s, r) => s + r.amount, 0);
  const totalMonthlyIncome = recurringIncome.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, background: 'var(--card-bg)', padding: 6, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <button onClick={() => setRecTab('expense')} style={{ flex: 1, border: 'none', padding: 12, borderRadius: 8, fontWeight: 600, cursor: 'pointer', background: recTab === 'expense' ? 'var(--primary)' : 'transparent', color: recTab === 'expense' ? 'white' : 'var(--text-sub)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TrendingDown size={18} /> מנויים והוצאות קבועות
        </button>
        <button onClick={() => setRecTab('income')} style={{ flex: 1, border: 'none', padding: 12, borderRadius: 8, fontWeight: 600, cursor: 'pointer', background: recTab === 'income' ? 'var(--success)' : 'transparent', color: recTab === 'income' ? 'white' : 'var(--text-sub)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TrendingUp size={18} /> הכנסות קבועות
        </button>
      </div>

      <div style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 12, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          {recTab === 'expense' ? <><Repeat size={18}/> הוסף מנוי / הוצאה</> : <><DollarSign size={18}/> הוסף הכנסה קבועה</>}
        </h4>
        
        {recTab === 'expense' ? (
          <>
            <input type="text" value={recExpForm.name} onChange={e => setRecExpForm({ ...recExpForm, name: e.target.value })} placeholder="שם (למשל: נטפליקס)" style={{ marginBottom: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--input-border)' }} />
            <input type="number" value={recExpForm.amount} onChange={e => setRecExpForm({ ...recExpForm, amount: e.target.value })} placeholder="עלות חודשית ₪" style={{ marginBottom: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--input-border)' }} />
            <select value={recExpForm.catId} onChange={e => setRecExpForm({ ...recExpForm, catId: e.target.value })} style={{ marginBottom: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--input-border)' }}>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={recExpForm.nextDate} onChange={e => setRecExpForm({ ...recExpForm, nextDate: e.target.value })} style={{ marginBottom: 15, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--input-border)' }} />
            <button className="btn-main" onClick={addRecurringExpense}>הוספה</button>
          </>
        ) : (
          <>
            <input type="text" value={recIncForm.name} onChange={e => setRecIncForm({ ...recIncForm, name: e.target.value })} placeholder="מקור (למשל: משכורת)" style={{ marginBottom: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--input-border)' }} />
            <input type="number" value={recIncForm.amount} onChange={e => setRecIncForm({ ...recIncForm, amount: e.target.value })} placeholder="סכום חודשי ₪" style={{ marginBottom: 10, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--input-border)' }} />
            <input type="date" value={recIncForm.nextDate} onChange={e => setRecIncForm({ ...recIncForm, nextDate: e.target.value })} style={{ marginBottom: 15, width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--input-border)' }} />
            <button className="btn-main" onClick={addRecurringInc} style={{ background: 'var(--success)' }}>הוספה</button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h4 style={{ margin: 0 }}>רשימה פעילה</h4>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: recTab === 'expense' ? 'var(--danger)' : 'var(--success)' }}>
          סה"כ: ₪{recTab === 'expense' ? totalMonthlyExpenses : totalMonthlyIncome}
        </div>
      </div>

      {(recTab === 'expense' ? recurring : recurringIncome).map(r => (
        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: 15, borderRadius: 12, borderRight: `4px solid ${recTab === 'expense' ? 'var(--primary)' : 'var(--success)'}`, marginBottom: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>תאריך חיוב קרוב: {r.nextDate}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>₪{r.amount}</div>
            <button onClick={() => recTab === 'expense' ? deleteRecurringItem(r.id) : deleteRecurringIncItem(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={18} /></button>
          </div>
        </div>
      ))}
      
      {(recTab === 'expense' ? recurring : recurringIncome).length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-sub)', padding: 20 }}>אין רשומות</div>
      )}
    </div>
  );
}
