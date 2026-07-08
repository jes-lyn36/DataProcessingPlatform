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

async function requestPresignedUpload(file) {
  const response = await fetch(`${API_BASE}/jobs/presigned-upload/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });

  if (!response.ok) {
    // S3 direct upload isn't configured (e.g. local dev) — caller should
    // fall back to the regular multipart upload instead.
    return null;
  }

  return response.json();
}

async function uploadFileDirectlyToStorage(uploadUrl, file) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to storage");
  }
}

async function createJobViaMultipartUpload(file, prompt) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prompt", prompt);

  const response = await fetch(`${API_BASE}/jobs/`, {
    method: "POST",
    body: formData,
  });

  return handleResponse(response);
}

export async function createJob(file, prompt) {
  const presigned = await requestPresignedUpload(file);

  if (!presigned?.uploadUrl) {
    return createJobViaMultipartUpload(file, prompt);
  }

  // Large files upload straight to S3, bypassing the Django/Vercel proxy
  // entirely so uploads can't hit the proxy's request timeout.
  await uploadFileDirectlyToStorage(presigned.uploadUrl, file);

  const response = await fetch(`${API_BASE}/jobs/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileKey: presigned.key,
      fileName: file.name,
      prompt,
    }),
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
