ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "gps_tracking": false,
  "hostel": false,
  "ai_copilot": true,
  "parent_portal": true,
  "advanced_analytics": false
}'::jsonb;
