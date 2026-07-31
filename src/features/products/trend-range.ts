export const PRODUCT_TREND_PRESETS = [
  { value: "yesterday", label: "Yesterday" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
] as const;

export type ProductTrendPreset = typeof PRODUCT_TREND_PRESETS[number]["value"];
export type ProductTrendBucket = "day" | "month";

export type ProductTrendSelection = {
  preset: ProductTrendPreset;
  label: string;
  bucket: ProductTrendBucket;
  startDate: string | null;
  endDate: string | null;
};

export type ProductTrendReviewRow = {
  rating: number;
  status: "pending" | "published" | "hidden" | "deleted";
  created_at: string;
};

export type ProductTrendPoint = {
  key: string;
  label: string;
  average_rating: number;
  review_count: number;
};

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const shortMonth = new Intl.DateTimeFormat(undefined, { month: "short" });
const monthYear = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addUtcDays(value: Date, days: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days));
}

function addUtcMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function parseDateInput(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isValidSelectionPreset(value: string | null | undefined): value is ProductTrendPreset {
  return PRODUCT_TREND_PRESETS.some((option) => option.value === value);
}

function getBucketSpan(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function getBucketLabel(value: Date, bucket: ProductTrendBucket, longMonthLabel: boolean) {
  if (bucket === "day") return shortDate.format(value);
  return longMonthLabel ? monthYear.format(value) : shortMonth.format(value);
}

function bucketKey(value: Date, bucket: ProductTrendBucket) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  if (bucket === "day") {
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return `${year}-${month}`;
}

function bucketStartFor(date: Date, bucket: ProductTrendBucket) {
  return bucket === "day" ? startOfUtcDay(date) : startOfUtcMonth(date);
}

function bucketStep(bucket: ProductTrendBucket, current: Date) {
  return bucket === "day" ? addUtcDays(current, 1) : addUtcMonths(current, 1);
}

export function resolveProductTrendSelection(input: {
  range?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}): ProductTrendSelection {
  const now = input.now ?? new Date();
  const preset = isValidSelectionPreset(input.range) ? input.range : "12m";

  if (preset === "custom") {
    const startDateValue = parseDateInput(input.startDate);
    const endDateValue = parseDateInput(input.endDate);
    if (startDateValue && endDateValue && endDateValue.getTime() >= startDateValue.getTime()) {
      const spanDays = getBucketSpan(startDateValue, addUtcDays(endDateValue, 1));
      return {
        preset,
        label: formatProductTrendSelectionLabel({
          preset,
          label: "Custom",
          bucket: spanDays > 92 ? "month" : "day",
          startDate: formatDateInput(startDateValue),
          endDate: formatDateInput(endDateValue),
        }),
        bucket: spanDays > 92 ? "month" : "day",
        startDate: formatDateInput(startDateValue),
        endDate: formatDateInput(endDateValue),
      };
    }
  }

  if (preset === "yesterday") {
    const end = startOfUtcDay(now);
    const start = addUtcDays(end, -1);
    return { preset, label: "Yesterday", bucket: "day", startDate: formatDateInput(start), endDate: formatDateInput(addUtcDays(end, -1)) };
  }
  if (preset === "today") {
    const start = startOfUtcDay(now);
    return { preset, label: "Today", bucket: "day", startDate: formatDateInput(start), endDate: formatDateInput(start) };
  }
  if (preset === "7d") {
    const start = addUtcDays(startOfUtcDay(now), -6);
    const end = startOfUtcDay(now);
    return { preset, label: "Last 7 days", bucket: "day", startDate: formatDateInput(start), endDate: formatDateInput(end) };
  }
  if (preset === "30d") {
    const start = addUtcDays(startOfUtcDay(now), -29);
    const end = startOfUtcDay(now);
    return { preset, label: "Last 30 days", bucket: "day", startDate: formatDateInput(start), endDate: formatDateInput(end) };
  }
  if (preset === "90d") {
    const start = addUtcDays(startOfUtcDay(now), -89);
    const end = startOfUtcDay(now);
    return { preset, label: "Last 90 days", bucket: "day", startDate: formatDateInput(start), endDate: formatDateInput(end) };
  }
  if (preset === "all") {
    return { preset, label: "All time", bucket: "month", startDate: null, endDate: null };
  }

  const start = startOfUtcMonth(addUtcMonths(now, -11));
  return { preset: "12m", label: "Last 12 months", bucket: "month", startDate: formatDateInput(start), endDate: formatDateInput(startOfUtcDay(now)) };
}

export function formatProductTrendSelectionLabel(selection: ProductTrendSelection) {
  if (selection.preset !== "custom") return selection.label;
  if (!selection.startDate || !selection.endDate) return "Custom";
  const start = parseDateInput(selection.startDate);
  const end = parseDateInput(selection.endDate);
  if (!start || !end) return "Custom";
  return `Custom · ${shortDate.format(start)} – ${shortDate.format(end)}`;
}

export function buildProductTrendSeries(rows: ProductTrendReviewRow[], selection: ProductTrendSelection) {
  const parsedRows = rows.map((row) => ({ ...row, createdAt: new Date(row.created_at) }));
  const start = selection.startDate ? parseDateInput(selection.startDate) : null;
  const endDate = selection.endDate ? parseDateInput(selection.endDate) : null;
  const endExclusive = endDate ? addUtcDays(endDate, 1) : null;
  const rangeStart = selection.preset === "all"
    ? (parsedRows[0]?.createdAt ? bucketStartFor(parsedRows[0].createdAt, selection.bucket) : bucketStartFor(new Date(), selection.bucket))
    : bucketStartFor(start ?? new Date(), selection.bucket);
  const rangeEnd = selection.preset === "all"
    ? bucketStep(selection.bucket, bucketStartFor(parsedRows[parsedRows.length - 1]?.createdAt ?? new Date(), selection.bucket))
    : (selection.bucket === "day" ? (endExclusive ?? addUtcDays(startOfUtcDay(new Date()), 1)) : bucketStep("month", bucketStartFor(endDate ?? new Date(), "month")));

  const labelModeLong = selection.bucket === "month" && getBucketSpan(rangeStart, rangeEnd) > 13 * 31;
  const aggregates = new Map<string, { reviewCount: number; ratingSum: number; ratingCount: number }>();
  for (const row of parsedRows) {
    if (selection.preset !== "all") {
      const rowTime = row.createdAt.getTime();
      const startTime = rangeStart.getTime();
      const endTime = rangeEnd.getTime();
      if (rowTime < startTime || rowTime >= endTime) continue;
    }
    const key = bucketKey(row.createdAt, selection.bucket);
    const current = aggregates.get(key) ?? { reviewCount: 0, ratingSum: 0, ratingCount: 0 };
    current.reviewCount += 1;
    if (row.status === "published") {
      current.ratingSum += row.rating;
      current.ratingCount += 1;
    }
    aggregates.set(key, current);
  }

  const points: ProductTrendPoint[] = [];
  for (let cursor = rangeStart; cursor.getTime() < rangeEnd.getTime(); cursor = bucketStep(selection.bucket, cursor)) {
    const key = bucketKey(cursor, selection.bucket);
    const bucket = aggregates.get(key);
    points.push({
      key,
      label: getBucketLabel(cursor, selection.bucket, labelModeLong),
      average_rating: bucket && bucket.ratingCount ? Number((bucket.ratingSum / bucket.ratingCount).toFixed(2)) : 0,
      review_count: bucket?.reviewCount ?? 0,
    });
  }

  return points;
}

export function summarizeProductTrend(rows: ProductTrendReviewRow[], selection: ProductTrendSelection) {
  const parsedRows = rows.map((row) => ({ ...row, createdAt: new Date(row.created_at) }));
  const start = selection.startDate ? parseDateInput(selection.startDate) : null;
  const endDate = selection.endDate ? parseDateInput(selection.endDate) : null;
  const endExclusive = endDate ? addUtcDays(endDate, 1) : null;
  const rangeStart = selection.preset === "all"
    ? (parsedRows[0]?.createdAt ? bucketStartFor(parsedRows[0].createdAt, selection.bucket) : bucketStartFor(new Date(), selection.bucket))
    : bucketStartFor(start ?? new Date(), selection.bucket);
  const rangeEnd = selection.preset === "all"
    ? bucketStep(selection.bucket, bucketStartFor(parsedRows[parsedRows.length - 1]?.createdAt ?? new Date(), selection.bucket))
    : (selection.bucket === "day" ? (endExclusive ?? addUtcDays(startOfUtcDay(new Date()), 1)) : bucketStep("month", bucketStartFor(endDate ?? new Date(), "month")));

  let totalReviews = 0;
  let averageSum = 0;
  let averageCount = 0;
  for (const row of parsedRows) {
    const rowTime = row.createdAt.getTime();
    if (rowTime < rangeStart.getTime() || rowTime >= rangeEnd.getTime()) continue;
    totalReviews += 1;
    if (row.status === "published") {
      averageSum += row.rating;
      averageCount += 1;
    }
  }

  return {
    reviewCount: totalReviews,
    averageRating: averageCount ? averageSum / averageCount : 0,
  };
}
