"""Spark worker helpers — no Django imports (safe to pickle on executors)."""


# Tracks how much of the file Spark has processed so far.
# Does not change the data — only counts rows and completed chunks.
# Runs on Spark workers; the main app reads these counts for the progress bar.
def make_partition_tap(rows_acc, partitions_acc):
  def tap_partition(_partition_index, rows_iter):
    row_count = 0
    for row in rows_iter:
      row_count += 1
      yield row

    rows_acc.add(row_count)
    partitions_acc.add(1)

  return tap_partition
