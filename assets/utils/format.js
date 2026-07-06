export function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export function formatRelativeTime(isoString) {
  if (!isoString) {
    return "Just now";
  }

  const date = new Date(isoString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `Started ${seconds} second${seconds === 1 ? "" : "s"} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Started ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Started ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `Started ${days} day${days === 1 ? "" : "s"} ago`;
}

export function isActiveStatus(status) {
  return status === "RUNNING" || status === "QUEUED";
}

export const STATUS_STYLES = {
  RUNNING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-orange-100 text-orange-700",
  QUEUED: "bg-yellow-100 text-yellow-700",
};
