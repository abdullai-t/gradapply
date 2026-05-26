import { ProfEmailDetailPage } from "@/features/emails/prof-email-detail-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProfEmailPage({ params }: Props) {
  const { id } = await params;
  return <ProfEmailDetailPage emailId={id} />;
}
