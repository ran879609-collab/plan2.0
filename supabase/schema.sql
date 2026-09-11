-- ==============================================================================
-- Walmart WFS Inventory & Shipment Manager
-- Supabase PostgreSQL Schema with Row Level Security (RLS)
-- ==============================================================================

-- 1. Profiles Table (1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shipments Table
CREATE TABLE IF NOT EXISTS public.shipments (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  shipment_name TEXT NOT NULL,
  ship_date TEXT NOT NULL,
  eta TEXT,
  arrival_date TEXT,
  fc TEXT NOT NULL,
  tracking TEXT,
  carrier TEXT,
  status TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_ship_qty INT DEFAULT 0,
  total_received_qty INT DEFAULT 0,
  total_discrepancy_qty INT DEFAULT 0,
  total_cartons INT DEFAULT 0,
  total_received_cartons INT DEFAULT 0,
  missing_cartons INT DEFAULT 0,
  channel TEXT,
  is_merged_customs BOOLEAN DEFAULT FALSE,
  customs_declaration_type TEXT,
  customs_batch_id TEXT,
  merged_customs_shipment_ids JSONB DEFAULT '[]'::jsonb,
  case_id TEXT,
  case_status TEXT,
  case_eligible_date TEXT,
  days_since_arrival INT,
  days_until_case INT,
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON public.shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_user_updated ON public.shipments(user_id, updated_at);

-- 3. Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  item_id TEXT,
  gtin TEXT,
  product_name TEXT NOT NULL,
  product_type TEXT,
  available INT DEFAULT 0,
  reserved INT DEFAULT 0,
  inbound INT DEFAULT 0,
  receiving INT DEFAULT 0,
  total_projected INT DEFAULT 0,
  safety_stock INT DEFAULT 0,
  min_stock INT,
  max_stock INT,
  target_stock INT,
  sales30_days INT,
  daily_avg_sales NUMERIC,
  days_of_supply INT,
  last_updated TEXT,
  source TEXT,
  reimbursed_units INT DEFAULT 0,
  reimbursed_amount NUMERIC DEFAULT 0,
  reimbursement_currency TEXT,
  reimbursement_cases JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON public.inventory(user_id);

-- 4. Cases Table
CREATE TABLE IF NOT EXISTS public.cases (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  item_id TEXT,
  product_name TEXT NOT NULL,
  discrepancy_qty INT DEFAULT 0,
  ship_qty INT DEFAULT 0,
  received_qty INT DEFAULT 0,
  arrival_date TEXT NOT NULL,
  eligible_date TEXT NOT NULL,
  case_open_date TEXT,
  status TEXT NOT NULL,
  walmart_response TEXT,
  resolution_qty INT,
  final_difference INT,
  closed_date TEXT,
  notes TEXT,
  reimbursement_status TEXT,
  reimbursement_type TEXT,
  reimbursed_units INT,
  reimbursed_amount NUMERIC,
  reimbursement_currency TEXT,
  reimbursement_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_shipment ON public.cases(user_id, shipment_id);

-- 5. Inventory Ledger Table
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  date TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT,
  before_qty INT DEFAULT 0,
  change_qty INT DEFAULT 0,
  after_qty INT DEFAULT 0,
  change_type TEXT NOT NULL,
  source TEXT,
  reference TEXT,
  notes TEXT,
  timestamp TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON public.inventory_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_sku ON public.inventory_ledger(user_id, sku);

-- 6. Products Table
CREATE TABLE IF NOT EXISTS public.products (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  item_id TEXT,
  gtin TEXT,
  product_name TEXT NOT NULL,
  product_type TEXT,
  safety_stock INT,
  min_stock INT,
  max_stock INT,
  target_stock INT,
  recent30_days_sales INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);

-- 7. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT,
  field TEXT,
  before_value TEXT,
  after_value TEXT,
  source TEXT,
  operator TEXT,
  details TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- 8. Anomalies Table
CREATE TABLE IF NOT EXISTS public.anomalies (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  level TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  description TEXT,
  shipment_id TEXT,
  reference_id TEXT,
  reference_type TEXT,
  detected_at TEXT,
  data JSONB,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_anomalies_user_id ON public.anomalies(user_id);

-- 9. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  case_rule_days INT DEFAULT 10,
  case_eligibility_days INT DEFAULT 10,
  approaching_alert_days INT DEFAULT 3,
  approaching_days_warning INT DEFAULT 3,
  auto_status_calculation BOOLEAN DEFAULT TRUE,
  auto_calculate_case BOOLEAN DEFAULT TRUE,
  auto_close_case_on_receipt BOOLEAN DEFAULT TRUE,
  allow_negative_inventory BOOLEAN DEFAULT FALSE,
  strict_arrival_date_required BOOLEAN DEFAULT TRUE,
  custom_today_date TEXT,
  current_simulated_date TEXT,
  is_demo BOOLEAN DEFAULT FALSE,
  synced_shipment_ids JSONB DEFAULT '[]'::jsonb,
  migration_completed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Freight Items Table
CREATE TABLE IF NOT EXISTS public.freight_items (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  ship_date TEXT NOT NULL,
  month_key TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  actual_qty INT DEFAULT 0,
  box_count INT DEFAULT 0,
  box_weight NUMERIC DEFAULT 0,
  box_length NUMERIC DEFAULT 0,
  box_width NUMERIC DEFAULT 0,
  box_height NUMERIC DEFAULT 0,
  dimensions_text TEXT,
  channel TEXT NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  is_merged_customs BOOLEAN DEFAULT FALSE,
  customs_declaration_type TEXT,
  customs_batch_key TEXT,
  merged_customs_shipment_ids JSONB DEFAULT '[]'::jsonb,
  extra_categories_count INT DEFAULT 0,
  extra_category_unit_price NUMERIC DEFAULT 0,
  extra_category_fee NUMERIC DEFAULT 0,
  mixed_box_group TEXT,
  is_secondary_mixed_item BOOLEAN DEFAULT FALSE,
  mixed_box_role TEXT,
  notes TEXT,
  volumetric_weight NUMERIC DEFAULT 0,
  volumetric_weight_per_box NUMERIC DEFAULT 0,
  billed_weight_per_box NUMERIC DEFAULT 0,
  chargeable_weight_per_box NUMERIC DEFAULT 0,
  total_chargeable_weight NUMERIC DEFAULT 0,
  pricing_method TEXT DEFAULT 'Weight',
  chargeable_type TEXT DEFAULT 'ACTUAL_WEIGHT',
  min_weight_applied BOOLEAN DEFAULT FALSE,
  estimated_item_freight NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_freight_items_user_id ON public.freight_items(user_id);
CREATE INDEX IF NOT EXISTS idx_freight_items_month ON public.freight_items(user_id, month_key);

-- 11. Freight Actuals Table
CREATE TABLE IF NOT EXISTS public.freight_actuals (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  actual_chargeable_weight NUMERIC,
  actual_cost NUMERIC,
  actual_unit_price NUMERIC,
  actual_customs_fee NUMERIC,
  actual_extra_category_fee NUMERIC,
  reconciliation_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, month_key, shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_freight_actuals_user_id ON public.freight_actuals(user_id);

-- ==============================================================================
-- Row Level Security (RLS) Configuration
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_actuals ENABLE ROW LEVEL SECURITY;

-- Profiles Policy
DROP POLICY IF EXISTS "Users can view and manage own profile" ON public.profiles;
CREATE POLICY "Users can view and manage own profile"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Shipments Policy
DROP POLICY IF EXISTS "Users can view and manage own shipments" ON public.shipments;
CREATE POLICY "Users can view and manage own shipments"
  ON public.shipments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inventory Policy
DROP POLICY IF EXISTS "Users can view and manage own inventory" ON public.inventory;
CREATE POLICY "Users can view and manage own inventory"
  ON public.inventory
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cases Policy
DROP POLICY IF EXISTS "Users can view and manage own cases" ON public.cases;
CREATE POLICY "Users can view and manage own cases"
  ON public.cases
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inventory Ledger Policy
DROP POLICY IF EXISTS "Users can view and manage own ledger" ON public.inventory_ledger;
CREATE POLICY "Users can view and manage own ledger"
  ON public.inventory_ledger
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Products Policy
DROP POLICY IF EXISTS "Users can view and manage own products" ON public.products;
CREATE POLICY "Users can view and manage own products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audit Logs Policy
DROP POLICY IF EXISTS "Users can view and manage own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view and manage own audit logs"
  ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anomalies Policy
DROP POLICY IF EXISTS "Users can view and manage own anomalies" ON public.anomalies;
CREATE POLICY "Users can view and manage own anomalies"
  ON public.anomalies
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- App Settings Policy
DROP POLICY IF EXISTS "Users can view and manage own settings" ON public.app_settings;
CREATE POLICY "Users can view and manage own settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Freight Items Policy
DROP POLICY IF EXISTS "Users can view and manage own freight items" ON public.freight_items;
CREATE POLICY "Users can view and manage own freight items"
  ON public.freight_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Freight Actuals Policy
DROP POLICY IF EXISTS "Users can view and manage own freight actuals" ON public.freight_actuals;
CREATE POLICY "Users can view and manage own freight actuals"
  ON public.freight_actuals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- Auth Trigger: Automatically create a Profile row when a new user signs up
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
