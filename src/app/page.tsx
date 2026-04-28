import { HomeLanding } from "@/components/landing/home-landing";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function HomePage() {
  const showPricing = await isFeatureEnabled("homepage_pricing_section", false);

  return <HomeLanding showPricing={showPricing} />;
}
