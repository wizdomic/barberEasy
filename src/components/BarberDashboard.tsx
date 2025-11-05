import { useState, useEffect } from 'react';
import { MapPin, Clock, Check, X, Play } from 'lucide-react';
import { supabase, Shop, Appointment, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type AppointmentWithCustomer = Appointment & {
  customer: Profile;
};

export function BarberDashboard() {
  const { user, signOut } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    if (selectedShop) {
      loadAppointments();

      const subscription = supabase
        .channel('appointments_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `shop_id=eq.${selectedShop.id}`
        }, () => {
          loadAppointments();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [selectedShop]);

  const loadShops = async () => {
    const { data } = await supabase
      .from('shop_barbers')
      .select('shop_id, shops(*)')
      .eq('barber_id', user?.id);

    if (data) {
      const shopList = data.map(item => item.shops).filter(Boolean) as Shop[];
      setShops(shopList);
      if (shopList.length > 0 && !selectedShop) {
        setSelectedShop(shopList[0]);
      }
    }
  };

  const loadAppointments = async () => {
    if (!selectedShop) return;

    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        customer:profiles!appointments_customer_id_fkey(*)
      `)
      .eq('shop_id', selectedShop.id)
      .in('status', ['waiting', 'in_progress'])
      .order('queue_position');

    if (data) {
      setAppointments(data as AppointmentWithCustomer[]);
    }
  };

  const updateAppointmentStatus = async (id: string, status: string, updates: Partial<Appointment> = {}) => {
    setLoading(true);
    try {
      const updateData: any = { status, ...updates };

      if (status === 'in_progress') {
        updateData.started_at = new Date().toISOString();
        updateData.barber_id = user!.id;
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      await loadAppointments();
    } catch (err) {
      alert('Failed to update appointment');
    } finally {
      setLoading(false);
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to remove this appointment?')) return;

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (!error) {
      await loadAppointments();
    }
  };

  const waitingAppointments = appointments.filter(a => a.status === 'waiting');
  const inProgressAppointments = appointments.filter(a => a.status === 'in_progress');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Barber Dashboard</h1>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Shop
          </label>
          <div className="grid md:grid-cols-3 gap-4">
            {shops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => setSelectedShop(shop)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  selectedShop?.id === shop.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <div className="font-semibold text-gray-900">{shop.name}</div>
                <div className="text-sm text-gray-600 flex items-center mt-1">
                  <MapPin className="w-3 h-3 mr-1" />
                  {shop.address}
                </div>
                <div className="text-sm text-gray-600 flex items-center mt-1">
                  <Clock className="w-3 h-3 mr-1" />
                  {shop.opening_time} - {shop.closing_time}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedShop && (
          <div className="grid md:grid-cols-2 gap-8">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                In Progress ({inProgressAppointments.length})
              </h2>
              <div className="space-y-4">
                {inProgressAppointments.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                    No appointments in progress
                  </div>
                ) : (
                  inProgressAppointments.map((appointment) => (
                    <div key={appointment.id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{appointment.customer.full_name}</h3>
                          <p className="text-sm text-gray-600">{appointment.service_type.replace('_', ' ')}</p>
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          In Progress
                        </span>
                      </div>
                      {appointment.notes && (
                        <p className="text-sm text-gray-600 mb-3">{appointment.notes}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                          disabled={loading}
                          className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Complete
                        </button>
                        <button
                          onClick={() => deleteAppointment(appointment.id)}
                          disabled={loading}
                          className="px-4 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Waiting Queue ({waitingAppointments.length})
              </h2>
              <div className="space-y-4">
                {waitingAppointments.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                    No appointments in queue
                  </div>
                ) : (
                  waitingAppointments.map((appointment) => (
                    <div key={appointment.id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-blue-600">#{appointment.queue_position}</span>
                            <h3 className="font-semibold text-gray-900">{appointment.customer.full_name}</h3>
                          </div>
                          <p className="text-sm text-gray-600">{appointment.service_type.replace('_', ' ')}</p>
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Waiting
                        </span>
                      </div>
                      {appointment.notes && (
                        <p className="text-sm text-gray-600 mb-3">{appointment.notes}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateAppointmentStatus(appointment.id, 'in_progress')}
                          disabled={loading}
                          className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Start Service
                        </button>
                        <button
                          onClick={() => deleteAppointment(appointment.id)}
                          disabled={loading}
                          className="px-4 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}