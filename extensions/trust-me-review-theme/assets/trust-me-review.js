const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const endpoint = (widget) => `${widget.dataset.api.replace(/\/$/, "")}/api/storefront/products/${widget.dataset.productId}/reviews?shop=${encodeURIComponent(widget.dataset.shop)}`;
const resetTurnstile = () => window.turnstile?.reset?.();

async function loadReviews(widget) {
  try {
    const response = await fetch(endpoint(widget));
    const data = await response.json();
    widget.querySelector(".tmr-summary").textContent = data.total
      ? `${Number(data.average).toFixed(1)} / 5 · ${data.total} reviews`
      : "Be the first to review this product.";
    widget.querySelector(".tmr-list").innerHTML = data.reviews.map((review) => `
      <article class="tmr-review">
        <div class="tmr-stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
        <strong>${escapeHtml(review.title || "")}</strong>
        <p>${escapeHtml(review.body)}</p>
        <div class="tmr-meta">${escapeHtml(review.author_name)}${review.verified_purchase ? " · Verified purchase" : ""}</div>
        ${review.reply_body ? `<p><strong>Store reply:</strong> ${escapeHtml(review.reply_body)}</p>` : ""}
      </article>`).join("");
  } catch {
    widget.querySelector(".tmr-summary").textContent = "Reviews are temporarily unavailable.";
  }
}

function initializeWidget(widget) {
  if (widget.dataset.tmrInitialized === "true") return;
  widget.dataset.tmrInitialized = "true";

  const dialog = widget.querySelector("dialog");
  const writeButton = widget.querySelector(".tmr-write");
  const closeButton = widget.querySelector(".tmr-close");
  const form = widget.querySelector("form");
  const submitButton = form.querySelector('button[type="submit"]');

  writeButton.addEventListener("click", () => dialog.showModal());
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    form.reset();
    resetTurnstile();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === "true") return;

    const token = window.turnstile?.getResponse?.();
    if (!token) {
      alert("Please complete the verification before submitting your review.");
      return;
    }

    form.dataset.submitting = "true";
    submitButton.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`${widget.dataset.api.replace(/\/$/, "")}/api/storefront/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shopDomain: widget.dataset.shop,
          productId: widget.dataset.productId,
          rating: Number(values.rating),
          authorName: values.authorName,
          title: values.title,
          body: values.body,
          website: values.website,
          turnstileToken: token,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        resetTurnstile();
        alert(payload.error === "Bot verification failed"
          ? "Verification expired. Please wait until it succeeds again, then submit once."
          : payload.error === "Store connection is incomplete"
            ? "This store is still connecting. Please open Trust Me Review in Shopify Admin, complete the authorization, then try again."
          : "Unable to submit review. Please try again later.");
        return;
      }

      dialog.close();
      alert("Your review is awaiting approval.");
      await loadReviews(widget);
    } finally {
      form.dataset.submitting = "false";
      submitButton.disabled = false;
    }
  });
}

document.querySelectorAll("[data-tmr-widget]").forEach((widget) => {
  if (!widget.dataset.api) return;
  initializeWidget(widget);
  void loadReviews(widget);
});
