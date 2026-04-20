export function Modal({ show, onClose, title, children }) {
  if (!show) return null;
  return (
    <div className="modal" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content animate-pop">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '24px', color: 'var(--text-sub)', cursor: 'pointer' }}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
