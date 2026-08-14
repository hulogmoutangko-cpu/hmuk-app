'use client';

import { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Wallet,
} from 'lucide-react';

interface AdminNavProps {
  email?: string;
  firstName?: string;
}

export default function AdminNav({ email, firstName }: AdminNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close mobile nav or dropdown on route change
  useEffect(() => {
    setIsOpen(false);
    setIsMoreOpen(false);
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Primary links visible directly on the desktop bar
  const primaryLinks = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Invites", href: "/admin/invites", icon: Ticket },
    { label: "Contributions", href: "/admin/contributions", icon: PiggyBank },
    { label: "Loans", href: "/admin/loans", icon: Banknote },
    { label: "Payments", href: "/admin/loan-payments", icon: Receipt },
    { label: "Withdrawals", href: "/admin/withdrawals", icon: Wallet },
    { label: "Members", href: "/admin/members", icon: Users },
  ];

  // Secondary/Settings links tucked away into a modern "More" sub-menu dropdown
  const secondaryLinks = [
    { label: "Database", href: "/admin/database", icon: Database },
    { label: "Notification", href: "/admin/notifications", icon: BellCheck },
    { label: "Terms", href: "/admin/settings/terms", icon: FileText },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  // Combined for mobile layout drawer usage
  const allLinks = [...primaryLinks, ...secondaryLinks];
  const isSecondaryActive = secondaryLinks.some((link) => link.href === pathname);

  return (
    <>
      <header className="app-header">
        <div className="header-container" style={{ maxWidth: '1200px' }}>
          
          {/* Brand Logo & Title */}
          <Link href="/admin" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-color)'
            }}>
              <Image
                src="/icons/logo.png"
                alt="HMUK Logo"
                width={18}
                height={18}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <span className="badge admin" style={{ fontSize: '9.5px', padding: '2px 6px' }}>ADMIN</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav" style={{ gap: '2px', position: 'relative' }}>
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  style={{ fontSize: '13px' }}
                >
                  <Icon size={15} style={{ opacity: isActive ? 1 : 0.7 }} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Modern "More" Sub-menu Dropdown Trigger */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={`nav-link ${isSecondaryActive ? 'active' : ''}`}
                style={{
                  background: isMoreOpen ? 'var(--bg-card-hover)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                <span>More</span>
                <ChevronDown size={14} style={{ transform: isMoreOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
              </button>

              {/* Dropdown Menu Container */}
              {isMoreOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '180px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                  padding: '6px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  {secondaryLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`nav-link ${isActive ? 'active' : ''}`}
                        style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12.5px' }}
                      >
                        <Icon size={15} style={{ opacity: isActive ? 1 : 0.7 }} />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Header Action Elements */}
          <div className="header-actions">
            <div className="desktop-theme-toggle">
              <ThemeToggle />
            </div>

            {/* User Greeting (Desktop) */}
            <div className="user-greeting" style={{
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-color)',
              padding: '5px 10px',
              borderRadius: '8px',
              fontSize: '11.5px'
            }}>
              <UserCheck size={13} style={{ color: 'var(--primary)' }} />
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

        {/* Mobile Drawer */}
        {isOpen && (
          <div className="mobile-drawer">
            <div className="drawer-header">
              <div className="drawer-user-info">
                <span className="badge admin">ADMIN PORTAL</span>
                <p className="user-email">{firstName ? `Hi, ${firstName}` : email}</p>
              </div>
              <div className="mobile-theme-toggle">
                <ThemeToggle />
              </div>
            </div>

            <div className="drawer-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {allLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`drawer-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsOpen(false)}
                    style={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '12px'
                    }}
                  >
                    <Icon size={18} style={{ color: isActive ? '#fff' : 'var(--primary)' }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{link.label}</span>
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