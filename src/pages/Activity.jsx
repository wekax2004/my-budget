import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { Search, Trash2, Edit2, Wallet, Plus } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Activity() {
  const { cats, txs, income, currentYearMonth, dataLoading, showToast } = useData();
  const { openEditTx, openAddTx } = useModals();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTxs = txs.filter(t => t.jsDate.toISOString().slice(0, 7) === currentYearMonth);
  
  const deleteIncome = async (id) => { 
    if (confirm("למחוק?")) {
      await deleteDoc(doc(db, "income", id));
      showToast('ההכנסה נמחקה', 'success');
    }
  };

  const search = searchTerm.toLowerCase();
  
  const filteredExp = filteredTxs.filter(t => {
    const catName = cats.find(c => c.id === t.catId)?.name || '';
    return (t.note || '').toLowerCase().includes(search) || 
           catName.toLowerCase().includes(search) || 
           t.amount.toString().includes(search);
  }).map(t => ({ ...t, type: 'expense' }));

  const filteredInc = income.filter(i => {
    return i.date.slice(0, 7) === currentYearMonth && 
           ((i.source || '').toLowerCase().includes(search) || 
            i.amount.toString().includes(search));
  }).map(i => ({ ...i, type: 'income', jsDate: new Date(i.date) }));

  const combined = [...filteredExp, ...filteredInc].sort((a, b) => b.jsDate - a.jsDate);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3>היסטוריה 📄</h3>
        {filteredTxs.length > 5 && (
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{filteredTxs.length} פעולות</div>
        )}
      </div>

      <div className="search-container" style={{ position: 'relative', marginBottom: 15 }}>
        <span className="search-icon" style={{ position: 'absolute', left: 10, top: 10, color: '#aaa' }}><Search size={20} /></span>
        <input 
          type="text" 
          className="search-input" 
          placeholder="חפש הוצאה, סכום או קטגוריה..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: 8, border: '1px solid #eee' }}
        />
      </div>

      <div className="history-list">
        {dataLoading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 70, marginBottom: 10, background: '#eee', borderRadius: 8 }} />
          ))
        ) : combined.length === 0 ? (
          <div className="empty-state-card" style={{ textAlign: 'center', padding: 30, background: '#f9fafb', borderRadius: 12 }}>
            <div className="empty-state-icon" style={{ fontSize: 40, marginBottom: 10 }}>{searchTerm ? '🔍' : '💸'}</div>
            <div className="empty-state-title" style={{ fontWeight: 'bold' }}>{searchTerm ? 'לא נמצאו תוצאות' : 'אין פעילות החודש'}</div>
            <div className="empty-state-sub" style={{ color: 'var(--text-sub)', fontSize: 13 }}>{searchTerm ? 'נסה לחפש משהו אחר' : 'כאן יופיעו כל ההוצאות וההכנסות שלך. מוכן להתחיל לתעד?'}</div>
            {!searchTerm && <button className="btn-main" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => { 
              if (cats.length > 0) { openAddTx(cats[0].id); } 
              else { showToast('צור קטגוריה ראשונה בבית', 'info'); } 
            }}><Plus size={16} /> הוסף הוצאה ראשונה</button>}
          </div>
        ) : (
          combined.map(t => {
            if (t.type === 'income') {
              return (
                <div key={`inc_${t.id}`} className="history-item interactive-node" style={{ borderRight: '4px solid var(--success)', background: 'var(--card-bg)', padding: 15, borderRadius: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div className="tx-info">
                    <div className="tx-note" style={{ fontWeight: 600 }}>{t.source || 'הכנסה כללית'}</div>
                    <div className="tx-meta" style={{ fontSize: 12, color: 'var(--text-sub)' }}>הכנסה • {t.jsDate.toLocaleDateString('he-IL')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="tx-amount" style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: 16 }}>+₪{Math.round(t.amount).toLocaleString()}</div>
                    <div className="tx-actions">
                      <button onClick={(e) => { e.stopPropagation(); deleteIncome(t.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              );
            }

            const cat = cats.find(c => c.id === t.catId);
            return (
              <div key={`exp_${t.id}`} className="history-item interactive-node" onClick={() => openEditTx(t)} style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }}>
                <div className="tx-info">
                  <div className="tx-note" style={{ fontWeight: 600 }}>{t.note || 'הוצאה כללית'}</div>
                  <div className="tx-meta" style={{ fontSize: 12, color: 'var(--text-sub)' }}>{cat?.name || '?'} • {t.jsDate.toLocaleDateString('he-IL')} • {t.method}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="tx-amount" style={{ fontWeight: 'bold', fontSize: 16 }}>₪{Math.round(t.amount).toLocaleString()}</div>
                  <div className="tx-actions">
                    <Edit2 size={16} color="var(--text-sub)" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
