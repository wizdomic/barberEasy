import { useState, useEffect } from 'react';
import { MapPin, Clock, Plus, X } from 'lucide-react';
import { supabase, Shop, Appointment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function CustomerDashboard() {
  const { user, signOut } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [serviceType, setServiceType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShops();
    loadAppointments();
  }, []);

  const loadShops = async () => {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .order('name');
    if (data) setShops(data);
  };

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('customer_id', user?.id)
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: false });
    if (data) setAppointments(data);
  };

  const createAppointment = async () => {
    if (!selectedShop || !serviceType) return;

    setLoading(true);
    try {
      const { data: queueData } = await supabase
        .from('appointments')
        .select('queue_position')
        .eq('shop_id', selectedShop.id)
        .eq('status', 'waiting')
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextPosition = queueData ? queueData.queue_position + 1 : 1;

      const { error } = await supabase
        .from('appointments')
        .insert({
          shop_id: selectedShop.id,
          customer_id: user!.id,
          service_type: serviceType,
          notes: notes || undefined,
          status: 'waiting',
          queue_position: nextPosition,
        });

      if (error) throw error;

      setSelectedShop(null);
      setServiceType('');
      setNotes('');
      loadAppointments();
    } catch (err) {
      alert('Failed to create appointment');
    } finally {
      setLoading(false);
    }
  };

  const cancelAppointment = async (id: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (!error) {
      loadAppointments();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Customer Dashboard</h1>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Book an Appointment</h2>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Shop
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {shops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => setSelectedShop(shop)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        selectedShop?.id === shop.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{shop.name}</div>
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
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Type
                    </label>
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a service</option>
                      <option value="haircut">Haircut</option>
                      <option value="beard_trim">Beard Trim</option>
                      <option value="haircut_beard">Haircut + Beard</option>
                      <option value="shave">Shave</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any special requests?"
                    />
                  </div>

                  <button
                    onClick={createAppointment}
                    disabled={loading || !serviceType}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {loading ? 'Booking...' : 'Book Appointment'}
                  </button>
                </>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Appointments</h2>
            <div className="space-y-4">
              {appointments.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  No active appointments
                </div>
              ) : (
                appointments.map((appointment) => {
                  const shop = shops.find(s => s.id === appointment.shop_id);
                  return (
                    <div key={appointment.id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{shop?.name}</h3>
                          <p className="text-sm text-gray-600">{appointment.service_type.replace('_', ' ')}</p>
                        </div>
                        <button
                          onClick={() => cancelAppointment(appointment.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <span className="font-medium text-gray-700 w-24">Status:</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            appointment.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {appointment.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center text-sm">
                          <span className="font-medium text-gray-700 w-24">Queue:</span>
                          <span className="text-gray-900">Position #{appointment.queue_position}</span>
                        </div>
                        {appointment.notes && (
                          <div className="flex items-start text-sm">
                            <span className="font-medium text-gray-700 w-24">Notes:</span>
                            <span className="text-gray-600">{appointment.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}