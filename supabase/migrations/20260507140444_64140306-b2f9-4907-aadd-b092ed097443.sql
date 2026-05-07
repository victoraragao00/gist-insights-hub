ALTER TABLE demand_areas ADD COLUMN IF NOT EXISTS background_color TEXT;
COMMENT ON COLUMN demand_areas.background_color IS 'Cor de fundo da raia no Swimlane TECH. Ex: #F0EDFF.';