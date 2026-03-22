-- Track how a driver was matched (e.g. route posting vs nearby) for in-app messaging.
ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS matched_via VARCHAR(20);
