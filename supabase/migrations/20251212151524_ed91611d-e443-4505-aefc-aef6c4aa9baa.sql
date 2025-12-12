-- Create a unique index on lowercase group names to prevent duplicates
CREATE UNIQUE INDEX idx_groups_name_lower ON groups (LOWER(name));