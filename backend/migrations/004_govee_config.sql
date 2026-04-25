-- Govee IoT light configuration per user
CREATE TABLE IF NOT EXISTS govee_config (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    text NOT NULL UNIQUE,
    config     jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE govee_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own govee config"
    ON govee_config FOR ALL
    USING (auth.uid()::text = user_id);

-- Auto-update timestamp
CREATE OR REPLACE TRIGGER govee_config_updated
    BEFORE UPDATE ON govee_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
