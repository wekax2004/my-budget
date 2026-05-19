import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FileText, PieChart, ShoppingCart, Wallet, Calendar, Repeat } from 'lucide-react';

export default function BottomNav() {
  const tabs = [
    { path: '/home', icon: Home, label: 'בית' },
    { path: '/activity', icon: FileText, label: 'פעילות' },
    { path: '/insights', icon: PieChart, label: 'תובנות' },
    { path: '/shop', icon: ShoppingCart, label: 'קניות' },
    { path: '/assets', icon: Wallet, label: 'נכסים' },
    { path: '/calendar', icon: Calendar, label: 'יומן' },
    { path: '/subscriptions', icon: Repeat, label: 'מנויים' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(t => (
        <NavLink 
          key={t.path} 
          to={t.path} 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span><t.icon size={20} /></span>
          <span style={{ fontSize: '10px' }}>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
