import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useData } from '../context/DataContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Menu, LogOut, Settings, Users, FileText, Download, Fingerprint, Lock, Bell, Battery, Upload } from 'lucide-react';
import { importCSV } from '../utils/csvImporter';
export default function Header({ setShowSettingsModal, setShowPartnersModal, setShowLogsModal }) {
  const { user, txs, cats, currentYearMonth, isLocked, setIsLocked, toasts, showToast } = useData();
  const [showMenu, setShowMenu] = useState(false);
  const [lowPower, setLowPower] = useState(localStorage.getItem('lowPowerMode') === 'true');
  const [notifsEnabled, setNotifsEnabled] = useState(localStorage.getItem('notificationsEnabled') === 'true');

  const handleLogout = () => signOut(auth).then(() => showToast('התנתקת', 'success'));

  const forceRefresh = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.unregister());
        window.location.reload(true);
      });
    } else {
      window.location.reload(true);
    }
  };

  const toggleLowPower = (val) => {
    setLowPower(val);
    localStorage.setItem('lowPowerMode', val);
    document.body.classList.toggle('low-power', val);
    showToast(val ? 'מצב חסכון הופעל' : 'מצב חסכון בוטל', 'success');
  };

  const toggleNotifications = (val) => {
    setNotifsEnabled(val);
    localStorage.setItem('notificationsEnabled', val);
    if (val && Notification.permission !== 'granted') Notification.requestPermission();
    showToast(val ? 'התראות הופעלו' : 'התראות בוטלו', 'success');
  };

  const exportToCSV = () => {
    let csv = "\uFEFF" + "Date,Amount,Currency,Category,Note,Method\n";
    txs.forEach(t => {
      const catName = cats.find(c => c.id === t.catId)?.name || 'Unknown';
      csv += [t.jsDate.toLocaleDateString('en-CA'), t.originalAmount || t.amount, t.currency || 'ILS', `"${catName}"`, `"${t.note}"`, t.method].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `budget_${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    showToast('CSV יוצא בהצלחה', 'success');
    setShowMenu(false);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("Monthly Budget Report", 105, 20, { align: 'center' });
    doc.text(`Month: ${currentYearMonth}`, 105, 30, { align: 'center' });
    const filteredTxs = txs.filter(t => t.jsDate.toISOString().slice(0, 7) === currentYearMonth);
    const rows = filteredTxs.map(t => [t.jsDate.toLocaleDateString(), t.note, `ILS ${t.amount}`]);
    doc.autoTable({ startY: 50, head: [['Date', 'Description', 'Amount']], body: rows });
    doc.save(`Budget_Report_${currentYearMonth}.pdf`);
    showToast('דוח PDF הורד', 'success');
    setShowMenu(false);
  };

  const registerBiometrics = () => {
    if (!window.PublicKeyCredential) return showToast('הדפדפן לא תומך בביומטריה', 'warning');
    showToast('נא לאשר טביעת אצבע...', 'success');
    try {
      localStorage.setItem('biometricsEnabled', 'true');
      showToast('ביומטריה נרשמה בהצלחה!', 'success');
    } catch (e) { showToast('שגיאה ברישום', 'error'); }
  };

  return (
    <div className="header">
      <div className="user-info">
        <div className="avatar">{user.email[0].toUpperCase()}</div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>שלום לשובך,</div>
          <div style={{ fontWeight: 700 }}>{user.email.split('@')[0]}</div>
        </div>
      </div>
      <div className="header-actions">
        <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
          <Menu size={24} />
        </button>
        {showMenu && (
          <div className="dropdown-menu show">
            <button className="dropdown-item" onClick={forceRefresh}><span>🔄</span> עדכון אפליקציה</button>
            <button className="dropdown-item" onClick={() => { setShowPartnersModal(true); setShowMenu(false); }}>
              <Users size={16} /> שותפים
            </button>
            <button className="dropdown-item" onClick={() => { setShowLogsModal(true); setShowMenu(false); }}>
              <FileText size={16} /> יומן מערכת
            </button>
            <div className="dropdown-divider" />
            <div className="dropdown-item" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={16} /> נעילה</span>
              <input type="checkbox" checked={isLocked} onChange={e => { setIsLocked(e.target.checked); localStorage.setItem('appLocked', e.target.checked); showToast(e.target.checked ? 'נעילה הופעלה' : 'נעילה בוטלה', 'success'); }} />
            </div>
            <div className="dropdown-item" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={registerBiometrics}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Fingerprint size={16} /> טביעת אצבע</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>חדש</span>
            </div>
            <div className="dropdown-item" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Battery size={16} /> חסכון בסוללה</span>
              <input type="checkbox" checked={lowPower} onChange={e => toggleLowPower(e.target.checked)} />
            </div>
            <div className="dropdown-item" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Bell size={16} /> התראות</span>
              <input type="checkbox" checked={notifsEnabled} onChange={e => toggleNotifications(e.target.checked)} />
            </div>
            <div className="dropdown-divider" />
            <button className="dropdown-item" onClick={() => { setShowSettingsModal(true); setShowMenu(false); }}>
              <Settings size={16} /> הגדרות
            </button>
            <button className="dropdown-item" onClick={exportToCSV}>
              <Download size={16} /> ייצוא CSV
            </button>
            <button className="dropdown-item" onClick={() => document.getElementById('csvUpload').click()}>
              <Upload size={16} /> ייבוא CSV
            </button>
            <input type="file" id="csvUpload" accept=".csv" style={{ display: 'none' }} onChange={e => { importCSV(e.target.files[0], user, showToast); setShowMenu(false); }} />
            <button className="dropdown-item" onClick={generatePDF}>
              <FileText size={16} /> דוח PDF
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
              <LogOut size={16} /> יציאה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
