
-- Create platform enum
CREATE TYPE public.platform_type AS ENUM ('gist', 'stripe', 'linear', 'notion', 'tudo1', 'whatsapp', 'slack', 'custom');

-- Create auth type enum
CREATE TYPE public.auth_type AS ENUM ('api_key', 'oauth', 'token');

-- Create metric type enum
CREATE TYPE public.metric_type AS ENUM ('count', 'sum', 'avg', 'percentage', 'custom');

-- Create chart type enum
CREATE TYPE public.chart_type AS ENUM ('line', 'bar', 'donut', 'number');

-- Create condition type enum
CREATE TYPE public.condition_type AS ENUM ('threshold', 'percentage_change', 'compound');

-- Integrations table
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform platform_type NOT NULL,
  name TEXT NOT NULL,
  auth_type auth_type NOT NULL DEFAULT 'api_key',
  credentials JSONB NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data sources table
CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  endpoint_path TEXT NOT NULL,
  label TEXT NOT NULL,
  data_schema JSONB NOT NULL DEFAULT '{}',
  sync_interval INTEGER NOT NULL DEFAULT 300,
  last_synced_at TIMESTAMPTZ,
  is_enabled BOOLEAN NOT NULL DEFAULT true
);

-- KPI Indicators table
CREATE TABLE public.kpi_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  metric_type metric_type NOT NULL DEFAULT 'count',
  formula TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  chart_type chart_type NOT NULL DEFAULT 'number',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert rules table
CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kpi_indicator_id UUID REFERENCES public.kpi_indicators(id) ON DELETE CASCADE NOT NULL,
  condition_type condition_type NOT NULL DEFAULT 'threshold',
  conditions JSONB NOT NULL DEFAULT '{}',
  notification_channels JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert logs table
CREATE TABLE public.alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE CASCADE NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  value_at_trigger NUMERIC,
  notification_sent_to JSONB NOT NULL DEFAULT '[]'
);

-- Enable RLS on all tables
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

-- RLS: integrations
CREATE POLICY "Users manage own integrations" ON public.integrations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS: data_sources (via integration ownership)
CREATE POLICY "Users manage own data sources" ON public.data_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.integrations WHERE id = data_sources.integration_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.integrations WHERE id = data_sources.integration_id AND user_id = auth.uid())
  );

-- RLS: kpi_indicators
CREATE POLICY "Users manage own indicators" ON public.kpi_indicators
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS: alert_rules
CREATE POLICY "Users manage own alert rules" ON public.alert_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS: alert_logs (via alert_rule ownership)
CREATE POLICY "Users view own alert logs" ON public.alert_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.alert_rules WHERE id = alert_logs.alert_rule_id AND user_id = auth.uid())
  );
