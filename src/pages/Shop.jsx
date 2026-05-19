import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { addDoc, updateDoc, deleteDoc, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, CheckCircle, Circle, Plus, CreditCard } from 'lucide-react';

export default function Shop() {
  const { shoppingList, user, showToast } = useData();
  const { setExpForm, setShowExpModal } = useModals();
  const [shopItem, setShopItem] = useState('');
  const [shopPrice, setShopPrice] = useState('');

  const addShopItem = async () => {
    if (!shopItem) return showToast("חסר שם מוצר", 'error');
    await addDoc(collection(db, "shopping_list"), { uid: user.uid, name: shopItem, price: parseFloat(shopPrice) || 0, checked: false, timestamp: new Date() });
    setShopItem(''); setShopPrice('');
  };

  const toggleShopItem = async (id, cur) => await updateDoc(doc(db, "shopping_list", id), { checked: !cur });
  const deleteShopItem = async (id) => await deleteDoc(doc(db, "shopping_list", id));

  const checkoutShopping = () => {
    const checked = shoppingList.filter(i => i.checked);
    if (!checked.length) return showToast('סמן מוצרים לצ\'ק אאוט', 'warning');
    const total = checked.reduce((s, i) => s + i.price, 0);
    const names = checked.map(i => i.name).join(', ');
    setExpForm(prev => ({ ...prev, amount: total.toString(), note: `קניות: ${names}` }));
    setShowExpModal(true);
    if (confirm("לנקות פריטים שסומנו?")) {
      checked.forEach(i => deleteDoc(doc(db, "shopping_list", i.id)));
    }
  };

  const checkedTotal = shoppingList.filter(i => i.checked).reduce((s, i) => s + i.price, 0);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3 style={{ margin: 0 }}>רשימת קניות 🛒</h3>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--primary)', background: '#EEF2FF', padding: '4px 12px', borderRadius: 20 }}>
          ₪{checkedTotal}
        </div>
      </div>
      
      <div className="card" style={{ marginBottom: 15, padding: 15, background: 'var(--card-bg)', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="text" value={shopItem} onChange={e => setShopItem(e.target.value)} placeholder="מוצר (למשל: חלב)" style={{ margin: 0, flex: 2, padding: 10, borderRadius: 8, border: '1px solid #eee' }} />
          <input type="number" value={shopPrice} onChange={e => setShopPrice(e.target.value)} placeholder="₪" style={{ margin: 0, flex: 1, padding: 10, borderRadius: 8, border: '1px solid #eee' }} />
          <button onClick={addShopItem} className="btn-main" style={{ width: 'auto', padding: '0 15px', marginTop: 0, borderRadius: 8 }}><Plus size={20} /></button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shoppingList.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-sub)', padding: 20 }}>הרשימה ריקה</div>}
        {shoppingList.map(i => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', background: i.checked ? '#ECFDF5' : 'var(--card-bg)', borderRadius: 12, border: `1px solid ${i.checked ? '#10B981' : '#eee'}`, transition: 'all 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' }} onClick={() => toggleShopItem(i.id, i.checked)}>
              <div style={{ color: i.checked ? '#10B981' : '#ccc' }}>
                {i.checked ? <CheckCircle size={24} /> : <Circle size={24} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, textDecoration: i.checked ? 'line-through' : 'none', color: i.checked ? '#aaa' : 'var(--text-main)' }}>{i.name}</div>
                <div style={{ fontSize: 12, color: i.checked ? '#bbb' : 'var(--text-sub)' }}>₪{i.price}</div>
              </div>
            </div>
            <button onClick={() => deleteShopItem(i.id)} style={{ background: 'none', border: 'none', opacity: 0.5, cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={18} /></button>
          </div>
        ))}
      </div>

      {shoppingList.some(i => i.checked) && (
        <button onClick={checkoutShopping} style={{ position: 'fixed', bottom: 90, left: 20, background: 'var(--success)', color: 'white', border: 'none', borderRadius: 50, padding: '12px 20px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 100, cursor: 'pointer' }}>
          <CreditCard size={20} /> צ'ק אאוט
        </button>
      )}
    </div>
  );
}
