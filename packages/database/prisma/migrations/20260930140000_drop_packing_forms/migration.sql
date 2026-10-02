-- Remove the redundant PackingForm concept.
--
-- `PackingForm` ("Pakavimo formos": Dėžė, Maišas, Metalinis narvas, Rulonas) and
-- `PackagingType` ("Tara") had overlapping meaning. The confirmed receiving model
-- uses `PackagingType` as the canonical physical package type + tare weight, so
-- `PackingForm` is dropped.
--
-- Preservation: every distinct packing-form name that does not already exist as a
-- PackagingType is inserted as an active master-data row with tare 0.000 kg (a
-- zero tare is valid where physically appropriate, e.g. a metal cage or a roll).
-- Matching is by exact name, so no duplicate PackagingType is created.

INSERT INTO "packaging_types" ("id", "name", "tare_weight_kg", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), pf."name", 0.000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "packing_forms" pf
WHERE NOT EXISTS (
    SELECT 1 FROM "packaging_types" pt WHERE pt."name" = pf."name"
)
ORDER BY pf."name";

-- DropTable
DROP TABLE "packing_forms";
