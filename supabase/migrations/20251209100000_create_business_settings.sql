-- Migration: Create business_settings table for configurable app settings
-- This table stores key-value pairs for business configuration like tax rates, currency, etc.

-- Create the business_settings table
CREATE TABLE IF NOT EXISTS public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add comment for documentation
COMMENT ON TABLE public.business_settings IS 'Stores business configuration settings as key-value pairs';
COMMENT ON COLUMN public.business_settings.key IS 'Unique setting identifier (e.g., tax_rate, currency)';
COMMENT ON COLUMN public.business_settings.value IS 'JSON value containing the setting configuration';

-- Enable RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage business settings"
  ON public.business_settings
  FOR ALL
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

-- Policy: All authenticated users can read settings
CREATE POLICY "Authenticated users can read business settings"
  ON public.business_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER set_business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default settings
INSERT INTO public.business_settings (key, value, description) VALUES
  ('tax_rate', '{"rate": 0.0875, "enabled": true}'::jsonb, 'Default tax rate for sales (8.75%)'),
  ('currency', '{"code": "XOF", "locale": "fr-FR", "symbol": "CFA", "fractionDigits": 0}'::jsonb, 'Currency configuration for display'),
  ('stock_alerts', '{"defaultThreshold": 10, "enabled": true}'::jsonb, 'Stock alert threshold settings')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
