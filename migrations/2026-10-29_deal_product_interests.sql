-- Optional product interests are stored atomically with their deal.
-- Existing rows receive only empty defaults. Existing policies/grants are unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_valid_deal_product_interests(products jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  product jsonb;
  line_name text;
  allowed_sizes text[];
  allowed_temperatures text[];
  seen_ids text[] := ARRAY[]::text[];
  quantity_value numeric;
BEGIN
  IF jsonb_typeof(products) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR product IN SELECT value FROM jsonb_array_elements(products) LOOP
    IF jsonb_typeof(product) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(product) AS field(name)
               WHERE name NOT IN ('id','line','size','temperature','quantity','periodicity')) THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(product->'id') IS DISTINCT FROM 'string'
       OR coalesce(product->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN false;
    END IF;
    IF lower(product->>'id') = ANY(seen_ids) THEN RETURN false; END IF;
    seen_ids := array_append(seen_ids, lower(product->>'id'));
    IF jsonb_typeof(product->'line') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    line_name := product->>'line';
    CASE line_name
      WHEN 'Orca M' THEN allowed_sizes := ARRAY['4','11','23','50'];
      WHEN 'Orca S' THEN allowed_sizes := ARRAY['4','11','23','50'];
      WHEN 'Orca pallet' THEN allowed_sizes := ARRAY['100','255','345'];
      WHEN 'Biotherm' THEN allowed_sizes := ARRAY['7','10','15','30','45','80'];
      WHEN 'Pharmatherm' THEN allowed_sizes := ARRAY['7','10','15','30','45','80'];
      ELSE RETURN false;
    END CASE;
    allowed_temperatures := CASE WHEN line_name IN ('Orca M','Orca S','Orca pallet')
      THEN ARRAY['2 a 8','15 a 25','-15 a -25','Dry Ice']
      ELSE ARRAY['2 a 8','15 a 25','Dry Ice'] END;
    IF product ? 'size' AND product->'size' <> 'null'::jsonb THEN
      IF jsonb_typeof(product->'size') IS DISTINCT FROM 'string'
         OR NOT ((product->>'size') = ANY(allowed_sizes)) THEN RETURN false; END IF;
    END IF;
    IF product ? 'temperature' AND product->'temperature' <> 'null'::jsonb THEN
      IF jsonb_typeof(product->'temperature') IS DISTINCT FROM 'string'
         OR NOT ((product->>'temperature') = ANY(allowed_temperatures)) THEN RETURN false; END IF;
    END IF;
    IF product ? 'quantity' AND product->'quantity' <> 'null'::jsonb THEN
      IF jsonb_typeof(product->'quantity') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      quantity_value := (product->>'quantity')::numeric;
      IF quantity_value <= 0 OR quantity_value <> trunc(quantity_value)
         OR quantity_value > 9007199254740991 THEN RETURN false; END IF;
    END IF;
    IF product ? 'periodicity' AND product->'periodicity' <> 'null'::jsonb THEN
      IF jsonb_typeof(product->'periodicity') IS DISTINCT FROM 'string'
         OR NOT ((product->>'periodicity') = ANY(ARRAY['one_time','monthly'])) THEN RETURN false; END IF;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS product_interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS product_interests_revision bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.deals'::regclass
                 AND conname='deals_product_interests_valid') THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_product_interests_valid
      CHECK (public.is_valid_deal_product_interests(product_interests));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.deals'::regclass
                 AND conname='deals_product_interests_revision_nonnegative') THEN
    ALTER TABLE public.deals ADD CONSTRAINT deals_product_interests_revision_nonnegative
      CHECK (product_interests_revision >= 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_deal_product_interests_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.product_interests_revision := 0;
  ELSIF NEW.product_interests IS DISTINCT FROM OLD.product_interests THEN
    NEW.product_interests_revision := OLD.product_interests_revision + 1;
  ELSE
    NEW.product_interests_revision := OLD.product_interests_revision;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_deal_product_interests_revision
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.advance_deal_product_interests_revision();

NOTIFY pgrst, 'reload schema';
COMMIT;
