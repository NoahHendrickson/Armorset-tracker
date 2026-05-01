-- DestinyClassDefinition does not actually ship class glyph icons (`hasIcon: false`,
-- `iconHash: 0` for every classType), so the table created in 0007 is pointless.
-- The tracker now renders class glyphs as inline SVG components instead.

drop table if exists public.class_icons;
