/*
  # Barbershop Booking System Schema

  ## Overview
  Creates a complete database schema for a barbershop booking system with user authentication,
  shop management, appointments, and queue tracking.

  ## New Tables
  
  ### 1. `profiles`
  Extends auth.users with additional user information
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - Either 'barber' or 'customer'
  - `phone` (text, optional) - Contact phone number
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `shops`
  Barbershop locations
  - `id` (uuid, primary key)
  - `name` (text) - Shop name
  - `address` (text) - Physical address
  - `latitude` (numeric, optional) - GPS coordinate
  - `longitude` (numeric, optional) - GPS coordinate
  - `phone` (text, optional) - Contact phone
  - `opening_time` (time) - Daily opening time
  - `closing_time` (time) - Daily closing time
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `shop_barbers`
  Associates barbers with shops
  - `id` (uuid, primary key)
  - `shop_id` (uuid) - References shops
  - `barber_id` (uuid) - References profiles (barbers only)
  - `created_at` (timestamptz)

  ### 4. `appointments`
  Customer bookings and queue management
  - `id` (uuid, primary key)
  - `shop_id` (uuid) - References shops
  - `customer_id` (uuid) - References profiles (customer)
  - `barber_id` (uuid, optional) - References profiles (assigned barber)
  - `status` (text) - 'waiting', 'in_progress', 'completed', 'cancelled'
  - `queue_position` (integer) - Position in queue
  - `service_type` (text) - Type of service requested
  - `notes` (text, optional) - Additional notes
  - `created_at` (timestamptz) - When appointment was created
  - `started_at` (timestamptz, optional) - When service started
  - `completed_at` (timestamptz, optional) - When service completed
  - `updated_at` (timestamptz)

  ## Security
  
  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Profiles: Users can read all profiles but only update their own
  - Shops: Public read access, only authenticated barbers can create/update
  - Shop Barbers: Read access for authenticated users, barbers can manage their associations
  - Appointments: Customers see their own, barbers see appointments for their shops
  
  ### Policies
  Each table has specific policies for SELECT, INSERT, UPDATE, and DELETE operations
  based on user roles and ownership.
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('barber', 'customer')),
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude numeric,
  longitude numeric,
  phone text,
  opening_time time DEFAULT '09:00:00',
  closing_time time DEFAULT '18:00:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shops"
  ON shops FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Barbers can create shops"
  ON shops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'barber'
    )
  );

CREATE POLICY "Barbers can update shops"
  ON shops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'barber'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'barber'
    )
  );

-- Create shop_barbers association table
CREATE TABLE IF NOT EXISTS shop_barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, barber_id)
);

ALTER TABLE shop_barbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shop barbers"
  ON shop_barbers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Barbers can associate with shops"
  ON shop_barbers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = barber_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'barber'
    )
  );

CREATE POLICY "Barbers can remove their associations"
  ON shop_barbers FOR DELETE
  TO authenticated
  USING (auth.uid() = barber_id);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  queue_position integer NOT NULL DEFAULT 0,
  service_type text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = barber_id
    OR EXISTS (
      SELECT 1 FROM shop_barbers
      WHERE shop_barbers.shop_id = appointments.shop_id
      AND shop_barbers.barber_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'customer'
    )
  );

CREATE POLICY "Customers can cancel own appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (
    auth.uid() = customer_id
    AND status = 'cancelled'
  );

CREATE POLICY "Barbers can update appointments in their shops"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shop_barbers
      WHERE shop_barbers.shop_id = appointments.shop_id
      AND shop_barbers.barber_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shop_barbers
      WHERE shop_barbers.shop_id = appointments.shop_id
      AND shop_barbers.barber_id = auth.uid()
    )
  );

CREATE POLICY "Barbers can delete appointments in their shops"
  ON appointments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shop_barbers
      WHERE shop_barbers.shop_id = appointments.shop_id
      AND shop_barbers.barber_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_shop_barbers_shop_id ON shop_barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_barbers_barber_id ON shop_barbers(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_shop_id ON appointments(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_queue ON appointments(shop_id, status, queue_position);