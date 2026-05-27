import React from 'react';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import * as LucideIcons from 'lucide-react';

export default function Home() {
  const { cats, txs, currentYearMonth, isDateInFilter } = useData();
  const { openAddCat, openAddTx, setShowHistoryModal, setHistCatId, setHistOffset, openEditCat } = useModals();

  const filteredTxs = txs.filter(t => isDateInFilter(t.jsDate));
  const totalCatBudget = cats.reduce((s, c) => s + (c.budget || 0), 0);
  const spentThisMonth = filteredTxs.reduce((s, t) => s + t.amount, 0);
  const bal = totalCatBudget - spentThisMonth;

  const getSmartTip = () => {
    const perc = totalCatBudget > 0 ? (spentThisMonth / totalCatBudget) * 100 : 0;
    const day = new Date().getDate();
    if (totalCatBudget === 0) return "הגדר תקציב ב'קטגוריה חדשה' כדי להתחיל!";
    if (perc > 100) return `חרגת מהתקציב ב-₪${Math.round(spentThisMonth - totalCatBudget).toLocaleString()}!`;
    if (perc > 85) return `זהירות! ניצלת ${Math.round(perc)}% מהתקציב.`;
    if (day > 20 && perc < 50) return "עבודה מעולה! שומר/ת על התקציב. העבר/י ליתרה לחיסכון!";
    const tips = ["טיפ: בדוק הוראות קבע כפולות.", `נותרו ₪${Math.round(bal).toLocaleString()} החודש.`, "חלוקת תקציב לקטגוריות עוזרת לחסוך עד 20%."];
    return tips[day % tips.length];
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

  const renderIcon = (iconName) => {
    // Map emoji to lucide if needed, or render lucide directly
    let name = iconName;
    if (!name) name = 'Tag';
    // Convert kebab-case to PascalCase
    const pascalName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    const IconComponent = LucideIcons[pascalName] || LucideIcons.Tag;
    return <IconComponent size={20} />;
  };

  return (
    <div className="animate-fade-in">
      <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white', borderRadius: 16, padding: 15, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
        <div style={{ fontSize: 24, background: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LucideIcons.Lightbulb size={24} /></div>
        <div>
          <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Smart Tip</div>
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{getSmartTip()}</div>
        </div>
      </div>

      <div className="summary-chips" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div className="sum-chip" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="sum-lbl" style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600, marginBottom: 2 }}>תקציב כולל</span>
          <span className="sum-val" style={{ color: '#1E3A8A', fontSize: 16, fontWeight: 700 }}>₪{totalCatBudget.toLocaleString()}</span>
        </div>
        <div className="sum-chip" style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="sum-lbl" style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, marginBottom: 2 }}>הוצאות</span>
          <span className="sum-val" style={{ color: '#7F1D1D', fontSize: 16, fontWeight: 700 }}>₪{Math.round(spentThisMonth).toLocaleString()}</span>
        </div>
        <div className="sum-chip" style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="sum-lbl" style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginBottom: 2 }}>נותר</span>
          <span className="sum-val" style={{ color: bal < 0 ? '#EF4444' : '#064E3B', fontSize: 16, fontWeight: 700 }}>₪{Math.round(bal).toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 15 }}>
        <h3 style={{ margin: 0, color: 'var(--text-sub)' }}>הוצאות לפי קטגוריות</h3>
        <button onClick={openAddCat} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ חדש</button>
      </div>
      
      <div className="cat-list">
        {cats.length === 0 ? (
          <div className="empty-state-card pulse">
            <div className="empty-state-icon"><LucideIcons.Folder size={48} /></div>
            <div className="empty-state-title">אין קטגוריות עדיין</div>
            <div className="empty-state-sub">הצעד הראשון לניהול חכם הוא לחלק את ההוצאות לקטגוריות.</div>
            <button className="btn-main" style={{ marginTop: 10 }} onClick={openAddCat}>צור קטגוריה ראשונה</button>
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
                <div className="cat-main-click" onClick={() => openAddTx(c.id)}>
                  <div className="cat-icon-box" style={{ background: `${c.color || '#4F46E5'}20`, color: c.color || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderIcon(c.icon)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-sub)' }}><b style={{ color: 'var(--text-main)' }}>₪{Math.round(spent).toLocaleString()}</b> / ₪{eff.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => { setHistCatId(c.id); setHistOffset(0); setShowHistoryModal(true); }} style={{ fontSize: 14, background: 'none', color: 'var(--text-sub)', border: 'none', cursor: 'pointer', padding: 4 }}><LucideIcons.History size={16} /></button>
                  <button onClick={() => openEditCat(c)} style={{ fontSize: 14, background: 'none', color: 'var(--text-sub)', border: 'none', cursor: 'pointer', padding: 4 }}><LucideIcons.Settings size={16} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
