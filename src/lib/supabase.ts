import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'barber' | 'customer';
  phone?: string;
  created_at: string;
  updated_at: string;
};

export type Shop = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  opening_time: string;
  closing_time: string;
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  shop_id: string;
  customer_id: string;
  barber_id?: string;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  queue_position: number;
  service_type: string;
  notes?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
};