import { SearchBox } from "@/components/SearchBox";

export const runtime = "edge";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Single search</h1>
        <p className="text-sm text-slate-500">
          Type a free-text diagnosis. We&apos;ll return the top ICD-10-CM matches with confidence scores.
        </p>
      </div>
      <SearchBox />
    </div>
  );
}
