-- 0001_create_windbreak_applications.sql
-- Windbreak grant applications, persisted in PostGIS (Phase 2).
--
-- The table mirrors the GeoJSON provider it replaces:
--   one row per drawn line, geometry in WGS84 (EPSG:4326).
--   line_id doubles as the feature id used by the OGC API layer.
--
-- 'established' windbreaks stay in the skógrækt registry
-- (skograekt.skjolbelti, EPSG:3057) - this table only holds submitted
-- applications (status 'pending' until the grant authority accepts them).

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.windbreak_applications (
    line_id         text PRIMARY KEY,
    application_id  text NOT NULL,
    kennitala       text NOT NULL,
    parcel_id       text,
    status          text NOT NULL DEFAULT 'pending',
    length_m        double precision,
    submitted_at    timestamptz NOT NULL DEFAULT now(),
    geometry        geometry(LineString, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS windbreak_applications_application_id_idx
    ON public.windbreak_applications (application_id);
CREATE INDEX IF NOT EXISTS windbreak_applications_parcel_id_idx
    ON public.windbreak_applications (parcel_id);
CREATE INDEX IF NOT EXISTS windbreak_applications_kennitala_idx
    ON public.windbreak_applications (kennitala);
CREATE INDEX IF NOT EXISTS windbreak_applications_geometry_idx
    ON public.windbreak_applications USING gist (geometry);
