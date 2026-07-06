import { useEffect, useState } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import CurrentJobs from "../Sections/CurrentJobs";
import JobStatus from "../Sections/JobStatus";
import NewJob from "../Sections/NewJob";
import ResultPreview from "../Sections/ResultPreview";

function App() {
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  const refreshJobs = () => setJobsRefreshKey((key) => key + 1);

  const handleJobCreated = (jobId) => {
    setSelectedJobId(jobId);
    refreshJobs();
  };

  const handleJobUpdated = () => {
    refreshJobs();
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-3">
      <div className="mx-auto">
        <header className="mb-5">
          <h1 className="text-2xl font-bold leading-tight text-slate-900">
            Regex Pattern Processor
          </h1>
          <p className="mt-1 text-sm leading-snug text-slate-500">
            Upload datasets, describe replacements in natural language, and
            track distributed processing jobs.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:h-[calc(100vh-7rem)] xl:min-h-0 xl:grid-cols-[1fr_2fr]">
          <div className="flex min-h-0 flex-col gap-6">
            <div className="shrink-0">
              <NewJob onJobCreated={handleJobCreated} />
            </div>
            <CurrentJobs
              selectedJobId={selectedJobId}
              onSelectJob={setSelectedJobId}
              refreshKey={jobsRefreshKey}
            />
          </div>

          <div className="flex min-h-0 flex-col gap-6 xl:overflow-y-auto">
            <JobStatus jobId={selectedJobId} onJobUpdated={handleJobUpdated} />
            <ResultPreview jobId={selectedJobId} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
