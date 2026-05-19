import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
  const { user, isLocked, authLoading, currentYearMonth, setCurrentYearMonth, toasts, cats } = useData();
  const { fabOpen, setFabOpen, setShowIncomeModal, openAddTx, setShowSettingsModal, setShowPartnersModal, setShowLogsModal } = useModals();

  if (authLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #4F46E5, #818CF8)', color: 'white', fontSize: '24px' }}>טוען...</div>;

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
        
        <div className="controls-bar">
          <input type="month" className="date-picker" value={currentYearMonth} onChange={e => setCurrentYearMonth(e.target.value)} />
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
