'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/app/theme-toggle';
import {
  LayoutDashboard,
  Ticket,
  PiggyBank,
  Banknote,
  Receipt,
  Users,
  Settings,
  Menu,
  X,
  UserCheck,
} from 'lucide-react';

interface AdminNavProps {
  email?: string;
  firstName?: string;
}

export default function AdminNav({ email, firstName }: AdminNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Invites", href: "/admin/invites", icon: Ticket },
    { label: "Contributions", href: "/admin/contributions", icon: PiggyBank },
    { label: "Loans", href: "/admin/loans", icon: Banknote },
    { label: "Payments", href: "/admin/loan-payments", icon: Receipt },
    { label: "Members", href: "/admin/members", icon: Users },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <>
      <header className="app-header">
        <div className="header-container">
          {/* Brand Logo & Title */}
          <Link href="/admin" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Image
              src="/icons/logo.png"
              alt="HMUK Logo"
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
              priority
            />
            <div className="brand-text">
              <span className="brand-name"></span>
              <span className="brand-badge" style={{ fontSize: '10px', color: 'var(--primary-color, #2563eb)', fontWeight: 700 }}>
                ADMIN Portal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  <Icon size={16} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="header-actions">
            <ThemeToggle />

            {/* User Greeting (Desktop) */}
            <div className="user-greeting" style={{ fontSize: '12px', color: 'var(--text-sub, #666)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserCheck size={14} />
              <span>{firstName ? `Hi, ${firstName}` : email}</span>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle navigation menu"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile / Bento Dropdown Drawer */}
        {isOpen && (
          <div className="mobile-drawer">
            <div className="drawer-user-info">
              <span className="badge admin">ADMIN</span>
              <p className="user-email">{firstName ? `Hi, ${firstName}` : email}</p>
            </div>
            <div className="drawer-grid">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`drawer-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <Icon size={18} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>
    </>
  );
}