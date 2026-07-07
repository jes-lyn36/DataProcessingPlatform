export default function JobErrorAlert({ message, title = "Job failed" }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold text-red-800">{title}</p>
      <p className="mt-1 text-xs text-red-700">{message}</p>
    </div>
  );
}
