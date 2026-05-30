import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";

type Props = {
  variant: "no_schools" | "no_deadlines";
  firstSchoolId?: string | null;
};

export function DashboardEmptyHero({ variant, firstSchoolId }: Props) {
  if (variant === "no_schools") {
    return (
      <section className="rise-in mb-8 rounded-3xl border-2 border-dashed border-[var(--outline-variant)] p-10 text-center md:p-14">
        <Icon
          name="school"
          size={40}
          className="mx-auto text-[var(--primary)]"
        />
        <h2 className="t-headline-md m-0 mt-4 text-[var(--on-surface)]">
          Start your school list
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--on-surface-variant)]">
          The dashboard lights up once you add programs — deadlines, materials
          checklists, and SOP drafts all live on each school hub.
        </p>
        <Button asChild className="mt-6" size="lg" icon="add">
          <Link href="/schools">Add your first school</Link>
        </Button>
      </section>
    );
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="m-0 text-sm text-[var(--on-surface-variant)]">
        <span className="font-bold text-[var(--on-surface)]">Add deadlines</span>{" "}
        on your schools to prioritize this week on the timeline.
      </p>
      <Button asChild variant="secondary" size="sm" className="shrink-0">
        <Link href={firstSchoolId ? `/schools/${firstSchoolId}` : "/schools"}>
          Set a deadline
        </Link>
      </Button>
    </section>
  );
}
