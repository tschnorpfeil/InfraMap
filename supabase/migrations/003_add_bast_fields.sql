ALTER TABLE bruecken
ADD COLUMN closure boolean DEFAULT false,
ADD COLUMN area numeric,
ADD COLUMN lastinspection integer,
ADD COLUMN construction text,
ADD COLUMN history jsonb;
