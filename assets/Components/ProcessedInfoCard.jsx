import { Clock3 } from "lucide-react";

export default function ProcessedInfoCard({
  title = "Elapsed Time",
  value = "2m 34s",
  subtitle = "Current processing time",
  icon = <Clock3 className="h-6 w-6 text-indigo-600" />,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        {/* Left Column */}
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50">
          {icon}
        </div>

        {/* Right Column */}
        <div className="flex flex-col">
          <p className="text-xs font-medium text-slate-500">
            {title}
          </p>

          <h2 className="text-lg font-bold text-slate-800">
            {value}
          </h2>

          <p className="text-xs text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}