import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'Credenciales',
      credentials: {
        cedula: { label: 'Cédula', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const cedula = credentials?.cedula as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!cedula || !password) return null;

        const db = await getDb();
        const user = await db.collection('users').findOne({ cedula: String(cedula) });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.nombre,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // On initial sign-in, fetch full user data
        const db = await getDb();
        const dbUser = await db.collection('users').findOne({ email: user.email });

        if (dbUser) {
          token.dbId = dbUser._id.toString();
          token.nombre = dbUser.nombre;
          token.rol = dbUser.rol;
          token.cedula = dbUser.cedula;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.dbId as string;
      session.user.nombre = token.nombre as string;
      session.user.rol = token.rol as string;
      session.user.cedula = token.cedula as string;
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
});
