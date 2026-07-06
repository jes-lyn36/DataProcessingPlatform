import { useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Play,
  X,
} from "lucide-react";

import { createJob } from "../api/jobs";

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewJob({ onJobCreated }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please upload a CSV or Excel file.");
      return;
    }

    if (!instruction.trim()) {
      setError("Please enter a natural language instruction.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createJob(file, instruction.trim());
      onJobCreated?.(result.jobId);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
      <h2 className="mb-4 text-xl font-bold leading-tight text-slate-900">
        1. Create New Job
      </h2>

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-700">
          Upload File
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 transition hover:border-indigo-400 hover:bg-indigo-50"
        >
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

      {file && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <FileSpreadsheet className="h-6 w-6 text-green-600" />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemoveFile}
              className="rounded-lg p-2 hover:bg-slate-200"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <label className="mb-2 block text-xs font-semibold text-slate-700">
          Natural Language Instruction
        </label>

        <textarea
          rows={2}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          className="w-full rounded-xl border border-slate-300 p-4 text-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="Example: Find email addresses in the Email column and replace them with 'REDACTED'."
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="h-5 w-5" />
        {isSubmitting ? "Starting..." : "Start Processing"}
      </button>
    </section>
  );
}
