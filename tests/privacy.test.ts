import { describe, expect, it } from "vitest";
import { extractCustomerEmail, redactCustomerData } from "../src/features/privacy/service";

describe("privacy payload parsing", () => {
  it("normalizes the customer email before it is hashed", () => {
    expect(extractCustomerEmail({ customer: { email: "  Person@Example.COM " } })).toBe("person@example.com");
  });

  it("does not infer an email when the Shopify payload omits it", () => {
    expect(extractCustomerEmail({ customer: {} })).toBeNull();
    expect(extractCustomerEmail({})).toBeNull();
  });

  it("records a missing-email audit without deleting customer data", async () => {
    const queries: string[] = [];
    const parameters: unknown[][] = [];
    const client = {
      query: async (sql: string, values?: unknown[]) => {
        queries.push(sql);
        parameters.push(values ?? []);
        return { rows: [], rowCount: 0 };
      },
    } as never;

    await expect(redactCustomerData(client, "shop-id", { customer: {} })).resolves.toEqual([]);
    expect(queries).toHaveLength(1);
    expect(parameters[0]?.[1]).toBe("privacy_customer_redact");
    expect(queries[0].toLowerCase()).not.toContain("delete from reviews");
  });
});
