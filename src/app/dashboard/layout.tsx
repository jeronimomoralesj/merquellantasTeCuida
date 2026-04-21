import React from 'react';
import BienestarChat from './components/chat';

/**
 * Shared layout for all /dashboard/* routes. Mounts the bienestar chat widget
 * here so it stays alive across client-side navigations — essential for the
 * "help me understand this page" walkthrough flow.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BienestarChat />
    </>
  );
}
