-- One row per driver (enables INSERT ... ON CONFLICT (driver_id) when incrementing deliveries)
DELETE FROM driver_tiers dt
WHERE dt.id NOT IN (
  SELECT MIN(id) FROM driver_tiers GROUP BY driver_id
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_tiers_driver_id ON driver_tiers(driver_id);
