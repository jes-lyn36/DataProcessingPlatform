import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import JobCard from "../Components/JobCard";
import { fetchJobs } from "../api/jobs";
import { formatRelativeTime } from "../utils/format";

export default function CurrentJobs({
  selectedJobId,
  onSelectJob,
  refreshKey,
}) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchJobs();
      setJobs(data.jobs || []);

      if (!selectedJobId && data.jobs?.length > 0) {
        onSelectJob?.(data.jobs[0].jobId);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [refreshKey]);

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm xl:min-h-0 xl:flex-1">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-bold leading-tight text-slate-900">
          My Jobs
        </h2>

        <button
          type="button"
          onClick={loadJobs}
          className="rounded-lg p-2 transition hover:bg-slate-100"
          aria-label="Refresh jobs"
        >
          <RefreshCw className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
        {isLoading && (
          <p className="text-sm text-slate-500">Loading jobs...</p>
        )}

        {!isLoading && jobs.length === 0 && (
          <p className="text-sm text-slate-500">
            No jobs yet. Upload a file to get started.
          </p>
        )}

        {jobs.map((job) => (
          <JobCard
            key={job.jobId}
            title={job.title}
            fileName={job.fileName}
            createdAt={formatRelativeTime(job.createdAt)}
            status={job.status}
            progress={job.progress}
            selected={selectedJobId === job.jobId}
            onClick={() => onSelectJob?.(job.jobId)}
          />
        ))}
      </div>
    </section>
  );
}
