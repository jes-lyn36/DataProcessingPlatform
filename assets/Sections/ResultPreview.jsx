import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

import { fetchJobResults, fetchJobStatus, getJobDownloadUrl } from "../api/jobs";
import JobErrorAlert from "../Components/JobErrorAlert";
import { formatNumber, isActiveStatus } from "../utils/format";

const POLL_INTERVAL_MS = 1000;

export default function ResultPreview({ jobId }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [results, setResults] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [jobErrorMessage, setJobErrorMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setResults(null);
      setJobStatus(null);
      setJobErrorMessage(null);
      setError(null);
      return;
    }

    let isMounted = true;
    let intervalId = null;

    const loadResults = async () => {
      setError(null);

      try {
        const status = await fetchJobStatus(jobId);
        if (!isMounted) {
          return;
        }

        setJobStatus(status.status);
        setJobErrorMessage(status.errorMessage || null);

        if (status.status !== "COMPLETED") {
          setResults(null);

          if (!isActiveStatus(status.status) && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }

        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }

        setIsLoading(true);
        const data = await fetchJobResults(jobId, currentPage, rowsPerPage);
        if (isMounted) {
          setResults(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setResults(null);
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadResults();
    intervalId = setInterval(loadResults, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, currentPage]);

  const headers = results?.headers || [];
  const rows = results?.rows || [];
  const totalRows = results?.totalRows || 0;
  const totalPages = results?.totalPages || 0;
  const startIndex = (currentPage - 1) * rowsPerPage;

  const visiblePages = (() => {
    if (totalPages <= 10) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return [...pages]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  })();

  const paginationItems = visiblePages.reduce((items, page, index) => {
    if (index > 0 && page - visiblePages[index - 1] > 1) {
      items.push(`gap-${visiblePages[index - 1]}`);
    }
    items.push(page);
    return items;
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold leading-tight text-slate-900">
            3. Processed Results
          </h2>

          <p className="mt-0.5 text-xs leading-snug text-slate-500">
            Preview of the processed dataset.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (jobId) {
              window.location.href = getJobDownloadUrl(jobId);
            }
          }}
          disabled={!jobId || !results || rows.length === 0}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </button>
      </div>

      {!jobId && (
        <p className="text-sm text-slate-500">
          Select a completed job to preview results.
        </p>
      )}

      {jobId && isLoading && (
        <p className="text-sm text-slate-500">Loading results...</p>
      )}

      <JobErrorAlert
        message={jobStatus === "FAILED" ? jobErrorMessage : null}
      />

      {jobId && !isLoading && jobStatus && jobStatus !== "COMPLETED" && jobStatus !== "FAILED" && (
        <p className="text-sm text-slate-500">
          Results will appear here once processing completes.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {results && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-700"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(headers.length, 1)}
                      className="px-5 py-4 text-xs text-slate-500"
                    >
                      No rows to display yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => (
                    <tr
                      key={`${currentPage}-${rowIndex}`}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      {headers.map((header) => (
                        <td key={header} className="whitespace-nowrap px-5 py-4 text-xs">
                          {String(row[header] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold">
                {rows.length === 0
                  ? 0
                  : `${startIndex + 1}–${startIndex + rows.length}`}
              </span>{" "}
              of{" "}
              <span className="font-semibold">
                {formatNumber(totalRows)}
              </span>{" "}
              rows
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={currentPage === 1 || totalPages === 0}
                className="rounded-lg border border-slate-300 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {paginationItems.map((item) =>
                typeof item === "string" ? (
                  <span key={item} className="px-1 text-xs text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`rounded-lg px-4 py-2 text-xs transition ${
                      currentPage === item
                        ? "bg-indigo-600 font-semibold text-white"
                        : "border border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="rounded-lg border border-slate-300 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
