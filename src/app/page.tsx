import { HomeLanding } from "@/components/landing/home-landing";
import { GlassScene } from "@/components/layout/glass-scene";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function HomePage() {
  const showPricing = await isFeatureEnabled("homepage_pricing_section", false);

  return (
    <GlassScene>
      <HomeLanding showPricing={showPricing} />
    </GlassScene>
  );
}
