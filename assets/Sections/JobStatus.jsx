import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  Clock3,
  Database,
  Boxes,
} from "lucide-react";

import ProcessedInfoCard from "../Components/ProcessedInfoCard";
import { cancelJob, fetchJobStatus } from "../api/jobs";
import { formatNumber, isActiveStatus, STATUS_STYLES } from "../utils/format";

const POLL_INTERVAL_MS = 1000;

export default function JobStatus({ jobId, onJobUpdated }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      return;
    }

    let isMounted = true;
    let intervalId = null;

    const loadStatus = async () => {
      try {
        const data = await fetchJobStatus(jobId);
        if (isMounted) {
          setJob(data);
          setError(null);

          if (!isActiveStatus(data.status) && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (statusError) {
        if (isMounted) {
          setError(statusError.message);
        }
      }
    };

    loadStatus();
    intervalId = setInterval(loadStatus, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId]);

  const handleCancel = async () => {
    if (!jobId) {
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      await cancelJob(jobId);
      const updated = await fetchJobStatus(jobId);
      setJob(updated);
      onJobUpdated?.();
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!jobId) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
        <h2 className="text-xl font-bold leading-tight text-slate-900">
          2. Job Status
        </h2>
        <p className="mt-4 text-sm text-slate-500">
          Select or create a job to view its status.
        </p>
      </section>
    );
  }

  if (!job && !error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
        <h2 className="text-xl font-bold leading-tight text-slate-900">
          2. Job Status
        </h2>
        <p className="mt-4 text-sm text-slate-500">Loading job status...</p>
      </section>
    );
  }

  const statusClassName =
    STATUS_STYLES[job?.status] || "bg-slate-100 text-slate-700";
  const canCancel = job && isActiveStatus(job.status);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold leading-tight text-slate-900">
            2. Job Status
          </h2>

          {job && (
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}
              >
                {job.status}
              </span>

              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Job ID:</span>{" "}
                {job.jobId}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleCancel}
          disabled={!canCancel || isCancelling}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          {isCancelling ? "Cancelling..." : "Cancel Job"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {job && (
        <>
          {job.currentStep && (
            <p className="mb-4 text-xs text-slate-600">{job.currentStep}</p>
          )}

          <div>
            <div className="mb-2 flex justify-between text-xs text-slate-600">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <ProcessedInfoCard
              title="Elapsed Time"
              value={job.elapsedTime}
              subtitle="Since job started"
              icon={<Clock3 className="h-6 w-6 text-indigo-600" />}
            />

            <ProcessedInfoCard
              title="Rows Processed"
              value={formatNumber(job.rowsProcessed)}
              subtitle={`out of ${formatNumber(job.totalRows)} rows`}
              icon={<Database className="h-6 w-6 text-indigo-600" />}
            />

            <ProcessedInfoCard
              title="Partitions"
              value={job.partitions}
              subtitle="Spark partitions"
              icon={<Boxes className="h-6 w-6 text-indigo-600" />}
            />
          </div>
        </>
      )}
    </section>
  );
}
