export type InvitationProductRow = {
  request_id: string;
  product_id: string;
  product_title: string;
  status: "sent" | "submitted";
};

/**
 * Database rows use snake_case; the invitation page deliberately uses
 * camelCase so every product form can be keyed by its own request ID.
 */
export function toInvitationProducts(rows: InvitationProductRow[]) {
  return rows.map((row) => ({
    requestId: row.request_id,
    productId: row.product_id,
    productTitle: row.product_title,
    status: row.status,
  }));
}
