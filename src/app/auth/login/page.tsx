"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../../firebase'
import { Eye, EyeOff, User, Lock, ArrowRight } from 'lucide-react'

export default function MerqeuBienestarLogin() {
  const router = useRouter()
  const [cedula, setCedula] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
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

    if (pin.length !== 4) {
      setError('El PIN debe tener exactamente 4 dígitos')
      return
    }

    setLoading(true)
    const fakeEmail = `${cedula}@merque.com`
    const firebasePassword = pin + '11'

    try {
      if (rememberMe) {
        await setPersistence(auth, browserLocalPersistence)
      }

      const userCred = await signInWithEmailAndPassword(
        auth,
        fakeEmail,
        firebasePassword
      )

      // Fetch user profile
      const userSnap = await getDoc(doc(db, 'users', userCred.user.uid))
      if (!userSnap.exists()) {
        throw new Error('Perfil de usuario no encontrado')
      }
      const profile = userSnap.data()
      console.log('Perfil:', profile)
      
      router.push('/dashboard')
    } catch (err: unknown) {
      console.error('Login error:', err)
      setError('Usuario o PIN inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col justify-center items-center px-4 py-12 text-black">
      {/* Logo & Title */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-52 bg-gray rounded-full flex items-center justify-center mb-3">
          <img src="https://www.merquellantas.com/assets/images/logo/Logo-Merquellantas.png" alt="Merquellantas" />
        </div>
        <h1 className="text-2xl font-bold text-black">¡Nuestra Gente!</h1>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#ff9900]/20 to-black/5 rounded-3xl transform rotate-2" />
          <div className="relative bg-white rounded-3xl shadow-xl p-8 md:p-10">
            <h2 className="text-3xl font-bold mb-2 text-black text-center">Bienvenido</h2>
            <p className="text-gray-600 text-center mb-8">Accede a tu cuenta para continuar</p>

            <form onSubmit={handleSubmit}>
              {/* Cédula */}
              <div className="mb-6">
                <label htmlFor="cedula" className="block text-sm font-medium text-gray-700 mb-2">
                  Cédula
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="cedula"
                    type="text"
                    required
                    value={cedula}
                    onChange={e => setCedula(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                    placeholder="123456789"
                  />
                </div>
              </div>

              {/* PIN */}
              <div className="mb-6">
                <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                  PIN de 4 dígitos
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="pin"
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={4}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                    placeholder="••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                  >
                    {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Remember & Error */}
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-[#ff9900] border-gray-300 rounded focus:ring-[#ff9900]"
                  />
                  <span className="ml-2">Recordarme</span>
                </label>
                {error && <p className="text-red-500 text-sm">{error}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 rounded-full bg-[#ff9900] text-white font-medium hover:bg-[#e68a00] transition disabled:opacity-50"
              >
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </form>

            {/* Separator & Footer Link */}
            <div className="my-8 flex items-center">
              <div className="flex-grow border-t border-gray-200" />
              <span className="px-4 text-sm text-gray-500">o</span>
              <div className="flex-grow border-t border-gray-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Global Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-500">© 2025 Merquellantas. Todos los derechos reservados.</p>
        <div className="mt-2 flex justify-center space-x-4">
          <a href="#" className="text-xs text-gray-500 hover:text-[#ff9900]">Términos y condiciones</a>
          <a href="#" className="text-xs text-gray-500 hover:text-[#ff9900]">Política de privacidad</a>
          <a href="#" className="text-xs text-gray-500 hover:text-[#ff9900]">Ayuda</a>
        </div>
      </div>
    </div>
  )
}