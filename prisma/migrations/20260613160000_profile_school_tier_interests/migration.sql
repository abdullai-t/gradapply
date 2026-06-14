-- School tier interests for recommendations (reach / match / safety).
ALTER TABLE "Profile" ADD COLUMN "schoolTierInterests" TEXT[] DEFAULT ARRAY['top_tier', 'mid_tier', 'safety']::TEXT[];
