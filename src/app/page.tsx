import { HomeView } from "@/views/HomeView";

export const revalidate = 3600;

export default function Page() {
  return <HomeView gender="women" />;
}
