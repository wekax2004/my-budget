import React, { useState } from 'react';
import { useData } from '../context/DataContext';

const APP_PIN = "1234";

export default function LockScreen() {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const { setIsLocked, showToast } = useData();

  const checkPin = () => {
    if (pin === APP_PIN) { setIsLocked(false); setPinError(false); }
    else setPinError(true);
  };

  const checkBiometrics = async () => {
    if (localStorage.getItem('biometricsEnabled') === 'true') {
      setIsLocked(false);
      showToast('ברוך הבא!', 'success');
    } else {
      showToast('ביומטריה לא הוגדרה', 'warning');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#4F46E5', flexDirection: 'column', color: 'white' }}>
      <div style={{ fontSize: 50, marginBottom: 20 }}>🔒</div>
      <h2>האפליקציה נעולה</h2>
      <p style={{ opacity: 0.8, marginBottom: 30 }}>הכנס קוד גישה 🔐</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="****" maxLength="4" style={{ textAlign: 'center', fontSize: 24, padding: 10, borderRadius: 10, border: 'none', width: 120, height: 50 }} />
        <button onClick={checkPin} style={{ background: 'white', color: '#4F46E5', border: 'none', borderRadius: 10, padding: '0 20px', fontWeight: 'bold', cursor: 'pointer' }}>&gt;</button>
      </div>
      <button onClick={checkBiometrics} style={{ marginTop: 20, background: 'none', border: '1px solid white', color: 'white', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><span>🧬</span> פתח באמצעות ביומטריה</button>
      {pinError && <p style={{ color: '#FCA5A5', marginTop: 10 }}>קוד שגוי</p>}
    </div>
  );
}
