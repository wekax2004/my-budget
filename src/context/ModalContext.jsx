import React, { createContext, useContext, useState } from 'react';
import { useData } from './DataContext';
import { Timestamp } from 'firebase/firestore';

const ModalContext = createContext(null);

export const useModals = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
  const [showCatModal, setShowCatModal] = useState(false);
  const [showExpModal, setShowExpModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [showPartnersModal, setShowPartnersModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Forms and states
  const [catForm, setCatForm] = useState({ name: '', budget: '', color: '#3B82F6', icon: 'tag' });
  const [catEditId, setCatEditId] = useState(null);

  const [expForm, setExpForm] = useState({ amount: '', note: '', method: '💳 אשראי', currency: 'ILS', cardId: '', giftCardId: '' });
  const [expCatId, setExpCatId] = useState(null);
  const [expEditId, setExpEditId] = useState(null);

  const [incForm, setIncForm] = useState({ amount: '', source: '', date: new Date().toISOString().slice(0, 10) });

  const [histCatId, setHistCatId] = useState(null);
  const [histOffset, setHistOffset] = useState(0);

  const { txs, currentYearMonth } = useData();

  const getEffectiveBudget = (cat, month) => {
    if (!cat) return 0;
    const history = cat.monthlyBudgets || {};
    if (history[month] !== undefined) return history[month];
    const sorted = Object.keys(history).sort();
    let eff = cat.budget || 0;
    for (const m of sorted) { if (m <= month) eff = history[m]; else break; }
    return eff;
  };

  const openAddCat = () => { setCatEditId(null); setCatForm({ name: '', budget: '', color: '#3B82F6', icon: 'tag' }); setShowCatModal(true); };
  const openEditCat = (c) => {
    setCatEditId(c.id);
    setCatForm({ name: c.name, budget: getEffectiveBudget(c, currentYearMonth), color: c.color || '#3B82F6', icon: c.icon || 'tag' });
    setShowCatModal(true);
  };

  const openAddTx = (catId) => { setExpEditId(null); setExpCatId(catId); setExpForm({ amount: '', note: '', currency: 'ILS', method: '💳 אשראי', cardId: '', giftCardId: '' }); setShowExpModal(true); };
  const openEditTx = (tx) => { setExpEditId(tx.id); setExpCatId(tx.catId); setExpForm({ amount: tx.originalAmount || tx.amount, note: tx.note, currency: tx.currency || 'ILS', method: tx.method || '💳 אשראי', cardId: tx.cardId || '', giftCardId: tx.giftCardId || '' }); setShowExpModal(true); };

  const openAddIncome = () => { setIncForm({ amount: '', source: '', date: new Date().toISOString().slice(0, 10) }); setShowIncomeModal(true); };

  const value = {
    showCatModal, setShowCatModal,
    showExpModal, setShowExpModal,
    showIncomeModal, setShowIncomeModal,
    showRecurringModal, setShowRecurringModal,
    showSettingsModal, setShowSettingsModal,
    showHistoryModal, setShowHistoryModal,
    showForecastModal, setShowForecastModal,
    showPartnersModal, setShowPartnersModal,
    showLogsModal, setShowLogsModal,
    showHelpModal, setShowHelpModal,
    fabOpen, setFabOpen,

    catForm, setCatForm, catEditId, setCatEditId,
    expForm, setExpForm, expCatId, setExpCatId, expEditId, setExpEditId,
    incForm, setIncForm,
    histCatId, setHistCatId, histOffset, setHistOffset,

    openAddCat, openEditCat, openAddTx, openEditTx, openAddIncome
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};
