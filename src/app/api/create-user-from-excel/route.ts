// app/api/create-user-from-excel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '../../../lib/firebaseAdmin';

const db = adminDb();
const auth = getAuth();

export async function POST(req: NextRequest) {
  try {
    const {
      cedula,
      nombre,
      posicion,
      fechaNacimiento,
      extra = {},
    } = await req.json();

    if (!cedula || !nombre) {
      return NextResponse.json(
        { error: 'Cédula y nombre son requeridos' },
        { status: 400 }
      );
    }

    const email = `${cedula}@merque.com`;
    const password = `${cedula.slice(-4)}11`;

    // 1️⃣ Get-or-create Auth user (IDEMPOTENT)
    let userRecord;

    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password,
          displayName: nombre,
        });
      } else {
        throw err;
      }
    }

    const uid = userRecord.uid;

    // 2️⃣ Upsert Firestore user
    await db.collection('users').doc(uid).set(
      {
        cedula: String(cedula),
        email,
        nombre,
        posicion: posicion ?? null,
        rol: 'user',
        extra,
        createdAt: new Date(),
      },
      { merge: true } // 🔑 critical
    );

    // 3️⃣ Create birthday event ONLY if it doesn't exist
    if (fechaNacimiento) {
      const birthDate = new Date(fechaNacimiento);
      if (!isNaN(birthDate.getTime())) {
        const existing = await db
          .collection('calendar')
          .where('userId', '==', uid)
          .where('type', '==', 'birthday')
          .limit(1)
          .get();

        if (existing.empty) {
          await db.collection('calendar').add({
            userId: uid,
            type: 'birthday',
            title: `Cumpleaños de ${nombre}`,
            description: `Recuerden que cumple años ${nombre}`,
            image:
              'https://media.istockphoto.com/id/1349208049/es/foto/marco-multicolor-de-accesorios-para-fiestas-o-cumplea%C3%B1os.jpg',
            date: birthDate,
            createdAt: new Date(),
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        uid,
        email,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Create user error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Error al crear usuario',
      },
      { status: 500 }
    );
  }
}
