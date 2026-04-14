'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Search,
  User,
  Cake,
} from 'lucide-react';
interface UserExtra {
  'Dpto Donde Labora': string;
  'ARL': string;
  'Banco': string;
  'CAJA DE COMPENSACION': string;
  'EPS': string;
  'FONDO DE PENSIONES': string;
  'Fecha Ingreso': string;
  'Fondo Cesantías': string;
  'Cargo Empleado': string;
  'Número Cuenta': string;
  'Tipo Cuenta': string;
  'Tipo de Documento': string;
  'posicion': string;
  'fechaNacimiento': string;
  'rol': 'user' | 'admin' | 'fondo';
}

interface User {
  id: string;
  cedula: string;
  email: string;
  createdAt: Date;
  extra: UserExtra;
  nombre: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string | Date;
  description: string;
  type: 'general' | 'birthday';
  userId: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const initialFormData: {
  cedula: string;
  nombre: string;
  extra: UserExtra;
} = {
  cedula: '',
  nombre: '',
  extra: {
    'Dpto Donde Labora': '',
    'ARL': '',
    'Banco': '',
    'CAJA DE COMPENSACION': '',
    'EPS': '',
    'FONDO DE PENSIONES': '',
    'Fecha Ingreso': '',
    'Fondo Cesantías': '',
    'Cargo Empleado': '',
    'Número Cuenta': '',
    'Tipo Cuenta': '',
    'Tipo de Documento': '',
    'posicion': '',
    'fechaNacimiento': '',
    'rol': 'user',
  }
};

  const [formData, setFormData] = useState(initialFormData);

  const generateEmail = (cedula: string) => {
    return `${cedula}@merquellantas.com`;
  };

  const dateToExcelSerial = (dateString: string): number => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const epoch = new Date(1900, 0, 1);
    const diffTime = date.getTime() - epoch.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const excelSerialToDate = (serial: number): string => {
    if (!serial || serial === 0) return '';
    const epoch = new Date(1900, 0, 1);
    const date = new Date(epoch.getTime() + (serial - 1) * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  };

  const fetchCalendarEvents = async () => {
    try {
      const res = await fetch('/api/calendar');
      if (!res.ok) throw new Error('Error fetching calendar');
      const allEvents: CalendarEvent[] = await res.json();
      const birthdayEvents = allEvents.filter(e => e.type === 'birthday');
      setCalendarEvents(birthdayEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  };

  const getBirthdayFromCalendar = (userName: string): string => {
    const birthdayEvent = calendarEvents.find(event =>
      event.title.toLowerCase().includes(userName.toLowerCase()) ||
      (event.title.toLowerCase().includes('cumpleaños') &&
       event.title.toLowerCase().includes(userName.toLowerCase().split(' ')[0]))
    );

    if (birthdayEvent && birthdayEvent.date) {
      const date = birthdayEvent.date instanceof Date
        ? birthdayEvent.date
        : new Date(birthdayEvent.date);

      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0];
    }

    return '';
  };

  const createUser = async () => {
    if (!formData.cedula || !formData.nombre) {
      alert('Por favor, complete los campos obligatorios (Cédula y Nombre)');
      return;
    }

    const email = generateEmail(formData.cedula);

    try {
      const payload = {
        cedula: formData.cedula,
        nombre: formData.nombre,
        email,
        departamento: formData.extra['Dpto Donde Labora'],
        arl: formData.extra['ARL'],
        banco: formData.extra['Banco'],
        caja_compensacion: formData.extra['CAJA DE COMPENSACION'],
        eps: formData.extra['EPS'],
        fondo_pensiones: formData.extra['FONDO DE PENSIONES'],
        fecha_ingreso: formData.extra['Fecha Ingreso'],
        fondo_cesantias: formData.extra['Fondo Cesantías'],
        cargo_empleado: formData.extra['Cargo Empleado'],
        numero_cuenta: formData.extra['Número Cuenta'],
        tipo_cuenta: formData.extra['Tipo Cuenta'],
        tipo_documento: formData.extra['Tipo de Documento'],
        posicion: formData.extra['posicion'],
        fecha_nacimiento: formData.extra['fechaNacimiento'],
        rol: formData.extra['rol'],
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error creating user');
      }

      const created = await res.json();

      const newUser: User = {
        id: created.id,
        cedula: formData.cedula,
        nombre: formData.nombre,
        email,
        createdAt: new Date(),
        extra: {
          ...formData.extra,
          'Fecha Ingreso': formData.extra['Fecha Ingreso']
        }
      };

      setUsers(prev => [...prev, newUser]);
      setFormData(initialFormData);
      setShowCreateForm(false);
      alert('Usuario creado exitosamente');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error al crear usuario:', error.message);
        alert(`Error al crear usuario: ${error.message}`);
      } else {
        console.error('Error desconocido:', error);
        alert('Error desconocido al crear usuario');
      }
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      await fetchCalendarEvents();

      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Error fetching users');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usersData: any[] = await res.json();

      const fetched: User[] = usersData.map(data => {
        const createdAt = data.created_at ? new Date(data.created_at) : new Date();
        const nombre = (data.nombre || '').toString().trim();

        let birthday: string = data.fecha_nacimiento || '';
        if (!birthday && nombre) {
          birthday = getBirthdayFromCalendar(nombre);
        }

        const completeExtra: UserExtra = {
          'Dpto Donde Labora': data.departamento || '',
          'ARL': data.arl || '',
          'Banco': data.banco || '',
          'CAJA DE COMPENSACION': data.caja_compensacion || '',
          'EPS': data.eps || '',
          'FONDO DE PENSIONES': data.fondo_pensiones || '',
          'Fecha Ingreso': data.fecha_ingreso || '',
          'Fondo Cesantías': data.fondo_cesantias || '',
          'Cargo Empleado': data.cargo_empleado || '',
          'Número Cuenta': data.numero_cuenta || '',
          'Tipo Cuenta': data.tipo_cuenta || '',
          'Tipo de Documento': data.tipo_documento || '',
          'posicion': data.posicion || '',
          'fechaNacimiento': birthday,
          'rol': (data.rol as 'user' | 'admin' | 'fondo') || 'user',
        };

        return {
          id: (data._id || data.id || '').toString(),
          cedula: data.cedula || '',
          nombre,
          email: data.email || '',
          createdAt,
          extra: completeExtra,
        };
      });
      setUsers(fetched);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;

    const updatedPayload = {
      id: editingUser.id,
      cedula: formData.cedula,
      nombre: formData.nombre,
      departamento: formData.extra['Dpto Donde Labora'],
      arl: formData.extra['ARL'],
      banco: formData.extra['Banco'],
      caja_compensacion: formData.extra['CAJA DE COMPENSACION'],
      eps: formData.extra['EPS'],
      fondo_pensiones: formData.extra['FONDO DE PENSIONES'],
      fecha_ingreso: formData.extra['Fecha Ingreso'],
      fondo_cesantias: formData.extra['Fondo Cesantías'],
      cargo_empleado: formData.extra['Cargo Empleado'],
      numero_cuenta: formData.extra['Número Cuenta'],
      tipo_cuenta: formData.extra['Tipo Cuenta'],
      tipo_documento: formData.extra['Tipo de Documento'],
      posicion: formData.extra['posicion'],
      fecha_nacimiento: formData.extra['fechaNacimiento'],
      rol: formData.extra['rol'],
    };

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload),
      });

      if (!res.ok) throw new Error('Error updating user');

      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === editingUser.id
            ? {
                ...user,
                cedula: formData.cedula,
                nombre: formData.nombre,
                extra: { ...formData.extra },
              }
            : user
        )
      );

      cancelEdit();
      alert("Usuario actualizado con éxito");
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error al actualizar usuario');
    }
  };

  const deleteUser = async (uid: string) => {
    if (!confirm('¿Eliminar este usuario permanentemente?')) return;

    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: uid })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }

      setUsers(prev => prev.filter(u => u.id !== uid));

      alert('Usuario eliminado completamente');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar usuario. Por favor intente nuevamente.');
    }
  };

  const handleInputChange = <K extends keyof UserExtra>(
  field: K,
  value: UserExtra[K]
): void => {
  setFormData(prev => ({
    ...prev,
    extra: {
      ...prev.extra,
      [field]: value
    }
  }));
};

  const startEdit = (user: User) => {
  setEditingUser(user);
  setFormData({
    cedula: user.cedula,
    nombre: user.nombre,
    extra: { ...user.extra },
  });
  setShowCreateForm(true);
};
  const cancelEdit = () => {
    setEditingUser(null);
    setFormData(initialFormData);
    setShowCreateForm(false);
  };

  const filteredUsers = users.filter(u => {
  const searchLower = searchTerm.toLowerCase();
  return (
    u.cedula?.toLowerCase().includes(searchLower) ||
    u.nombre?.toLowerCase().includes(searchLower) ||
    u.email?.toLowerCase().includes(searchLower)
  );
});

  const calculateAge = (birthday: string): number | null => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const adminCount = users.filter(u => u.extra?.rol === 'admin').length;
  const totalCount = users.length;

  return (
    <div className="text-black mt-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Black hero header */}
        <div className="relative p-5 sm:p-6 bg-black text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 90% 30%, #ff9900 0, transparent 50%)",
            }}
          />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#ff9900]/20 text-[#ff9900] flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">Gestión de Usuarios</h2>
                <p className="text-xs text-white/60">
                  {totalCount} {totalCount === 1 ? 'usuario' : 'usuarios'} · {adminCount} admin{adminCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff9900] text-black text-sm font-bold hover:bg-[#ffae33] active:scale-95 transition-all shadow-lg shadow-[#ff9900]/20"
            >
              <Plus className="h-4 w-4" /> Nuevo Usuario
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cédula, nombre o email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff9900] text-sm placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
              </h2>
              <button 
                onClick={cancelEdit}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b">Información Personal</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cédula *</label>
                  <input
                    type="text"
                    placeholder="Ingrese el número de cédula"
                    value={formData.cedula}
                    onChange={e => setFormData(prev => ({ ...prev, cedula: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    placeholder="Nombre y apellidos"
                    value={formData.nombre}
                    onChange={e =>
    setFormData(prev => ({ ...prev, nombre: e.target.value }))
  }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Cake className="h-4 w-4 text-pink-500" />
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    placeholder="Fecha de Nacimiento"
                    value={formData.extra['fechaNacimiento']}
                    onChange={e => handleInputChange('fechaNacimiento', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                  <select
                    value={formData.extra['Tipo de Documento']}
                    onChange={e => handleInputChange('Tipo de Documento', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccione un tipo</option>
                    <option value="Cédula Ciudadanía">Cédula Ciudadanía</option>
                    <option value="Cédula Extranjería">Cédula Extranjería</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                  <select
                    value={formData.extra.posicion}
                    onChange={e => handleInputChange('posicion', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccione un área</option>
                    <option value="COMERCIAL">COMERCIAL</option>
                    <option value="OPERATIVO">OPERATIVO</option>
                    <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                  </select>
                </div>
              </div>

              {/* Work Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b">Información Laboral</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento donde labora</label>
                  <input
                    type="text"
                    placeholder="Ej: Recursos Humanos"
                    value={formData.extra['Dpto Donde Labora']}
                    onChange={e => handleInputChange('Dpto Donde Labora', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo Empleado</label>
                  <input
                    type="text"
                    placeholder="Ej: TECNICO OPERATIVO"
                    value={formData.extra['Cargo Empleado']}
                    onChange={e => handleInputChange('Cargo Empleado', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                  <input
                    type="date"
                    value={formData.extra['Fecha Ingreso']}
                    onChange={e => handleInputChange('Fecha Ingreso', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol del Sistema</label>
                  <select
  value={formData.extra.rol}
  onChange={e =>
    handleInputChange('rol', e.target.value as 'user' | 'admin' | 'fondo')
  }
  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                    <option value="fondo">Fonalmerque</option>
                  </select>
                </div>
              </div>

              {/* Financial Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b">Información Financiera</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                  <input
                    type="text"
                    placeholder="Ej: BANCO DE BOGOTÁ"
                    value={formData.extra.Banco}
                    onChange={e => handleInputChange('Banco', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta</label>
                  <input
                    type="text"
                    placeholder="Ingrese el número de cuenta"
                    value={formData.extra['Número Cuenta']}
                    onChange={e => handleInputChange('Número Cuenta', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
                  <select
                    value={formData.extra['Tipo Cuenta']}
                    onChange={e => handleInputChange('Tipo Cuenta', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccione un tipo</option>
                    <option value="AHORRO">AHORRO</option>
                    <option value="CORRIENTE">CORRIENTE</option>
                  </select>
                </div>
              </div>

              {/* Benefits Info - Full Width */}
              <div className="md:col-span-2 lg:col-span-3 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 pb-2 border-b">Información de Beneficios</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ARL</label>
                    <input
                      type="text"
                      placeholder="Ej: ARP SURA"
                      value={formData.extra.ARL}
                      onChange={e => handleInputChange('ARL', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">EPS</label>
                    <input
                      type="text"
                      placeholder="Ej: EPS NUEVA EPS"
                      value={formData.extra.EPS}
                      onChange={e => handleInputChange('EPS', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Caja de Compensación</label>
                    <input
                      type="text"
                      placeholder="Ej: CAJA DE COMPENSACIÓN FAMILIAR COMFENALCO VALLE"
                      value={formData.extra['CAJA DE COMPENSACION']}
                      onChange={e => handleInputChange('CAJA DE COMPENSACION', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fondo de Pensiones</label>
                    <input
                      type="text"
                      placeholder="Ej: FONDO DE PENSIONES PORVENIR S.A."
                      value={formData.extra['FONDO DE PENSIONES']}
                      onChange={e => handleInputChange('FONDO DE PENSIONES', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fondo de Cesantías</label>
                    <input
                      type="text"
                      placeholder="Ej: Protección"
                      value={formData.extra['Fondo Cesantías']}
                      onChange={e => handleInputChange('Fondo Cesantías', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={cancelEdit} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingUser ? updateUser : createUser}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                {editingUser ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="overflow-hidden">
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Laboral</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Financiero</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cumpleaños</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ingreso</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">Cargando...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">No hay usuarios</td></tr>
                ) : (
                  filteredUsers.map(user => {
                    const age = calculateAge(user.extra?.['fechaNacimiento']);
                    const userRol = user.extra?.rol || 'user';
                    const isSpecialRole = userRol === 'admin' || userRol === 'fondo';
                    const initials = (user.nombre || 'U U')
                      .split(' ')
                      .map(p => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const rolBadge: Record<string, { bg: string; label: string }> = {
                      admin: { bg: 'bg-black text-[#ff9900]', label: 'Admin' },
                      fondo: { bg: 'bg-emerald-700 text-white', label: 'Fonalmerque' },
                    };
                    return (
                      <tr key={user.id} className="hover:bg-[#ff9900]/5 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isSpecialRole ? (userRol === 'admin' ? 'bg-black text-[#ff9900]' : 'bg-emerald-700 text-white') : 'bg-[#ff9900]/10 text-[#ff9900]'
                            }`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-bold text-gray-900 truncate">{user.nombre || 'Sin nombre'}</p>
                                {isSpecialRole && rolBadge[userRol] && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${rolBadge[userRol].bg}`}>{rolBadge[userRol].label}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">CC {user.cedula}</p>
                              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-gray-900 truncate max-w-[180px]">{user.extra?.['Cargo Empleado'] || '—'}</div>
                          <div className="text-xs mt-0.5">
                            <span className="font-semibold text-[#ff9900]">{user.extra?.posicion || '—'}</span>
                            {user.extra?.['Dpto Donde Labora'] && (
                              <span className="text-gray-400"> · {user.extra['Dpto Donde Labora']}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-gray-900">{user.extra?.Banco || '—'}</div>
                          <div className="text-xs text-gray-500">
                            {user.extra?.['Tipo Cuenta'] || ''}
                            {user.extra?.['Número Cuenta'] ? ` · ${user.extra['Número Cuenta']}` : ''}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {user.extra?.['fechaNacimiento'] ? (
                            <div className="flex items-center gap-1.5">
                              <Cake className="h-3.5 w-3.5 text-pink-500 flex-shrink-0" />
                              <div>
                                <div className="text-sm text-gray-900">
                                  {new Date(user.extra['fechaNacimiento']).toLocaleDateString('es-CO')}
                                </div>
                                {age !== null && (
                                  <div className="text-[11px] text-gray-400">{age} años</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600">
                          {user.extra?.['Fecha Ingreso']
                            ? new Date(user.extra['Fecha Ingreso']).toLocaleDateString('es-CO')
                            : '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => startEdit(user)}
                              className="p-2 rounded-lg text-gray-500 hover:text-[#ff9900] hover:bg-[#ff9900]/10 transition"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;