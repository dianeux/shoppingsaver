import { DealsView, dealsMetadata } from "@/views/DealsView";

export const revalidate = 3600;
export const metadata = dealsMetadata("men");

export default function Page() {
  return <DealsView gender="men" />;
}
