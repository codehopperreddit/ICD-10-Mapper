import { ApiKeysManager } from "@/components/ApiKeysManager";


export default function KeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API keys</h1>
        <p className="text-sm text-slate-500">
          Send keys as <code className="rounded bg-slate-100 px-1">Authorization: Bearer icdm_…</code>
        </p>
      </div>
      <ApiKeysManager />
    </div>
  );
}
