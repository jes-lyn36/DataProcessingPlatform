import { useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Play,
  X,
} from "lucide-react";

export default function NewJob() {
  const [file] = useState({
    name: "customers_data.xlsx",
    size: "2.4 MB",
  });

  const [instruction, setInstruction] = useState(
    "Find email addresses in the Email column and replace them with 'REDACTED'."
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
      {/* Header */}
      <h2 className="mb-4 text-xl font-bold leading-tight text-slate-900">
        1. Create New Job
      </h2>

      {/* Upload */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-700">
          Upload File
        </label>

        <button className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 transition hover:border-indigo-400 hover:bg-indigo-50">
          <Upload className="h-6 w-6 text-slate-400" />

          <div className="text-left">
            <p className="text-sm font-medium text-slate-700">
              Click to upload a CSV or Excel file
            </p>

            <p className="text-xs text-slate-500">
              Supports .csv, .xlsx and .xls
            </p>
          </div>
        </button>
      </div>

      {/* Uploaded File */}
      {/* <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <FileSpreadsheet className="h-6 w-6 text-green-600" />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-800">
                {file.name}
              </p>

              <p className="text-xs text-slate-500">
                {file.size}
              </p>
            </div>
          </div>

          <button className="rounded-lg p-2 hover:bg-slate-200">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
      </div> */}

      {/* Natural Language Prompt */}
      <div className="mt-6">
        <label className="mb-2 block text-xs font-semibold text-slate-700">
          Natural Language Instruction
        </label>

        <textarea
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          className="w-full rounded-xl border border-slate-300 p-4 text-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="Example: Find email addresses in the Email column and replace them with 'REDACTED'."
        />
      </div>

      {/* Optional Examples */}
      {/* <div className="mt-5 rounded-xl bg-indigo-50 p-4">
        <p className="mb-2 text-sm font-semibold text-indigo-700">
          Example Prompts
        </p>

        <ul className="space-y-1 text-sm text-slate-600">
          <li>• Find all email addresses and replace them with "REDACTED".</li>
          <li>• Replace Australian phone numbers with "[PHONE]".</li>
          <li>• Remove every URL from the Description column.</li>
          <li>• Replace dates with "[DATE]".</li>
        </ul>
      </div> */}

      {/* Submit */}
      <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">
        <Play className="h-5 w-5" />
        Start Processing
      </button>
    </section>
  );
}