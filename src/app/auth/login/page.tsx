"use client"

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../../firebase'
import { Eye, EyeOff, User, Lock, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'

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
      if (u) router.replace('/dashboard')
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

      const userCred = await signInWithEmailAndPassword(auth, fakeEmail, firebasePassword)

      const userSnap = await getDoc(doc(db, 'users', userCred.user.uid))
      if (!userSnap.exists()) {
        throw new Error('Perfil de usuario no encontrado')
      }

      router.push('/dashboard')
    } catch (err: unknown) {
      console.error('Login error:', err)
      setError('Usuario o PIN inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      {/* Decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 10%, #ff9900 0, transparent 40%), radial-gradient(circle at 80% 90%, #ff9900 0, transparent 35%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT — Mascot / brand panel */}
        <section className="hidden lg:flex flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <div className="bg-[#ff9900] rounded-xl p-2">
              <Sparkles className="h-5 w-5 text-black" />
            </div>
            <span className="font-bold tracking-wide text-lg">Merquellantas · Nuestra Gente</span>
          </div>

          <div className="relative flex-1 flex items-center justify-center">
            <div className="absolute w-[420px] h-[420px] xl:w-[520px] xl:h-[520px] rounded-full bg-[#ff9900] blur-3xl opacity-30" />
            <div className="absolute w-[360px] h-[360px] xl:w-[460px] xl:h-[460px] rounded-full border-2 border-[#ff9900]/40" />
            <div className="absolute w-[280px] h-[280px] xl:w-[360px] xl:h-[360px] rounded-full border border-white/10" />
            <Image
              src="/merquito.jpeg"
              alt="Merquito - Mascota Merquellantas"
              width={420}
              height={420}
              priority
              className="relative rounded-3xl shadow-2xl ring-4 ring-[#ff9900]/60 object-cover"
            />
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl xl:text-4xl font-extrabold leading-tight">
              Bienvenido a <span className="text-[#ff9900]">Nuestra Gente</span>
            </h2>
            <p className="mt-3 text-white/70">
              Tu portal de bienestar, beneficios y comunicación con el equipo Merquellantas.
            </p>
          </div>
        </section>

        {/* RIGHT — Login form */}
        <section className="flex flex-col justify-center items-center px-5 sm:px-8 py-10 sm:py-14">
          {/* Mobile mascot header */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="relative">
              <div className="absolute -inset-3 bg-[#ff9900] rounded-full blur-2xl opacity-40" />
              <Image
                src="/merquito.jpeg"
                alt="Merquito - Mascota Merquellantas"
                width={140}
                height={140}
                priority
                className="relative rounded-2xl ring-4 ring-[#ff9900] object-cover"
              />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-white text-center">
              Nuestra <span className="text-[#ff9900]">Gente</span>
            </h1>
            <p className="text-white/60 text-sm mt-1">Merquellantas</p>
          </div>

          <div className="w-full max-w-md">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-[#ff9900] via-[#ff9900]/40 to-transparent rounded-3xl blur-xl opacity-60" />
              <div className="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 text-black">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1 w-10 rounded-full bg-[#ff9900]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#ff9900]">
                    Acceso seguro
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold mt-2">Inicia sesión</h2>
                <p className="text-gray-500 text-sm mt-1 mb-6">
                  Ingresa con tu cédula y tu PIN de 4 dígitos.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                  {/* Cédula */}
                  <div className="mb-4">
                    <label htmlFor="cedula" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      Cédula
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="cedula"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="username"
                        required
                        value={cedula}
                        onChange={e => setCedula(e.target.value.replace(/\D/g, ''))}
                        className="block w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition"
                        placeholder="Ej. 1023456789"
                      />
                    </div>
                  </div>

                  {/* PIN */}
                  <div className="mb-4">
                    <label htmlFor="pin" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                      PIN de 4 dígitos
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="pin"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        autoComplete="current-password"
                        required
                        maxLength={4}
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                        className="block w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition tracking-[0.5em] font-semibold"
                        placeholder="••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#ff9900] transition"
                      >
                        {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-5">
                    <label className="flex items-center text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="h-4 w-4 accent-[#ff9900] border-gray-300 rounded focus:ring-[#ff9900]"
                      />
                      <span className="ml-2">Recordarme</span>
                    </label>
                    <span className="flex items-center text-xs text-gray-500">
                      <ShieldCheck className="h-4 w-4 mr-1 text-[#ff9900]" />
                      Conexión segura
                    </span>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !cedula || pin.length !== 4}
                    className="w-full flex justify-center items-center py-3.5 rounded-xl bg-[#ff9900] text-black font-bold text-base hover:bg-[#ffae33] active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#ff9900]/30"
                  >
                    {loading ? 'Ingresando...' : 'Iniciar sesión'}
                    {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-gray-500">
                  ¿Problemas para ingresar? Contacta a Talento Humano.
                </p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-white/50">
                © {new Date().getFullYear()} Merquellantas. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
