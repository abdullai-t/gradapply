import { redirect } from "next/navigation";

export default async function EmailThreadPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/emails?thread=${encodeURIComponent(params.id)}`);
}
