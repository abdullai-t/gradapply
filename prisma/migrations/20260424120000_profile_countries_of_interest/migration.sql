-- Add country preference list for profile-based school recommendations.
ALTER TABLE "Profile"
ADD COLUMN "countriesOfInterest" TEXT[] DEFAULT ARRAY[]::TEXT[];
