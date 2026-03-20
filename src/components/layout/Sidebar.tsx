'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getProtectedUnlockUrl } from '@/lib/auth-client';

const NAV_ITEMS = [
  { href: '/', label: 'Playground', icon: 'P' },
  { href: '/prompts', label: 'Prompts', icon: 'R' },
  { href: '/history', label: 'History', icon: 'H' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
    }}>
      <div style={{
        padding: '0 20px 24px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: 16,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--accent-blue)' }}>UPG</span>
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Ultimate Prompt Ground
        </p>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                width: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                border: '1px solid var(--border-color)',
                fontSize: 11,
              }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          padding: 12,
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          Viewing is public.
          <br />
          Running models and saving prompt changes require authentication.
        </div>
        <a
          href={getProtectedUnlockUrl()}
          className="btn btn-secondary btn-sm"
          style={{ textAlign: 'center', textDecoration: 'none' }}
        >
          Unlock Actions
        </a>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          v1.0.0
        </div>
      </div>
    </aside>
  );
}
