
ALTER TABLE demands
  ADD COLUMN area_id UUID REFERENCES demand_areas(id),
  ADD COLUMN assignee_id UUID REFERENCES demand_assignees(id),
  ADD COLUMN rfi_url TEXT;
