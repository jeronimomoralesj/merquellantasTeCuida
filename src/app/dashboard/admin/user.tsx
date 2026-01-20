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
import { 
  collection, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp, 
  setDoc,
  Timestamp,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { secondaryAuth } from '../../../firebase';

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
  'rol': 'user' | 'admin';
}

interface User {
  id: string;
  cedula: string;
  email: string;
  password: string;
  createdAt: Date;
  extra: UserExtra;
  nombre: string;
}

interface FirestoreUserData {
  cedula?: string;
  email?: string;
  password?: string;
  createdAt?: Timestamp | Date;
  extra?: Partial<UserExtra> & {
    'Fecha Ingreso'?: string | number;
    'fechaNacimiento'?: string;
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Timestamp | Date | { toDate: () => Date };
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

  const generateCredentials = (cedula: string) => {
    return {
      email: `${cedula}@merque.com`,
      password: `${cedula.slice(-4)}11`
    };
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
      const eventsRef = collection(db, 'calendar');
      const q = query(eventsRef, where('type', '==', 'birthday'));
      const querySnapshot = await getDocs(q);
      const events: CalendarEvent[] = [];
      querySnapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...doc.data()
        } as CalendarEvent);
      });
      setCalendarEvents(events);
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
      let date: Date;

      if (typeof birthdayEvent.date === 'object' && birthdayEvent.date !== null && 'toDate' in birthdayEvent.date) {
        date = birthdayEvent.date.toDate();
      } else if (birthdayEvent.date instanceof Date) {
        date = birthdayEvent.date;
      } else {
        date = new Date(birthdayEvent.date);
      }

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

    const { email, password } = generateCredentials(formData.cedula);

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const createdAt = serverTimestamp();

      const payload = {
  cedula: formData.cedula,
  nombre: formData.nombre,
  email,
  password,
  createdAt,
  extra: {
    ...formData.extra,
    'Fecha Ingreso': dateToExcelSerial(formData.extra['Fecha Ingreso']),
  }
};

      await setDoc(userDocRef, payload);

      const newUser: User = {
        id: userDocRef.id,
        cedula: formData.cedula,
        email,
        password,
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
      
      const snap = await getDocs(collection(db, 'users'));
      const fetched: User[] = snap.docs.map(docSnap => {
        const data: FirestoreUserData = docSnap.data() || {};
        const rawExtra: Partial<UserExtra> & { 'Fecha Ingreso'?: string | number; 'fechaNacimiento'?: string } = data.extra || {};

        let createdAt: Date;
        if (data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt) {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt instanceof Date) {
          createdAt = data.createdAt;
        } else {
          createdAt = new Date();
        }

        const nombre = data.nombre?.toString().trim() || '';

        let birthday: string = '';
        if (rawExtra.fechaNacimiento) {
          birthday = typeof rawExtra.fechaNacimiento === 'string' 
            ? rawExtra.fechaNacimiento 
            : rawExtra.fechaNacimiento.toString();
        }

        if (!birthday && nombre) {
          birthday = getBirthdayFromCalendar(nombre);
        }

        const completeExtra: UserExtra = {
          'Dpto Donde Labora': rawExtra['Dpto Donde Labora']?.toString() || '',
          'ARL': rawExtra['ARL']?.toString() || '',
          'Banco': rawExtra['Banco']?.toString() || '',
          'CAJA DE COMPENSACION': rawExtra['CAJA DE COMPENSACION']?.toString() || '',
          'EPS': rawExtra['EPS']?.toString() || '',
          'FONDO DE PENSIONES': rawExtra['FONDO DE PENSIONES']?.toString() || '',
          'Fecha Ingreso':
            typeof rawExtra['Fecha Ingreso'] === 'number'
              ? excelSerialToDate(rawExtra['Fecha Ingreso'])
              : rawExtra['Fecha Ingreso']?.toString() || '',
          'Fondo Cesantías': rawExtra['Fondo Cesantías']?.toString() || '',
          'Cargo Empleado': rawExtra['Cargo Empleado']?.toString() || '',
          'Número Cuenta': rawExtra['Número Cuenta']?.toString() || '',
          'Tipo Cuenta': rawExtra['Tipo Cuenta']?.toString() || '',
          'Tipo de Documento': rawExtra['Tipo de Documento']?.toString() || '',
          'posicion': rawExtra['posicion']?.toString() || '',
          'fechaNacimiento': birthday,
          'rol': (rawExtra['rol'] as 'user' | 'admin') || 'user',
        };

        return {
  id: docSnap.id,
  cedula: data.cedula || '',
  nombre,
  email: data.email || '',
  password: data.password || '',
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
  cedula: formData.cedula,
  nombre: formData.nombre,
  extra: {
    ...formData.extra,
    'Fecha Ingreso': dateToExcelSerial(formData.extra['Fecha Ingreso']),
  }
};

    try {
      const userDocRef = doc(db, 'users', editingUser.id);
      await updateDoc(userDocRef, updatedPayload);
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id 
            ? { 
                ...user, 
                ...updatedPayload,
                extra: {
                  ...updatedPayload.extra,
                  'Fecha Ingreso': formData.extra['Fecha Ingreso']
                }
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
        body: JSON.stringify({ uid })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }

      const calendarRef = collection(db, 'calendar');
      const q = query(calendarRef, where('userId', '==', uid), where('type', '==', 'birthday'));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(async (docSnapshot) => {
        await deleteDoc(doc(db, 'calendar', docSnapshot.id));
      });
      
      await Promise.all(deletePromises);

      setUsers(prev => prev.filter(u => u.id !== uid));
      
      alert('Usuario y eventos de cumpleaños eliminados completamente');
    } catch (error) {
      console.error('Error deleting user and calendar events:', error);
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

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <User className="h-8 w-8 text-blue-600" /> Gestión de Usuarios
            </h1>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" /> Nuevo Usuario
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cédula, nombre o email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <option value="CONDUCTOR">COMERCIAL</option>
                    <option value="AUXILIAR">OPERATIVO</option>
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
    handleInputChange('rol', e.target.value as 'user' | 'admin')
  }
  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Laboral</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Financiero</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cumpleaños</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Ingreso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-4 text-center">Cargando...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No hay usuarios</td></tr>
                ) : (
                  filteredUsers.map(user => {
                    const age = calculateAge(user.extra?.['fechaNacimiento']);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.nombre || 'Sin nombre'}</div>
                          <div className="text-sm text-gray-500">Cédula: {user.cedula}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            Rol: {user.extra?.rol === 'admin' ? '👑 Admin' : '👤 Usuario'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{user.extra?.['Cargo Empleado'] || 'Sin cargo'}</div>
                          <div className="text-sm text-gray-500">{user.extra?.posicion || ''}</div>
                          <div className="text-sm text-gray-500">{user.extra?.['Dpto Donde Labora'] || ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{user.extra?.Banco || 'Sin banco'}</div>
                          <div className="text-sm text-gray-500">
                            {user.extra?.['Tipo Cuenta'] || ''} {user.extra?.['Número Cuenta'] ? `· ${user.extra['Número Cuenta']}` : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.extra?.['fechaNacimiento'] ? (
                            <div>
                              <div className="text-sm text-gray-900 flex items-center gap-1">
                                <Cake className="h-3 w-3 text-pink-500" />
                                {new Date(user.extra['fechaNacimiento']).toLocaleDateString('es-CO')}
                              </div>
                              {age !== null && (
                                <div className="text-xs text-gray-500">{age} años</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Sin fecha</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.extra?.['Fecha Ingreso'] 
                            ? new Date(user.extra['Fecha Ingreso']).toLocaleDateString('es-CO')
                            : 'Sin fecha'
                          }
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.createdAt.toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          <button 
                            onClick={() => startEdit(user)} 
                            className="text-blue-600 hover:text-blue-800 mr-3 transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => deleteUser(user.id)} 
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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