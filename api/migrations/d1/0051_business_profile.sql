-- Keep legal structure separate from a work category and the CIS tax scheme.
-- Null means the owner has not supplied this detail; do not infer it from CIS.
ALTER TABLE teams ADD COLUMN business_structure TEXT
  CHECK (business_structure IS NULL OR business_structure IN (
    'sole_trader', 'limited_company', 'partnership', 'limited_liability_partnership', 'other', 'not_sure'
  ));
ALTER TABLE teams ADD COLUMN uses_cis INTEGER
  CHECK (uses_cis IS NULL OR uses_cis IN (0, 1));
