-- Tracker slot thumbnails are resolved per `(set_hash, class, slot)` from `armor_items`
-- (armor_slot_icons duplicated random defaults and stayed wrong per-set).

drop table if exists public.armor_slot_icons;
