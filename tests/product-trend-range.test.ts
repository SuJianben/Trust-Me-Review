import { describe, expect, it } from "vitest";
import { buildProductTrendSeries, resolveProductTrendSelection, summarizeProductTrend, type ProductTrendReviewRow } from "../src/features/products/trend-range";

const rows: ProductTrendReviewRow[] = [
  { rating: 4, status: "published", created_at: "2026-07-29T08:40:00.000Z" },
  { rating: 5, status: "pending", created_at: "2026-07-30T04:00:00.000Z" },
];

describe("product trend ranges", () => {
  it("builds a 12-month monthly series ending in the current month", () => {
    const selection = resolveProductTrendSelection({ range: "12m", now: new Date(Date.UTC(2026, 6, 31, 12)) });
    const series = buildProductTrendSeries(rows, selection);

    expect(selection.startDate).toBe("2025-08-01");
    expect(selection.endDate).toBe("2026-07-31");
    expect(series).toHaveLength(12);
    expect(series.at(-1)).toMatchObject({ key: "2026-07", review_count: 2 });
  });

  it("summarizes a custom daily range without counting outside dates", () => {
    const selection = resolveProductTrendSelection({ range: "custom", startDate: "2026-07-29", endDate: "2026-07-29" });
    const series = buildProductTrendSeries(rows, selection);
    const summary = summarizeProductTrend(rows, selection);

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ key: "2026-07-29", review_count: 1, average_rating: 4 });
    expect(summary).toEqual({ reviewCount: 1, averageRating: 4 });
  });
});
