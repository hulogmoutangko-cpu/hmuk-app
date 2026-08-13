'use client';

import { useState, useEffect } from 'react';
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
  Database,
  FileText,
  Menu,
  X,
  UserCheck,
  BellCheck,
} from 'lucide-react';

interface AdminNavProps {
  email?: string;
  firstName?: string;
}

export default function AdminNav({ email, firstName }: AdminNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile navigation drawer whenever the route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navLinks = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Invites", href: "/admin/invites", icon: Ticket },
    { label: "Contributions", href: "/admin/contributions", icon: PiggyBank },
    { label: "Loans", href: "/admin/loans", icon: Banknote },
    { label: "Payments", href: "/admin/loan-payments", icon: Receipt },
    { label: "Members", href: "/admin/members", icon: Users },
    { label: "Database", href: "/admin/database", icon: Database },
    { label: "Terms", href: "/admin/settings/terms", icon: FileText },
    { label: "Settings", href: "/admin/settings", icon: Settings },
    { label: "Notification", href: "/admin/notifications", icon: BellCheck },
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
              width={28}
              height={28}
              style={{ objectFit: 'contain' }}
              priority
            />
            <div className="brand-text">
              <span className="brand-badge">ADMIN Portal</span>
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
                >
                  <Icon size={16} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Header Action Elements */}
          <div className="header-actions">
            <div className="desktop-theme-toggle">
              <ThemeToggle />
            </div>

            {/* User Greeting (Desktop) */}
            <div className="user-greeting">
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
              {isOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile / Bento Dropdown Drawer */}
        {isOpen && (
          <div className="mobile-drawer">
            <div className="drawer-header">
              <div className="drawer-user-info">
                <span className="badge admin">ADMIN</span>
                <p className="user-email">{firstName ? `Hi, ${firstName}` : email}</p>
              </div>
              <div className="mobile-theme-toggle">
                <ThemeToggle />
              </div>
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
                  >
                    <Icon size={16} />
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