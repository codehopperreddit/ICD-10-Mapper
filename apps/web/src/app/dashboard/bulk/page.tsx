import { BulkUploader } from "@/components/BulkUploader";


export default function BulkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk CSV mapping</h1>
        <p className="text-sm text-slate-500">
          Upload a CSV with a <code className="rounded bg-slate-100 px-1">diagnosis_text</code>{" "}
          column. We&apos;ll add <code className="rounded bg-slate-100 px-1">icd10_code</code>,{" "}
          <code className="rounded bg-slate-100 px-1">icd10_description</code>, and{" "}
          <code className="rounded bg-slate-100 px-1">confidence</code> columns.
        </p>
      </div>
      <BulkUploader />
    </div>
  );
}
