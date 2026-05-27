import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from './components/Toast';
import { DataProvider, useData } from './context/DataContext';
import { ModalProvider, useModals } from './context/ModalContext';

import AuthScreen from './components/AuthScreen';
import LockScreen from './components/LockScreen';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Modals from './components/Modals';

import Home from './pages/Home';
import Activity from './pages/Activity';
import Insights from './pages/Insights';
import Shop from './pages/Shop';
import Assets from './pages/Assets';
import Calendar from './pages/Calendar';
import Subscriptions from './pages/Subscriptions';

import './index.css';

function MainLayout() {
  const { user, isLocked, authLoading, currentYearMonth, setCurrentYearMonth, dateFilter, setDateFilter, toasts, cats, txs } = useData();
  const { fabOpen, setFabOpen, setShowIncomeModal, openAddTx, setShowSettingsModal, setShowPartnersModal, setShowLogsModal } = useModals();

  if (authLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #4F46E5, #818CF8)', color: 'white', fontSize: '24px' }}>טוען...</div>;

  useEffect(() => {
    if (!user || authLoading) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const checkReminder = () => {
      if ("Notification" in window && Notification.permission === "granted") {
        const lastReminded = localStorage.getItem('lastReminded');
        const now = new Date().getTime();
        if (!lastReminded || now - parseInt(lastReminded) > 12 * 60 * 60 * 1000) {
          if (txs && txs.length > 0) {
            const sorted = [...txs].sort((a, b) => b.jsDate - a.jsDate);
            const lastTxTime = sorted[0].jsDate.getTime();
            if (now - lastTxTime > 24 * 60 * 60 * 1000) {
              new Notification("BudgetMaster Pro", {
                body: "לא הוספת הוצאות לאחרונה. אל תשכח לתעד את ההוצאות שלך!",
                icon: "/favicon.svg"
              });
              localStorage.setItem('lastReminded', now.toString());
            }
          }
        }
      }
    };
    const timer = setTimeout(checkReminder, 5000);
    return () => clearTimeout(timer);
  }, [user, authLoading, txs]);

  if (!user) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <AuthScreen />
      </>
    );
  }

  if (isLocked) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <LockScreen />
      </>
    );
  }

  return (
    <Router>
      <ToastContainer toasts={toasts} />
      <div className="app-container">
        <Header 
          setShowSettingsModal={setShowSettingsModal} 
          setShowPartnersModal={setShowPartnersModal} 
          setShowLogsModal={setShowLogsModal} 
        />
        
        <div className="controls-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select 
            value={dateFilter.type} 
            onChange={e => setDateFilter({ ...dateFilter, type: e.target.value })}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', background: 'white' }}
          >
            <option value="month">חודש</option>
            <option value="custom">טווח תאריכים</option>
          </select>
          {dateFilter.type === 'month' ? (
            <input type="month" className="date-picker" value={dateFilter.value} onChange={e => {
              setDateFilter({ type: 'month', value: e.target.value });
              setCurrentYearMonth(e.target.value);
            }} />
          ) : (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="date" value={dateFilter.start || ''} onChange={e => setDateFilter({ ...dateFilter, start: e.target.value })} style={{ padding: '8px', borderRadius: 8, border: '1px solid #ccc' }} />
              <span style={{color: 'var(--text-sub)'}}>-</span>
              <input type="date" value={dateFilter.end || ''} onChange={e => setDateFilter({ ...dateFilter, end: e.target.value })} style={{ padding: '8px', borderRadius: 8, border: '1px solid #ccc' }} />
            </div>
          )}
        </div>

        <div className="content-area">
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="*" element={<Navigate to="/home" />} />
          </Routes>
        </div>
      </div>

      <BottomNav />

      <div className="fab-container">
        {fabOpen && (
          <div className="fab-options">
            <button className="fab-opt" onClick={() => { setFabOpen(false); setShowIncomeModal(true); }}>💰 הוספת הכנסה</button>
            <button className="fab-opt" onClick={() => { 
                setFabOpen(false); 
                if (cats.length > 0) openAddTx(cats[0].id);
                else { alert('צור קטגוריה ראשונה בבית'); }
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

      <Modals />
    </Router>
  );
}

export default function App() {
  return (
    <DataProvider>
      <ModalProvider>
        <MainLayout />
      </ModalProvider>
    </DataProvider>
  );
}
