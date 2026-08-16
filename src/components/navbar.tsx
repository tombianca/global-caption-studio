'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '@/app/providers';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/toast';
import type { SafeUser } from '@/lib/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [user, setUser] = useState<SafeUser | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((d) => {
        if (active) setUser(d.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    try {
      await api.logout();
      setUser(null);
      toast('Signed out.', 'info');
      router.push('/');
    } catch {
      toast('Sign out failed.', 'error');
    }
  }

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/upload', label: 'Upload' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            G
          </span>
          <span className="hidden sm:inline">Global Caption Studio</span>
          <span className="sm:hidden">GCS</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {user && (
            <div className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    pathname?.startsWith(l.href)
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 1.78a1 1 0 011.42 1.42l-.7.7a1 1 0 11-1.42-1.42l.7-.7zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-1.78a1 1 0 011.42-1.42l.7.7a1 1 0 11-1.42 1.42l-.7-.7zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm1.78-6.22a1 1 0 011.42 0l.7.7a1 1 0 11-1.42 1.42l-.7-.7a1 1 0 010-1.42zM10 6a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.29 13.14A7 7 0 016.86 2.71a1 1 0 00-1.15-.95A8 8 0 1018.24 15.3a1 1 0 00-.95-1.15z" />
              </svg>
            )}
          </button>

          {user === undefined ? (
            <span className="h-8 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[8rem] truncate sm:inline">{user.name}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="truncate px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <Link href="/dashboard" className="block px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden">
                    Dashboard
                  </Link>
                  <Link href="/upload" className="block px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden">
                    Upload
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
