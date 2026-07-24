import type { Locale } from "../types";
const messages = {
  en: { writeReview: "Write a review", reviews: "Reviews", verified: "Verified purchase", pending: "Your review is awaiting approval.", noReviews: "Be the first to review this product.", submit: "Submit review" },
  "zh-CN": { writeReview: "撰写评价", reviews: "商品评价", verified: "已验证购买", pending: "您的评价正在等待审核。", noReviews: "成为第一个评价此商品的人。", submit: "提交评价" },
};
export const t = (locale: Locale, key: keyof typeof messages.en) => messages[locale]?.[key] ?? messages.en[key];
