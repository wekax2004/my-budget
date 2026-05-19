import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useData } from '../context/DataContext';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const { showToast } = useData();

  const handleLogin = async () => {
    if (!email || !password) return showToast("נא להזין אימייל וסיסמה", "error");
    setAuthBusy(true);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { showToast("שגיאה: " + e.message, "error"); }
    finally { setAuthBusy(false); }
  };

  const handleSignup = async () => {
    if (!email || !password) return showToast("נא להזין אימייל וסיסמה", "error");
    setAuthBusy(true);
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { showToast("שגיאה: " + e.message, "error"); }
    finally { setAuthBusy(false); }
  };

  return (
    <div id="authScreen">
      <div className="auth-card animate-pop">
        <h2>BudgetMaster Pro</h2>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: -20, marginBottom: 20, fontFamily: 'monospace' }}>v4.0-react</div>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="אימייל" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="סיסמה" />
        <button className="btn-main" onClick={handleLogin} disabled={authBusy}>{authBusy ? 'מתחבר...' : 'כניסה'}</button>
        <button className="btn-main" onClick={handleSignup} disabled={authBusy} style={{ background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)', marginTop: 10 }}>{authBusy ? 'נרשם...' : 'הרשמה'}</button>
      </div>
    </div>
  );
}
