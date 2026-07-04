import { X } from "lucide-react";
import {
  Clock3,
  Database,
  TableProperties,
  Boxes,
} from "lucide-react";

import ProcessedInfoCard from "../Components/ProcessedInfoCard";

export default function JobStatus() {
  const job = {
    id: "8f3a9c2d-7b1e-4c4f-9f8e-2d1a7e8b9c0d",
    status: "RUNNING",
    progress: 63,
    elapsedTime: "00:02:34",
    rowsProcessed: "1,263,450",
    totalRows: "2,000,000",
    partitions: "32 / 32",
    currentStep: "Applying regex replacement on partition 20 of 32",
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold leading-tight text-slate-900">
            2. Job Status
          </h2>

          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              {job.status}
            </span>

            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                Job ID:
              </span>{" "}
              {job.id}
            </p>
          </div>
        </div>

        <button className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50">
          <X className="h-4 w-4" />
          Cancel Job
        </button>
      </div>

      {/* Progress Bar */}
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

      {/* Statistics */}
      <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <ProcessedInfoCard
          title="Elapsed Time"
          value={job.elapsedTime}
          subtitle="Since job started"
          icon={<Clock3 className="h-6 w-6 text-indigo-600" />}
        />

        <ProcessedInfoCard
          title="Rows Processed"
          value={job.rowsProcessed}
          subtitle={`${job.progress}% complete`}
          icon={<Database className="h-6 w-6 text-indigo-600" />}
        />

        <ProcessedInfoCard
          title="Total Rows"
          value={job.totalRows}
          subtitle="Rows in uploaded file"
          icon={<TableProperties className="h-6 w-6 text-indigo-600" />}
        />

        <ProcessedInfoCard
          title="Partitions"
          value={job.partitions}
          subtitle="Spark partitions"
          icon={<Boxes className="h-6 w-6 text-indigo-600" />}
        />
      </div>

    </section>
  );
}