'use client';

import { useSession, signIn, signOut } from 'next-auth/react';

export { useSession, signIn, signOut };

export function useRequireAuth() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return { session: null, loading: true, user: null };
  }

  if (!session) {
    signIn('microsoft-entra-id');
    return { session: null, loading: true, user: null };
  }

  return {
    session,
    loading: false,
    user: {
      id: session.user.id,
      nombre: session.user.nombre,
      rol: session.user.rol,
      cedula: session.user.cedula,
      email: session.user.email,
    },
  };
}
