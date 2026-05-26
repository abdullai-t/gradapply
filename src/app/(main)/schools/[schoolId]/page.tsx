import { SchoolDetailPage } from "@/features/school-detail/school-detail-page";

type Props = {
  params: Promise<{ schoolId: string }>;
};

export default async function SchoolDetailRoute({ params }: Props) {
  const { schoolId } = await params;
  return <SchoolDetailPage schoolId={schoolId} />;
}
