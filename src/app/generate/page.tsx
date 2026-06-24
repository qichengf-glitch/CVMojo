import nextDynamic from "next/dynamic";

const GenerateClient = nextDynamic(() => import("@/components/generate-client"), {
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>
  ),
});

export const dynamic = "force-dynamic";

export default function GeneratePage() {
  return <GenerateClient />;
}
