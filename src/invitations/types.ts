export type InvitationProduct = {
  requestId: string;
  productId: string;
  productTitle: string;
  status: "sent" | "submitted";
};

export type InvitationOrder = {
  orderId: string;
  products: InvitationProduct[];
};

export type ReviewDraft = {
  rating: number;
  title: string;
  body: string;
};
