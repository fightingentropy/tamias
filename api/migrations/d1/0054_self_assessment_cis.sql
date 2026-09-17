-- Statement figures are separate from the immutable net bank payment.
-- NULL preserves existing reviews and clients without CIS support.
ALTER TABLE self_assessment_reviews ADD COLUMN cis_json TEXT
  CHECK (cis_json IS NULL OR json_valid(cis_json));
