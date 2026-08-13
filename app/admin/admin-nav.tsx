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
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Title */}
        <Link 
          href="/admin" 
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80 focus:outline-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Image
              src="/icons/logo.png"
              alt="HMUK Logo"
              width={22}
              height={22}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline-block">
              HMUK
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/30">
              Admin
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1 no-scrollbar">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span className="whitespace-nowrap">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Header Action Elements */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* User Greeting (Desktop) */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 py-1.5 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs">
            <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
            <span className="max-w-[140px] truncate">{firstName ? `Hi, ${firstName}` : email}</span>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle navigation menu"
          >
            {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile / Bento Dropdown Drawer */}
      {isOpen && (
        <div className="absolute top-16 left-0 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 shadow-xl lg:hidden animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 border border-indigo-200/50">
                ADMIN
              </span>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                {firstName ? `Hi, ${firstName}` : email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="sm:hidden">
                <ThemeToggle />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 border border-zinc-100 dark:border-zinc-800/60'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400'}`} />
                  <span className="truncate w-full">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}