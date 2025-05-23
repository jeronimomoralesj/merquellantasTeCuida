"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../../firebase'

export default function RegisterPage() {
  const router = useRouter()
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('')
  const [posicion, setPosicion] = useState('')
  const [antiguedad, setAntiguedad] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
      const unsub = auth.onAuthStateChanged(u => {
        if (u) {
          router.replace('/dashboard')
        }
      })
      return unsub
    }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // PIN must be 4 digits
    if (pin.length !== 4) {
      setError('El PIN debe tener exactamente 4 dígitos')
      return
    }

    if (pin !== confirmPin) {
      setError('Los PIN no coinciden')
      return
    }

    setLoading(true)
    const fakeEmail = `${cedula}@merque.com`
    const firebasePassword = pin + '11' // append suffix to meet Firebase's 6-char minimum

    try {
      // Persist session if desired
      await setPersistence(auth, browserLocalPersistence)

      // Create auth user with modified password
      const userCred = await createUserWithEmailAndPassword(
        auth,
        fakeEmail,
        firebasePassword
      )

      // Write profile to Firestore with server timestamp
      await setDoc(doc(db, 'users', userCred.user.uid), {
        cedula,
        nombre,
        rol,
        posicion,
        antiguedad: Number(antiguedad),
        createdAt: serverTimestamp()
      })

      router.push('/auth/login')
    } catch (err: unknown) {
      console.error('Firestore write failed:')
      setError('Error al registrar usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 text-black">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow">
        <h2 className="text-2xl font-bold text-center mb-6">Registro de Usuario</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cedula" className="block text-sm font-medium text-gray-700">
              Cédula
            </label>
            <input
              id="cedula"
              type="text"
              required
              value={cedula}
              onChange={e => setCedula(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="123456789"
            />
          </div>

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
              Nombre Completo
            </label>
            <input
              id="nombre"
              type="text"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label htmlFor="rol" className="block text-sm font-medium text-gray-700">
              Rol
            </label>
            <input
              id="rol"
              type="text"
              required
              value={rol}
              onChange={e => setRol(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Administrador"
            />
          </div>

          <div>
            <label htmlFor="posicion" className="block text-sm font-medium text-gray-700">
              Posición
            </label>
            <input
              id="posicion"
              type="text"
              required
              value={posicion}
              onChange={e => setPosicion(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Administrador"
            />
          </div>

          <div>
            <label htmlFor="antiguedad" className="block text-sm font-medium text-gray-700">
              Antigüedad (años)
            </label>
            <input
              id="antiguedad"
              type="number"
              min="0"
              required
              value={antiguedad}
              onChange={e => setAntiguedad(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="2"
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700">
              PIN de 4 dígitos
            </label>
            <input
              id="pin"
              type="password"
              required
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="1234"
            />
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium text-gray-700">
              Confirmar PIN
            </label>
            <input
              id="confirmPin"
              type="password"
              required
              maxLength={4}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="1234"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600 transition disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
      </div>
    </div>
  )
}
