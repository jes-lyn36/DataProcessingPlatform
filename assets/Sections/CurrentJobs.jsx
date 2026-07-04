import { RefreshCw } from "lucide-react";
import JobCard from "../Components/JobCard";

export default function CurrentJobs() {
  const jobs = [
    {
      id: 1,
      title:
        "Find email addresses in the Email column and replace them with 'REDACTED'.",
      fileName: "customers_data.xlsx",
      createdAt: "Started 2 minutes ago",
      status: "RUNNING",
      progress: 63,
      selected: true,
    },
    {
      id: 2,
      title:
        "Replace Australian phone numbers with '[PHONE]' in Contact column.",
      fileName: "contacts.csv",
      createdAt: "Started 15 minutes ago",
      status: "RUNNING",
      progress: 28,
    },
    {
      id: 3,
      title: "Mask credit card numbers in Payment Details.",
      fileName: "payments.csv",
      createdAt: "Completed 1 hour ago",
      status: "COMPLETED",
    },
    {
      id: 4,
      title: "Extract URLs from the Description column.",
      fileName: "products.csv",
      createdAt: "Failed 2 hours ago",
      status: "FAILED",
    },
    {
      id: 5,
      title: "Replace all dates with '[DATE]' in Notes.",
      fileName: "notes.csv",
      createdAt: "Completed 3 hours ago",
      status: "COMPLETED",
    },
  ];

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm xl:min-h-0 xl:flex-1">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-bold leading-tight text-slate-900">
          My Jobs
        </h2>

        <button className="rounded-lg p-2 transition hover:bg-slate-100">
          <RefreshCw className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      {/* Job List */}
      <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            title={job.title}
            fileName={job.fileName}
            createdAt={job.createdAt}
            status={job.status}
            progress={job.progress}
            selected={job.selected}
          />
        ))}
      </div>
    </section>
  );
}