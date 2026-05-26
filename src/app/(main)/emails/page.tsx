import { Suspense } from "react";

import { PageLoader } from "@/components/page-loader";
import { ProfEmailsListPage } from "@/features/emails/prof-emails-list-page";

export default function EmailsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading professor drafts…" />}>
      <ProfEmailsListPage />
    </Suspense>
  );
}
