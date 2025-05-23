"use client";

import React, { useState, useEffect } from 'react';
import { Menu, X, User, Calendar, DollarSign, Activity, MessageSquare, ChevronRight, Briefcase, Send, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const MerqeuBienestarLanding = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cv: null
  });
  const [submitted, setSubmitted] = useState(false);

  // Sample job listings - can be empty array to show "no opportunities" message
  const [jobListings, setJobListings] = useState([
    {
      id: 1,
      title: "Contador/a Senior",
      department: "Finanzas",
      location: "Bogotá",
      type: "Tiempo completo"
  }

  ]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleApply = (job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const handleCloseModal = () => {
    setShowJobModal(false);
    setSelectedJob(null);
    setSubmitted(false);
    setFormData({
      name: '',
      email: '',
      cv: null
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    setFormData({
      ...formData,
      cv: e.target.files[0]
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would normally process the form data and send to backend
    console.log("Form submitted:", formData);
    // Show success message
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen font-sans text-black bg-white">
      {/* Navbar */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-black rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">MB</span>
              </div>
              <span className="ml-2 text-xl font-bold">Merque te cuida</span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <a href="#actividades" className="text-sm font-medium hover:text-[#ff9900] transition-colors">Actividades</a>
              <a href="#cumpleanos" className="text-sm font-medium hover:text-[#ff9900] transition-colors">Cumpleaños</a>
              <a href="#vacaciones" className="text-sm font-medium hover:text-[#ff9900] transition-colors">Vacaciones</a>
              <a href="#nomina" className="text-sm font-medium hover:text-[#ff9900] transition-colors">Nómina</a>
              <a href="#chatbot" className="text-sm font-medium hover:text-[#ff9900] transition-colors">Asistente Virtual</a>
              <a href="#trabajaconnosotros" className="text-sm font-medium hover:text-[#ff9900] transition-colors">Trabaja con nosotros</a>
            </nav>

            {/* User Profile Button */}
            <div className="flex items-center">
              <Link href="/auth/login"><button className="hidden md:flex items-center py-2 px-4 rounded-full bg-black text-white text-sm font-medium transition hover:bg-opacity-90">
                <span>Ingresa</span>
                <User className="ml-2 h-4 w-4" />
              </button>
              </Link>
              {/* Mobile Menu Button */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 rounded-full bg-gray-100 text-gray-500"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white shadow-lg">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a href="#actividades" className="block px-3 py-2 text-base font-medium hover:text-[#ff9900]">Actividades</a>
              <a href="#cumpleanos" className="block px-3 py-2 text-base font-medium hover:text-[#ff9900]">Cumpleaños</a>
              <a href="#vacaciones" className="block px-3 py-2 text-base font-medium hover:text-[#ff9900]">Vacaciones</a>
              <a href="#nomina" className="block px-3 py-2 text-base font-medium hover:text-[#ff9900]">Nómina</a>
              <a href="#chatbot" className="block px-3 py-2 text-base font-medium hover:text-[#ff9900]">Asistente Virtual</a>
              <a href="#trabajaconnosotros" className="block px-3 py-2 text-base font-medium hover:text-[#ff9900]">Trabaja con nosotros</a>
              <a href="#perfil" className="block px-3 py-2 text-base font-medium bg-black text-white rounded-md mt-3">Mi Perfil</a>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-28 pb-20 md:pt-40 md:pb-32 px-4 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                Bienvenido a la nueva experiencia <span className="text-[#ff9900]">Merque te cuida</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600">
                Tu portal completo para gestionar todo sobre tu tiempo en esta hermosa empresa. Actividades, beneficios y más, todo en un solo lugar.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button className="py-3 px-8 bg-[#ff9900] text-white rounded-full font-medium hover:bg-[#e68a00] transition-colors flex items-center justify-center">
                  <span>Comenzar</span>
                  <ChevronRight className="ml-2 h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#ff9900]/20 to-black/5 rounded-3xl transform rotate-3"></div>
              <div className="relative bg-white p-6 rounded-3xl shadow-xl">
                <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden mb-6">
                  <div className="flex items-center justify-center h-full">
                    <img src="https://mqplatform.blob.core.windows.net/attributeimage/042a230a-5f20-f689-ebf0-8660ab30a70c.png?sv=2025-05-05&ss=bfqt&srt=sco&st=2025-05-12T20%3A03%3A32Z&se=2025-05-14T20%3A03%3A32Z&sp=rwdxylacuptfi&sig=drXz%2BW5ce3V3NEykRa3b9DuWxa%2B7KXw3utpEqniAeis%3D" alt="Dashboard MerqeuBienestar" className="w-full h-auto" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">Tu panel personalizado</h3>
                <p className="text-gray-600">Toda la información relevante en un vistazo</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="caracteristicas" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitas en un solo lugar</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Merque te cuida simplifica la experiencia de recursos humanos para todos los empleados de Merquellantas
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Activity className="h-8 w-8 text-[#ff9900]" />}
              title="Actividades"
              description="Descubre y participa en eventos, talleres y actividades de la empresa."
            />
            <FeatureCard 
              icon={<Calendar className="h-8 w-8 text-[#ff9900]" />}
              title="Cumpleaños"
              description="No te pierdas ninguna celebración especial de tus compañeros."
            />
            <FeatureCard 
              icon={<DollarSign className="h-8 w-8 text-[#ff9900]" />}
              title="Nómina"
              description="Accede a tu información salarial, recibos y prestaciones."
            />
            <FeatureCard 
              icon={<MessageSquare className="h-8 w-8 text-[#ff9900]" />}
              title="Asistente Virtual"
              description="Resuelve tus dudas al instante con nuestro chatbot inteligente."
            />
          </div>
          <br/>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Activity className="h-8 w-8 text-[#ff9900]" />}
              title="SSGST"
              description="Todo lo laboral."
            />
            <FeatureCard 
              icon={<Calendar className="h-8 w-8 text-[#ff9900]" />}
              title="Permisos"
              description="Saca tus permisos."
            />
            <FeatureCard 
              icon={<DollarSign className="h-8 w-8 text-[#ff9900]" />}
              title="Vacacciones"
              description="Saca tus vacaciones."
            />
            <FeatureCard 
              icon={<MessageSquare className="h-8 w-8 text-[#ff9900]" />}
              title="Y mucho más"
              description="Encuentra muchos más."
            />
          </div>
        </div>
      </section>

      {/* Trabaja con nosotros Section */}
      <section id="trabajaconnosotros" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trabaja con nosotros</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Únete a nuestro equipo y crece profesionalmente en un ambiente colaborativo y dinámico
            </p>
          </div>

          {jobListings.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {jobListings.map(job => (
                <JobCard 
                  key={job.id}
                  job={job}
                  onApply={() => handleApply(job)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 shadow-sm text-center">
              <AlertCircle className="h-16 w-16 text-[#ff9900] mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-3">No tenemos oportunidades laborales ahora</h3>
              <p className="text-gray-600 max-w-lg mx-auto">
                Actualmente no hay vacantes disponibles. Te invitamos a volver a consultar próximamente o dejarnos tu hoja de vida para futuras oportunidades.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-black text-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">¿Listo para mejorar tu experiencia laboral?</h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Merque te cuida está diseñado para hacer tu vida laboral más simple, organizada y satisfactoria.
          </p>
          <button className="py-4 px-10 bg-[#ff9900] text-white rounded-full font-medium text-lg hover:bg-[#e68a00] transition-colors">
            Acceder ahora
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 bg-black rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">MB</span>
                </div>
                <span className="ml-2 text-lg font-bold">Merque te cuida</span>
              </div>
              <p className="text-gray-600 text-sm">
                Creando un mejor ambiente laboral para todos los empleados de Merquellantas.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-[#ff9900]">Tutoriales</a></li>
                <li><a href="#" className="hover:text-[#ff9900]">FAQ</a></li>
                <li><a href="#" className="hover:text-[#ff9900]">Soporte</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Secciones</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#actividades" className="hover:text-[#ff9900]">Actividades</a></li>
                <li><a href="#cumpleanos" className="hover:text-[#ff9900]">Cumpleaños</a></li>
                <li><a href="#vacaciones" className="hover:text-[#ff9900]">Vacaciones</a></li>
                <li><a href="#nomina" className="hover:text-[#ff9900]">Nómina</a></li>
                <li><a href="#trabajaconnosotros" className="hover:text-[#ff9900]">Trabaja con nosotros</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Contacto</h4>
              <p className="text-sm text-gray-600 mb-2">¿Preguntas o sugerencias?</p>
              <a href="mailto:rrhh@merquellantas.com" className="text-[#ff9900] text-sm">rrhh@merquellantas.com</a>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">© 2025 Merque te cuida. Todos los derechos reservados.</p>
            <div className="mt-4 md:mt-0">
              <p className="text-sm text-gray-500">Desarrollado para Merquellantas</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Job Application Modal */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {!submitted ? (
              <>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Aplicar: {selectedJob?.title}</h3>
                    <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="cv" className="block text-sm font-medium text-gray-700 mb-1">Hoja de vida (PDF)</label>
                    <input
                      type="file"
                      id="cv"
                      name="cv"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] outline-none"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Archivo PDF (máx. 5MB)</p>
                  </div>
                  <div className="pt-4">
                    <button 
                      type="submit"
                      className="w-full py-3 bg-[#ff9900] text-white rounded-lg font-medium hover:bg-[#e68a00] transition-colors flex items-center justify-center"
                    >
                      <span>Enviar aplicación</span>
                      <Send className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">¡Aplicación enviada!</h3>
                <p className="text-gray-600 mb-6">
                  Gracias por tu interés en unirte a nuestro equipo. Revisaremos tu información y nos pondremos en contacto contigo pronto.
                </p>
                <button 
                  onClick={handleCloseModal}
                  className="py-2 px-6 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Feature Card Component
const FeatureCard = ({ icon, title, description }) => {
  return (
    <div className="bg-gray-50 rounded-xl p-6 transition-transform duration-300 hover:scale-105">
      <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center shadow-sm mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

// Job Card Component
const JobCard = ({ job, onApply }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center mb-4">
        <div className="bg-[#ff9900]/10 w-12 h-12 rounded-full flex items-center justify-center">
          <Briefcase className="h-6 w-6 text-[#ff9900]" />
        </div>
        <div className="ml-4">
          <h3 className="font-bold text-lg">{job.title}</h3>
          <p className="text-gray-500 text-sm">{job.department}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">{job.location}</span>
        <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">{job.type}</span>
      </div>
      <button 
        onClick={onApply}
        className="w-full py-2 bg-black text-white rounded-lg font-medium hover:bg-opacity-80 transition-colors mt-2"
      >
        Aplicar
      </button>
    </div>
  );
};

export default MerqeuBienestarLanding;