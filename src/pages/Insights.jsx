import React, { useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { Chart, registerables } from 'chart.js';
import { Sparkles } from 'lucide-react';

Chart.register(...registerables);

export default function Insights() {
  const { income, cats, txs, currentYearMonth } = useData();
  const { setShowForecastModal, setHistCatId, setHistOffset, setShowHistoryModal } = useModals();
  const barRef = useRef(null);
  const pieRef = useRef(null);
  const lineRef = useRef(null);
  const barInst = useRef(null);
  const pieInst = useRef(null);
  const lineInst = useRef(null);

  const filteredTxs = txs.filter(t => t.jsDate.toISOString().slice(0, 7) === currentYearMonth);
  const totalSpent = filteredTxs.reduce((s, t) => s + t.amount, 0);
  const monthlyIncome = income.filter(i => i.date.slice(0, 7) === currentYearMonth).reduce((s, i) => s + i.amount, 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Bar Chart
      if (barRef.current) {
        if (barInst.current) barInst.current.destroy();
        barInst.current = new Chart(barRef.current, {
          type: 'bar', data: { labels: ['הכנסות', 'הוצאות'], datasets: [{ data: [monthlyIncome, totalSpent], backgroundColor: ['#10B981', '#EF4444'], borderRadius: 10 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
      }
      
      // Pie Chart
      if (pieRef.current) {
        if (pieInst.current) pieInst.current.destroy();
        const catTotals = cats.map(c => ({ name: c.name, amount: filteredTxs.filter(t => t.catId === c.id).reduce((s, t) => s + t.amount, 0), color: c.color, id: c.id })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
        const palette = ['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4'];
        
        pieInst.current = new Chart(pieRef.current, {
          type: 'doughnut', 
          data: { 
            labels: catTotals.map(c => c.name), 
            datasets: [{ data: catTotals.map(c => c.amount), backgroundColor: catTotals.map((c, i) => c.color || palette[i % palette.length]), borderWidth: 0 }] 
          },
          options: { 
            maintainAspectRatio: false, 
            cutout: '65%', 
            plugins: { 
              legend: { position: 'bottom', labels: { font: { family: 'Rubik' }, boxWidth: 12, padding: 15, usePointStyle: true } }, 
              tooltip: { callbacks: { label: c => ` ${c.label}: ₪${c.raw.toLocaleString()}` } } 
            },
            onClick: (e, activeElements) => {
              if (activeElements.length > 0) {
                const index = activeElements[0].index;
                const catId = catTotals[index].id;
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
      }
      
      // Line Chart
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
  }, [filteredTxs, monthlyIncome, totalSpent, cats, currentYearMonth]);

  const deleteIncome = async (id) => { 
    if (confirm("למחוק?")) {
      await deleteDoc(doc(db, "income", id));
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>תובנות 📊</h3>
        <button onClick={() => setShowForecastModal(true)} className="icon-btn" style={{ background: '#EEF2FF', color: '#4F46E5', width: 'auto', padding: '6px 12px', gap: 6, fontSize: 14, display: 'flex', alignItems: 'center', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          <Sparkles size={16} /> צפי 30 יום
        </button>
      </div>
      
      <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', background: 'var(--card-bg)', padding: 20, borderRadius: 12 }}>
        <div><span style={{ fontSize: 12, color: 'var(--text-sub)' }}>הכנסות החודש</span><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>₪{monthlyIncome.toLocaleString()}</div></div>
        <div><span style={{ fontSize: 12, color: 'var(--text-sub)' }}>הוצאות החודש</span><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>₪{Math.round(totalSpent).toLocaleString()}</div></div>
      </div>
      
      <div className="card" style={{ marginBottom: 20, background: 'var(--card-bg)', padding: 15, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>פילוח הוצאות</span>
          <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>לחץ על נתון לצפייה בפירוט</span>
        </div>
        <div style={{ height: 250, width: '100%' }}>
          <canvas ref={pieRef} />
        </div>
      </div>
      
      <div className="card" style={{ height: 250, marginBottom: 20, background: 'var(--card-bg)', padding: 15, borderRadius: 12 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>📈 מגמת הוצאות (מצטבר)</h3>
        <div style={{ height: 200 }}><canvas ref={lineRef} /></div>
      </div>
      
      <div className="card" style={{ height: 250, background: 'var(--card-bg)', padding: 15, borderRadius: 12 }}>
        <div style={{ height: 220 }}><canvas ref={barRef} /></div>
      </div>

      <div className="card" style={{ marginTop: 20, background: 'var(--card-bg)', padding: 15, borderRadius: 12 }}>
        <h3 style={{ margin: '0 0 15px 0' }}>הכנסות החודש</h3>
        {income.filter(i => i.date.slice(0, 7) === currentYearMonth).map(i => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <span>{i.source}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>+₪{i.amount.toLocaleString()}</span>
              <button onClick={() => deleteIncome(i.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
            </div>
          </div>
        ))}
        {income.filter(i => i.date.slice(0, 7) === currentYearMonth).length === 0 && <div style={{ color: 'var(--text-sub)', textAlign: 'center', padding: 10 }}>אין הכנסות החודש</div>}
      </div>
    </div>
  );
}
