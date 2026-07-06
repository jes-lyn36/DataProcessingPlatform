import {
  Clock,
  CircleCheck,
  CircleX,
  LoaderCircle,
} from "lucide-react";

export default function JobCard({
  title = "Find email addresses in Email column and replace them with 'REDACTED'.",
  fileName = "customers_data.xlsx",
  createdAt = "Started 2 minutes ago",
  status = "RUNNING",
  progress = 63,
  selected = false,
  onClick,
}) {
  const statusConfig = {
    RUNNING: {
      colour: "bg-blue-100 text-blue-700",
      icon: <LoaderCircle className="h-4 w-4 animate-spin" />,
    },
    COMPLETED: {
      colour: "bg-green-100 text-green-700",
      icon: <CircleCheck className="h-4 w-4" />,
    },
    FAILED: {
      colour: "bg-red-100 text-red-700",
      icon: <CircleX className="h-4 w-4" />,
    },
    CANCELLED: {
      colour: "bg-orange-100 text-orange-700",
      icon: <CircleX className="h-4 w-4" />,
    },
    QUEUED: {
      colour: "bg-yellow-100 text-yellow-700",
      icon: <Clock className="h-4 w-4" />,
    },
  };

  const current = statusConfig[status] || statusConfig.QUEUED;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition hover:border-indigo-400 hover:shadow-sm ${
        selected
          ? "border-indigo-500 bg-indigo-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex justify-between gap-4">
        <div className="flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">
            {title}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            <span className="text-slate-600">{fileName}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-400">{createdAt}</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${current.colour}`}
          >
            {current.icon}
            {status}
          </span>

          {(status === "RUNNING" || status === "QUEUED") && (
            <span className="text-xs font-semibold text-slate-600">
              {progress}%
            </span>
          )}
        </div>
      </div>

      {(status === "RUNNING" || status === "QUEUED") && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}