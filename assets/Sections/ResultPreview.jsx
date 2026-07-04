import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";

export default function ResultPreview() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 7;
  const totalRows = 2_000_000;

  const headers = ["ID", "Name", "Email"];

  const rows = [
    {
      id: 1,
      name: "John Doe",
      email: "REDACTED",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "REDACTED",
    },
    {
      id: 3,
      name: "Alice Brown",
      email: "REDACTED",
    },
    {
      id: 4,
      name: "Michael Lee",
      email: "REDACTED",
    },
    {
      id: 5,
      name: "Emily Chen",
      email: "REDACTED",
    },
    {
      id: 6,
      name: "David Wilson",
      email: "REDACTED",
    },
    {
      id: 7,
      name: "Sarah Johnson",
      email: "REDACTED",
    },
    {
      id: 8,
      name: "Chris Taylor",
      email: "REDACTED",
    },
  ];

  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = rows.slice(startIndex, startIndex + rowsPerPage);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 pt-4 pb-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold leading-tight text-slate-900">
            3. Processed Results
          </h2>

          <p className="mt-0.5 text-xs leading-snug text-slate-500">
            Preview of the processed dataset.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700">
          <Download className="h-4 w-4" />
          Download CSV
        </button>
      </div>

      {/* Search */}
      {/* <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          type="text"
          placeholder="Search preview..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div> */}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-700"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedRows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 transition hover:bg-slate-50"
              >
                <td className="px-5 py-4 text-xs">{row.id}</td>

                <td className="px-5 py-4 text-xs">
                  {row.name}
                </td>

                <td className="px-5 py-4">
                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                    {row.email}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Showing{" "}
          <span className="font-semibold">
            {startIndex + 1}–{Math.min(startIndex + rowsPerPage, rows.length)}
          </span>{" "}
          of <span className="font-semibold">{totalRows.toLocaleString()}</span>{" "}
          rows
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-300 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;

            return (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`rounded-lg px-4 py-2 text-xs transition ${
                  currentPage === page
                    ? "bg-indigo-600 font-semibold text-white"
                    : "border border-slate-300 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(page + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="rounded-lg border border-slate-300 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}