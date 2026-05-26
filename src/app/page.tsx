import { auth } from "@/auth";
import { HomeLanding } from "@/components/landing/home-landing";

export default async function HomePage() {
  const session = await auth();
  return <HomeLanding showPricing isSignedIn={Boolean(session?.user)} />;
}
