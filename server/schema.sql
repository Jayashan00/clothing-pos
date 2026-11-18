-- Optional: the API creates this table by itself on first use.
-- Run it manually in hPanel → phpMyAdmin if you prefer.
CREATE TABLE IF NOT EXISTS redipos_records (
  store VARCHAR(32) NOT NULL,
  id VARCHAR(80) NOT NULL,
  data LONGTEXT NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT 0,
  server_ts BIGINT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  terminal VARCHAR(12) NOT NULL DEFAULT '',
  PRIMARY KEY (store, id),
  KEY idx_server_ts (server_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
