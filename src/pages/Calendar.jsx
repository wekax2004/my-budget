import React from 'react';
import { useData } from '../context/DataContext';

export default function Calendar() {
  const { currentYearMonth, txs, income } = useData();

  return (
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
  );
}
