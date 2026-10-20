import type { Metadata } from "next";
import JobDetail from "./job-detail";

export const metadata: Metadata = {
  title: "Your next role | VANTAGE",
  description: "Explore the opportunity, apply with confidence, or share a personal referral link with someone brilliant.",
};

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ref?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <JobDetail jobId={id} referralCode={typeof query.ref === "string" ? query.ref : ""} />;
}
