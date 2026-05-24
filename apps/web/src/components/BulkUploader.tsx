"use client";

import { useEffect, useRef, useState } from "react";
import type { BulkJob, BulkJobResponse, CreateBulkJobResponse } from "@icd-mapper/shared";

type Status = "idle" | "uploading" | "polling" | "done" | "error";

export function BulkUploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [job, setJob] = useState<BulkJob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onUpload(file: File) {
    setStatus("uploading");
    setError(null);
    setDownloadUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/bulk-map", { method: "POST", body: fd });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CreateBulkJobResponse;
      setJob(data.job);
      setStatus("polling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }

  // Poll job status while it's queued/processing.
  useEffect(() => {
    if (status !== "polling" || !job) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/bulk-map/${job.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BulkJobResponse;
        if (cancelled) return;
        setJob(data.job);
        if (data.job.status === "completed") {
          setDownloadUrl(data.downloadUrl);
          setStatus("done");
        } else if (data.job.status === "failed") {
          setError(data.job.error ?? "Job failed");
          setStatus("error");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Polling failed");
          setStatus("error");
        }
      }
    };
    const id = setInterval(tick, 2000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status, job?.id]);

  return (
    <div className="space-y-4">
      <div className="card">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onUpload(file);
          }}
        />
        <button
          className="btn-primary"
          disabled={status === "uploading" || status === "polling"}
          onClick={() => inputRef.current?.click()}
        >
          {status === "uploading"
            ? "Uploading…"
            : status === "polling"
              ? `Processing (${job?.row_count ?? "?"} rows)…`
              : "Choose CSV"}
        </button>
        {job && (
          <p className="mt-3 text-sm text-slate-500">
            Job <span className="font-mono">{job.id}</span> · status{" "}
            <span className="font-medium">{job.status}</span>
          </p>
        )}
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-700">{error}</div>
      )}

      {status === "done" && downloadUrl && (
        <div className="card border border-emerald-200 bg-emerald-50">
          <p className="text-emerald-700">Done! Your mapped CSV is ready.</p>
          <a
            href={downloadUrl}
            className="btn-primary mt-3"
            download={`icd-mapper-${job?.id}.csv`}
          >
            Download CSV
          </a>
        </div>
      )}
    </div>
  );
}
