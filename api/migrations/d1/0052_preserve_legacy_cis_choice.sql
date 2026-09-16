-- Preserve an existing CIS choice in the separate field. Legal structure stays unchanged.
-- Once migrated, NULL can represent an explicit "Not sure yet" choice in settings.
UPDATE teams SET uses_cis = 1 WHERE company_type = 'cis_subcontractor' AND uses_cis IS NULL;
