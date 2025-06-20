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
  Building,
  CreditCard,
  Calendar
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

interface UserExtra {
  'Dpto Donde Labora': string;
  'ARL': string;
  'Banco': string;
  'CAJA DE COMPENSACION': string;
  'EPS': string;
  'FONDO DE PENSIONES': string;
  'Fecha Ingreso': string; // Changed to string for date input
  'Fondo Cesantías': string;
  'Nombre Área Funcional': string;
  'Número Cuenta': string;
  'Tipo Cuenta': string;
  'Tipo de Documento': string;
  'nombre': string;
  'posicion': string;
  'rol': string;
}

interface User {
  id: string;
  cedula: string;
  email: string;
  createdAt: Date;
  nombre: string;       
  extra: UserExtra;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial form data - Fixed default values
  const initialFormData: Omit<User, 'id' | 'email' | 'createdAt'> = {
    cedula: '',
    extra: {
      'Dpto Donde Labora': '',
      'ARL': '',
      'Banco': '',
      'CAJA DE COMPENSACION': '',
      'EPS': '',
      'FONDO DE PENSIONES': '',
      'Fecha Ingreso': '', // Changed from 0 to empty string
      'Fondo Cesantías': '',
      'Nombre Área Funcional': '',
      'Número Cuenta': '',
      'Tipo Cuenta': '',
      'Tipo de Documento': '',
      'nombre': '',
      'posicion': '',
      'rol': 'user'
    }
  };
  const [formData, setFormData] = useState(initialFormData);

const generateCredentials = (cedula: string) => {
  return {
    email: `${cedula}@merque.com`,
    password: `${cedula.slice(-4)}11`
  };
};

// Convert date to Excel serial number (days since 1900-01-01)
const dateToExcelSerial = (dateString: string): number => {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const epoch = new Date(1900, 0, 1);
  const diffTime = date.getTime() - epoch.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for Excel's leap year bug
  return diffDays;
};

// Convert Excel serial number back to date
const excelSerialToDate = (serial: number): string => {
  if (!serial || serial === 0) return '';
  const epoch = new Date(1900, 0, 1);
  const date = new Date(epoch.getTime() + (serial - 1) * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

// 2. createUser implementation
const createUser = async () => {
  const { email, password } = generateCredentials(formData.cedula);

  // Build the full payload
  const newUserPayload = {
    cedula: formData.cedula,
    email,
    password,
    createdAt: new Date(),           // or serverTimestamp() in your API
    extra: {
      'Dpto Donde Labora': formData.extra['Dpto Donde Labora'],
      'ARL': formData.extra['ARL'],
      'Banco': formData.extra['Banco'],
      'CAJA DE COMPENSACION': formData.extra['CAJA DE COMPENSACION'],
      'EPS': formData.extra['EPS'],
      'FONDO DE PENSIONES': formData.extra['FONDO DE PENSIONES'],
      'Fecha Ingreso': dateToExcelSerial(formData.extra['Fecha Ingreso']), // Convert to number
      'Fondo Cesantías': formData.extra['Fondo Cesantías'],
      'Nombre Área Funcional': formData.extra['Nombre Área Funcional'],
      'Número Cuenta': formData.extra['Número Cuenta'],
      'Tipo Cuenta': formData.extra['Tipo Cuenta'],
      'Tipo de Documento': formData.extra['Tipo de Documento'],
      'nombre': formData.extra['nombre'],
      'posicion': formData.extra['posicion'],
      'rol': formData.extra['rol'],
    }
  };

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserPayload)
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const created = await res.json();
    setUsers(u => [...u, created]);
    setFormData(initialFormData);
    setShowCreateForm(false);
  } catch (err) {
    console.error('Error creating user:', err);
  }
};

  // Fetch users directly from Firestore
const fetchUsers = async () => {
  setLoading(true);
  try {
    const snap = await getDocs(collection(db, 'users'));
    const fetched: User[] = snap.docs.map(doc => {
      const data = doc.data() as any;
      const extra = data.extra || {};
      return {
        id: doc.id,
        cedula: data.cedula,
        email: data.email,
        nombre: data.nombre,
        createdAt: data.createdAt.toDate(),  
        extra: {
          ...extra,
          'Fecha Ingreso': typeof extra['Fecha Ingreso'] === 'number'
            ? excelSerialToDate(extra['Fecha Ingreso'])
            : extra['Fecha Ingreso'] || ''
        }
      };
    });
    setUsers(fetched);
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    setLoading(false);
  }
};

  // Update user
  const updateUser = async () => {
    if (!editingUser) return;
    
    const updatedPayload = {
      cedula: formData.cedula,
      extra: {
        ...formData.extra,
        'Fecha Ingreso': dateToExcelSerial(formData.extra['Fecha Ingreso']) // Convert to number
      }
    };

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload)
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const updated = await res.json();
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id ? updated : user
        )
      );
      
      cancelEdit();
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  // Handle input
  const handleInputChange = (field: string, value: any, isExtra = false) => {
    if (isExtra) {
      setFormData(prev => ({
        ...prev,
        extra: { ...prev.extra, [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Start edit
  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ cedula: user.cedula, extra: user.extra });
    setShowCreateForm(true);
  };

  // Cancel
  const cancelEdit = () => {
    setEditingUser(null);
    setFormData(initialFormData);
    setShowCreateForm(false);
  };

  // Fixed filtered users with proper null checks
  const filteredUsers = users.filter(u => {
    const searchLower = searchTerm.toLowerCase();
    return (
      u.cedula?.includes(searchTerm) ||
      u.extra?.nombre?.toLowerCase().includes(searchLower) ||
      u.email?.includes(searchTerm)
    );
  });

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
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
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
              className="w-full pl-10 py-2 border rounded-lg"
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
              <button onClick={cancelEdit}><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Personal Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Información Personal</label>
                  <input
                    type="text"
                    placeholder="Cédula *"
                    value={formData.cedula}
                    onChange={e => handleInputChange('cedula', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Nombre Completo *"
                  value={formData.extra.nombre}
                  onChange={e => handleInputChange('nombre', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <select
                  value={formData.extra['Tipo de Documento']}
                  onChange={e => handleInputChange('Tipo de Documento', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Tipo de Documento</option>
                  <option value="Cédula Ciudadanía">Cédula Ciudadanía</option>
                  <option value="Cédula Extranjería">Cédula Extranjería</option>
                  <option value="Pasaporte">Pasaporte</option>
                </select>
                <select
                  value={formData.extra.posicion}
                  onChange={e => handleInputChange('posicion', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Posición</option>
                  <option value="CONDUCTOR">CONDUCTOR</option>
                  <option value="AUXILIAR">AUXILIAR</option>
                  <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                </select>
              </div>

              {/* Work Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Información Laboral</label>
                  <input
                    type="text"
                    placeholder="Departamento donde labora"
                    value={formData.extra['Dpto Donde Labora']}
                    onChange={e => handleInputChange('Dpto Donde Labora', e.target.value, true)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Área Funcional"
                  value={formData.extra['Nombre Área Funcional']}
                  onChange={e => handleInputChange('Nombre Área Funcional', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <input
                  type="date"
                  placeholder="Fecha de Ingreso"
                  value={formData.extra['Fecha Ingreso']}
                  onChange={e => handleInputChange('Fecha Ingreso', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <select
                  value={formData.extra.rol}
                  onChange={e => handleInputChange('rol', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {/* Financial & Benefits Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Información Financiera</label>
                  <input
                    type="text"
                    placeholder="Banco"
                    value={formData.extra.Banco}
                    onChange={e => handleInputChange('Banco', e.target.value, true)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Número de Cuenta"
                  value={formData.extra['Número Cuenta']}
                  onChange={e => handleInputChange('Número Cuenta', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <select
                  value={formData.extra['Tipo Cuenta']}
                  onChange={e => handleInputChange('Tipo Cuenta', e.target.value, true)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Tipo de Cuenta</option>
                  <option value="AHORRO">AHORRO</option>
                  <option value="CORRIENTE">CORRIENTE</option>
                </select>
              </div>

              {/* Benefits Info - Full Width */}
              <div className="md:col-span-2 lg:col-span-3 space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Información de Beneficios</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="ARL"
                    value={formData.extra.ARL}
                    onChange={e => handleInputChange('ARL', e.target.value, true)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="EPS"
                    value={formData.extra.EPS}
                    onChange={e => handleInputChange('EPS', e.target.value, true)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Caja de Compensación"
                    value={formData.extra['CAJA DE COMPENSACION']}
                    onChange={e => handleInputChange('CAJA DE COMPENSACION', e.target.value, true)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Fondo de Pensiones"
                    value={formData.extra['FONDO DE PENSIONES']}
                    onChange={e => handleInputChange('FONDO DE PENSIONES', e.target.value, true)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Fondo de Cesantías"
                    value={formData.extra['Fondo Cesantías']}
                    onChange={e => handleInputChange('Fondo Cesantías', e.target.value, true)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={cancelEdit} className="px-4 py-2 border rounded-lg">Cancelar</button>
              <button
                onClick={editingUser ? updateUser : createUser}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {editingUser ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laboral</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Financiero</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Ingreso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">Cargando...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">No hay usuarios</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm font-medium">{user.nombre || 'Sin nombre'}</div>
                      <div className="text-sm text-gray-500">Cédula: {user.cedula}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">{user.extra?.['Nombre Área Funcional'] || ''}</div>
                      <div className="text-sm text-gray-500">{user.extra?.['Dpto Donde Labora'] || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{user.extra?.Banco || 'Sin banco'}</div>
                      <div className="text-sm text-gray-500">
                        {user.extra?.['Tipo Cuenta'] || ''} {user.extra?.['Número Cuenta'] ? `· ${user.extra['Número Cuenta']}` : ''}
                      </div>
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
                      <button onClick={() => startEdit(user)} className="text-blue-600 mr-3">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteUser(user.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;