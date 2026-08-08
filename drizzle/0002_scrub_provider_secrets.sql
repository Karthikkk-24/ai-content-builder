-- Scrub leaked Pollinations (and similar) API keys from stored generation URLs.
-- Matches ?key= / &key= (and common aliases) in http(s) output_content values.
UPDATE generations
SET output_content = regexp_replace(
  regexp_replace(
    output_content,
    '([?&])(key|api_key|apikey|access_token|token)=[^&]*',
    '\1',
    'gi'
  ),
  '[?&]$',
  ''
)
WHERE output_content ~* 'https?://'
  AND output_content ~* '[?&](key|api_key|apikey|access_token|token)=';

--> statement-breakpoint

-- Scrub secrets from image/cta block URLs inside project JSON.
UPDATE content_projects
SET blocks = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN (elem ? 'url') AND (elem->>'url') ~* '[?&](key|api_key|apikey|access_token|token)=' THEN
          jsonb_set(
            elem,
            '{url}',
            to_jsonb(
              regexp_replace(
                regexp_replace(
                  elem->>'url',
                  '([?&])(key|api_key|apikey|access_token|token)=[^&]*',
                  '\1',
                  'gi'
                ),
                '[?&]$',
                ''
              )
            )
          )
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(blocks, '[]'::jsonb)) AS elem
)
WHERE blocks::text ~* '[?&](key|api_key|apikey|access_token|token)=';
