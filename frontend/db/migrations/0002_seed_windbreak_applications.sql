-- 0002_seed_windbreak_applications.sql
-- Seed the demo pending application that the GeoJSON provider used to carry:
-- one windbreak line on land 163368 (parcel IS-163368), already submitted
-- and awaiting acceptance. Geometry is WGS84 (EPSG:4326), matching the
-- previous backend/data/windbreak_applications.json seed.

INSERT INTO public.windbreak_applications (
    line_id, application_id, kennitala, parcel_id, status,
    length_m, submitted_at, geometry
)
SELECT 'WB-2026-0042-1', 'WB-2026-0042', '2409693949', 'IS-163368', 'pending',
       162.1, '2026-06-10T08:30:00Z',
       ST_SetSRID(ST_GeomFromGeoJSON(
           '{"type":"LineString","coordinates":[[-18.55057,63.486069],[-18.547356,63.486328]]}'
       ), 4326)
WHERE NOT EXISTS (
    SELECT 1 FROM public.windbreak_applications WHERE line_id = 'WB-2026-0042-1'
);
