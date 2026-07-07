const API_BASE = "/api";

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function fetchJobs() {
  const response = await fetch(`${API_BASE}/jobs/`);
  return handleResponse(response);
}

export async function createJob(file, prompt) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prompt", prompt);

  const response = await fetch(`${API_BASE}/jobs/`, {
    method: "POST",
    body: formData,
  });

  return handleResponse(response);
}

export async function fetchJobStatus(jobId) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/`);
  return handleResponse(response);
}

export async function fetchJobResults(jobId, page = 1, pageSize = 7) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const response = await fetch(
    `${API_BASE}/jobs/${jobId}/results/?${params.toString()}`
  );

  return handleResponse(response);
}

export function getJobDownloadUrl(jobId) {
  return `${API_BASE}/jobs/${jobId}/download/`;
}

export async function cancelJob(jobId) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/cancel/`, {
    method: "POST",
  });

  return handleResponse(response);
}
