const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const endpoint = (element) => `${element.dataset.api.replace(/\/$/, "")}/api/storefront/products/${element.dataset.productId}/reviews?shop=${encodeURIComponent(element.dataset.shop)}`;
const resetTurnstile = () => window.turnstile?.reset?.();
const stars = (rating) => `${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))}`;

function renderDistribution(widget, distribution, total) {
  widget.querySelector(".tmr-distribution").innerHTML = [5, 4, 3, 2, 1].map((rating) => {
    const count = Number(distribution[rating] ?? 0);
    const width = total ? (count / total) * 100 : 0;
    return `<div class="tmr-distribution-row"><span>${rating} ★</span><span class="tmr-distribution-bar"><span class="tmr-distribution-fill" style="width:${width}%"></span></span><span>${count}</span></div>`;
  }).join("");
}

async function loadReviews(widget) {
  const page = Number(widget.dataset.page ?? 1);
  const sort = widget.dataset.sort ?? "newest";
  try {
    const response = await fetch(`${endpoint(widget)}&page=${page}&sort=${encodeURIComponent(sort)}`);
    if (!response.ok) throw new Error("Review request failed");
    const data = await response.json();
    widget.querySelector(".tmr-summary").textContent = data.total
      ? `${Number(data.average).toFixed(1)} / 5 · ${data.total} reviews`
      : "Be the first to review this product.";
    renderDistribution(widget, data.distribution, data.total);
    widget.querySelector(".tmr-list").innerHTML = data.reviews.map((review) => `
      <article class="tmr-review">
        <div class="tmr-stars">${stars(review.rating)}</div>
        <strong>${escapeHtml(review.title || "")}</strong>
        <p>${escapeHtml(review.body)}</p>
        <div class="tmr-meta">${escapeHtml(review.author_name)}${review.verified_purchase ? " · Verified purchase" : ""}</div>
        ${review.reply_body ? `<p><strong>Store reply:</strong> ${escapeHtml(review.reply_body)}</p>` : ""}
      </article>`).join("") || "<p>No reviews match this selection.</p>";
    const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
    widget.querySelector(".tmr-page").textContent = `Page ${page} of ${totalPages}`;
    widget.querySelector(".tmr-previous").disabled = page <= 1;
    widget.querySelector(".tmr-next").disabled = page >= totalPages;
  } catch {
    widget.querySelector(".tmr-summary").textContent = "Reviews are temporarily unavailable.";
  }
}

async function loadRatingBadge(badge) {
  try {
    const response = await fetch(endpoint(badge));
    if (!response.ok) throw new Error("Rating request failed");
    const data = await response.json();
    badge.querySelector(".tmr-stars").textContent = stars(data.average || 0);
    badge.querySelector(".tmr-count").textContent = data.total ? `${Number(data.average).toFixed(1)} (${data.total})` : "0.0 (0)";
  } catch {
    badge.querySelector(".tmr-count").textContent = "";
  }
}

function initializeWidget(widget) {
  if (widget.dataset.tmrInitialized === "true") return;
  widget.dataset.tmrInitialized = "true";
  widget.dataset.page = "1";
  widget.dataset.sort = "newest";

  const dialog = widget.querySelector("dialog");
  const writeButton = widget.querySelector(".tmr-write");
  const closeButton = widget.querySelector(".tmr-close");
  const form = widget.querySelector("form");
  const submitButton = form.querySelector('button[type="submit"]');
  const sort = widget.querySelector(".tmr-sort");

  writeButton.addEventListener("click", () => dialog.showModal());
  closeButton.addEventListener("click", () => dialog.close());
  sort.addEventListener("change", () => { widget.dataset.sort = sort.value; widget.dataset.page = "1"; void loadReviews(widget); });
  widget.querySelector(".tmr-previous").addEventListener("click", () => { widget.dataset.page = String(Math.max(1, Number(widget.dataset.page) - 1)); void loadReviews(widget); });
  widget.querySelector(".tmr-next").addEventListener("click", () => { widget.dataset.page = String(Number(widget.dataset.page) + 1); void loadReviews(widget); });
  dialog.addEventListener("close", () => { form.reset(); resetTurnstile(); });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    const token = window.turnstile?.getResponse?.();
    if (!token) { alert("Please complete the verification before submitting your review."); return; }
    form.dataset.submitting = "true";
    submitButton.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`${widget.dataset.api.replace(/\/$/, "")}/api/storefront/reviews`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopDomain: widget.dataset.shop, productId: widget.dataset.productId, productTitle: widget.dataset.productTitle, rating: Number(values.rating), authorName: values.authorName, title: values.title, body: values.body, website: values.website, turnstileToken: token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        resetTurnstile();
        alert(payload.error === "Bot verification failed" ? "Verification expired. Please wait until it succeeds again, then submit once." : payload.error === "Store connection is incomplete" ? "This store is still connecting. Please open Trust Me Review in Shopify Admin, complete the authorization, then try again." : "Unable to submit review. Please try again later.");
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
  void loadReviews(widget);
}

document.querySelectorAll("[data-tmr-widget]").forEach(initializeWidget);
document.querySelectorAll("[data-tmr-stars]").forEach((badge) => void loadRatingBadge(badge));
