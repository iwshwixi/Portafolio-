const paths = {
  site: "data/site.json",
  videos: "data/videos.json",
  stats: "data/youtube-stats.json"
};

const state = {
  site: null,
  videos: [],
  stats: {},
  activeFilter: "Todos"
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const formatNumber = (value) =>
  new Intl.NumberFormat("es-MX", { notation: value >= 1000000 ? "compact" : "standard" }).format(
    Number(value || 0)
  );

const formatMoney = (value, currency = "USD") =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const getVideoStats = (video) => {
  const liveStats = video.videoId ? state.stats[video.videoId] : null;
  return {
    views: Number(liveStats?.views ?? video.fallbackViews ?? 0),
    likes: Number(liveStats?.likes ?? video.fallbackLikes ?? 0),
    comments: Number(liveStats?.comments ?? video.fallbackComments ?? 0),
    duration: liveStats?.duration || video.duration || "",
    publishedAt: liveStats?.publishedAt || video.publishedAt || ""
  };
};

const videoUrl = (video) =>
  video.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}` : "#contacto";

const thumbUrl = (video) =>
  video.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(video.videoId)}/hqdefault.jpg` : "";

async function getJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

function renderHero() {
  const totalViews = state.videos.reduce((sum, video) => sum + getVideoStats(video).views, 0);
  const count = state.videos.length;
  const average = count ? Math.round(totalViews / count) : 0;

  $("[data-total-views]").textContent = formatNumber(totalViews);
  $("[data-video-count]").textContent = formatNumber(count);
  $("[data-average-views]").textContent = formatNumber(average);

  const target = $("[data-hero-video-grid]");
  if (!target) return;

  target.innerHTML = state.videos
    .map((video) => {
      const thumb = thumbUrl(video);
      const stats = getVideoStats(video);
      const poster = thumb
        ? `<img src="${thumb}" alt="${video.title}" loading="eager">`
        : `<div class="poster-placeholder small"><span>${video.category}</span></div>`;
      return `<button class="hero-thumb" type="button" data-play-video="${video.videoId}" title="${video.title}">
        ${poster}
        <span class="play-dot" aria-hidden="true">▶</span>
        <div class="hero-thumb-info">
          <strong>${video.client}</strong>
          ${stats.views > 0 ? `<small>${formatNumber(stats.views)} vistas</small>` : ""}
        </div>
      </button>`;
    })
    .join("");

  // Attach click handlers for hero thumbnails
  $$("[data-play-video]", target).forEach((btn) => {
    btn.addEventListener("click", () => openVideoModal(btn.dataset.playVideo));
  });
}

function renderFilters() {
  const categories = ["Todos", ...new Set(state.videos.map((video) => video.category).filter(Boolean))];
  const target = $("[data-filters]");
  target.innerHTML = categories
    .map(
      (category) =>
        `<button class="filter-chip" type="button" aria-pressed="${
          state.activeFilter === category
        }" data-filter="${category}">${category}</button>`
    )
    .join("");

  $$(".filter-chip", target).forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      renderFilters();
      renderVideos();
    });
  });
}

function renderVideos() {
  const target = $("[data-video-grid]");
  const filtered =
    state.activeFilter === "Todos"
      ? state.videos
      : state.videos.filter((video) => video.category === state.activeFilter);

  target.innerHTML = filtered
    .map((video) => {
      const stats = getVideoStats(video);
      const thumb = thumbUrl(video);
      const poster = thumb
        ? `<img src="${thumb}" alt="Miniatura de ${video.title}" loading="lazy">`
        : `<div class="poster-placeholder"><span>${video.category}</span></div>`;
      const dur = stats.duration || video.duration || "";
      return `<article class="video-card">
        <button class="video-thumb" type="button" data-play-video="${video.videoId}">
          ${poster}
          <span class="play-dot" aria-hidden="true">▶</span>
        </button>
        <div class="video-body">
          <div class="video-meta">
            <span class="pill">${video.category}</span>
            ${dur ? `<span class="pill">${dur}</span>` : ""}
            <span class="pill">${video.client}</span>
          </div>
          <h3>${video.title}</h3>
          <div class="video-stats">
            <span>${formatNumber(stats.views)} vistas</span>
            <span>${formatNumber(stats.likes)} likes</span>
            <span>${formatNumber(stats.comments)} com.</span>
          </div>
        </div>
      </article>`;
    })
    .join("");

  // Attach click handlers for portfolio thumbnails
  $$("[data-play-video]", target).forEach((btn) => {
    btn.addEventListener("click", () => openVideoModal(btn.dataset.playVideo));
  });
}

function renderPricing() {
  const grid = $("[data-pricing-grid]");
  grid.innerHTML = state.site.pricing
    .map(
      (plan) => `<article class="price-card${plan.id === 'custom' ? ' price-card--highlight' : ''}">
        <h3>${plan.name}</h3>
        <strong class="price-label">${plan.priceLabel}</strong>
        <p class="price-unit">${plan.unit}</p>
        <p>${plan.summary}</p>
        <ul>${plan.features.map((feature) => `<li>${feature}</li>`).join("")}</ul>
        <button class="button ${plan.id === 'custom' ? 'primary' : 'ghost'}" type="button" data-plan-action="${plan.id}">Elegir plan</button>
      </article>`
    )
    .join("");

  const select = $("[data-budget-select]");
  if (select) {
    select.innerHTML = state.site.pricing
      .map((plan) => `<option value="${plan.id}">${plan.name}</option>`)
      .join("");
  }

  $$(`.price-card [data-plan-action]`).forEach((button) => {
    button.addEventListener("click", () => {
      if (select) select.value = button.dataset.planAction;
      $("#contacto").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderMethod() {
  const target = $("[data-method-card]");
  if (!target) return;
  // Method card hidden — pricing now uses fixed packages
  target.hidden = true;
}

function renderSchedule() {
  // Week calendar — 7 day cards (Mon–Sun)
  $("[data-availability]").innerHTML = state.site.availability
    .map(
      (item) => `<div class="cal-day${item.workday ? "" : " cal-day--off"}">
        <span class="cal-abbr">${item.abbr || item.day.slice(0, 3)}</span>
        <strong class="cal-day-name">${item.day}</strong>
        <span class="cal-hours">${item.hours}</span>
        ${!item.workday ? '<span class="cal-off-badge">No laborable</span>' : '<span class="cal-dot"></span>'}
      </div>`
    )
    .join("");

  $("[data-delivery-list]").innerHTML = state.site.delivery
    .map((item) => `<div><dt>${item.label}</dt><dd>${item.value}</dd></div>`)
    .join("");
}

function selectedPlan() {
  const planId = $("[name='budget']").value;
  return selectedPlanById(planId);
}

function selectedPlanById(planId) {
  return state.site.pricing.find((plan) => plan.id === planId) ?? state.site.pricing[0];
}

function getCutRate(povs) {
  const r = state.site.rates;
  if (povs >= 4) return r.cutHour4Povs ?? 17;
  if (povs === 3) return r.cutHour3Povs ?? 16;
  if (povs === 2) return r.cutHour2Povs ?? r.cutHourTwoPovs ?? 15;
  return r.cutHour1Pov ?? r.cutHourSinglePov ?? 15;
}

function computeQuote(values) {
  const quantity = Math.max(1, Number(values.quantity || 1));
  const footageHours = Math.max(0, Number(values.footageHours || 0));
  const editedMinutes = Math.max(1, Number(values.editedMinutes || 1));
  const povs = Math.min(4, Math.max(1, Number(values.povs || 1)));
  const plan = selectedPlanById(values.planId);
  const rates = state.site.rates;
  const cutRate = getCutRate(povs);
  const cutSubtotal = footageHours * cutRate * quantity;
  const editSubtotal = editedMinutes * rates.editedMinute * quantity;
  const total = cutSubtotal + editSubtotal;

  return {
    plan,
    quantity,
    footageHours,
    editedMinutes,
    povs,
    cutRate,
    cutSubtotal,
    editSubtotal,
    total
  };
}

function quoteNote(quote) {
  return (
    `${quote.quantity} video(s): ${quote.footageHours}h de recorte x ` +
    `${formatMoney(quote.cutRate, state.site.currency)} + ${quote.editedMinutes}min editados x ` +
    `${formatMoney(state.site.rates.editedMinute, state.site.currency)}.`
  );
}

function calculateQuote() {
  const form = $("[data-contact-form]");
  const quote = computeQuote({
    planId: form.budget.value,
    quantity: form.quantity.value,
    footageHours: form.footageHours.value,
    editedMinutes: form.editedMinutes.value,
    povs: form.povs.value
  });

  $("[data-quote-total]").textContent = formatMoney(quote.total, state.site.currency);
  $("[data-quote-note]").textContent = quoteNote(quote);
  return quote;
}

function calculatorValues() {
  const calculator = $("[data-plan-calculator]");
  return {
    planId: $("[data-calc-field='plan']", calculator).value,
    quantity: $("[data-calc-field='quantity']", calculator).value,
    footageHours: $("[data-calc-field='footageHours']", calculator).value,
    editedMinutes: $("[data-calc-field='editedMinutes']", calculator).value,
    povs: $("[data-calc-field='povs']", calculator).value
  };
}

function updatePlanCalculator() {
  const calculator = $("[data-plan-calculator]");
  if (!calculator) return;
  const quote = computeQuote(calculatorValues());
  $("[data-plan-calc-total]", calculator).textContent = formatMoney(quote.total, state.site.currency);
  $("[data-plan-calc-note]", calculator).textContent = quoteNote(quote);
}

function setupPlanCalculator() {
  const calculator = $("[data-plan-calculator]");
  if (!calculator) return;

  calculator.addEventListener("input", updatePlanCalculator);
  $("[data-use-calculator]", calculator).addEventListener("click", () => {
    const values = calculatorValues();
    const form = $("[data-contact-form]");
    form.budget.value = values.planId;
    form.quantity.value = values.quantity;
    form.footageHours.value = values.footageHours;
    form.editedMinutes.value = values.editedMinutes;
    form.povs.value = values.povs;
    calculateQuote();
    $("#contacto").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  updatePlanCalculator();
}

function buildEmailBody(form) {
  const data = new FormData(form);
  const planId = data.get("budget");
  const plan = state.site.pricing.find((p) => p.id === planId) ?? state.site.pricing[0];
  return [
    `Hola ${state.site.name}, quiero cotizar edicion de video.`,
    "",
    `Nombre: ${data.get("name")}`,
    `Correo: ${data.get("email")}`,
    `Paquete elegido: ${plan.name} — ${plan.priceLabel}`,
    `Cantidad de videos: ${data.get("quantity")}`,
    `Formato: ${data.get("format")}`,
    `POVs del material: ${data.get("povs")}`,
    `Horas de recorte estimadas: ${data.get("footageHours")}`,
    `Minutos editados finales estimados: ${data.get("editedMinutes")}`,
    `Fecha ideal: ${data.get("deadline") || "Sin fecha definida"}`,
    "",
    "Peticion:",
    data.get("message")
  ].join("\n");
}

async function sendFormSubmit(body, form) {
  const response = await fetch(`https://formsubmit.co/ajax/${state.site.contactEmail}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      _subject: `Cotizacion de video - ${form.name.value}`,
      _template: "table",
      _captcha: "false",
      name: form.name.value,
      email: form.email.value,
      message: body
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === "false") {
    throw new Error(payload.message || "No se pudo enviar la solicitud.");
  }
  return payload;
}

function updatePlanSummary() {
  const select = $("[data-budget-select]");
  if (!select) return;
  const plan = state.site.pricing.find((p) => p.id === select.value) ?? state.site.pricing[0];
  const nameEl = $("[data-selected-plan-name]");
  const priceEl = $("[data-selected-plan-price]");
  if (nameEl) nameEl.textContent = plan.name;
  if (priceEl) priceEl.textContent = plan.priceLabel;
}

function setupContactForm() {
  const form = $("[data-contact-form]");
  const status = $("[data-form-status]");
  if (!form) return;

  // Sync plan summary when plan changes
  const budgetSelect = $("[data-budget-select]");
  if (budgetSelect) {
    budgetSelect.addEventListener("change", updatePlanSummary);
    updatePlanSummary();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = buildEmailBody(form);
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";
    status.textContent = "Enviando solicitud...";

    try {
      await sendFormSubmit(body, form);
      form.reset();
      updatePlanSummary();
      status.textContent = "Solicitud enviada. Te respondere al correo que dejaste.";
    } catch (error) {
      console.warn(error);
      status.textContent =
        "No se pudo enviar directo. Usa copiar mensaje y mandalo por tu canal preferido.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar solicitud";
    }
  });

  const copyBtn = $("[data-copy-request]");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const body = buildEmailBody(form);
      await navigator.clipboard.writeText(body);
      status.textContent = "Mensaje copiado. Puedes pegarlo en Gmail, WhatsApp o Discord.";
    });
  }
}

// ── Modal player ──────────────────────────────────────────────
function openVideoModal(videoId) {
  if (!videoId) return;
  const modal = $("#video-modal");
  const iframe = $("#modal-iframe");
  if (!modal || !iframe) return;
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeVideoModal() {
  const modal = $("#video-modal");
  const iframe = $("#modal-iframe");
  if (!modal || !iframe) return;
  iframe.src = "";
  modal.hidden = true;
  document.body.style.overflow = "";
}

function setupModal() {
  const close = $("#modal-close");
  const backdrop = $("#modal-backdrop");
  if (close) close.addEventListener("click", closeVideoModal);
  if (backdrop) backdrop.addEventListener("click", closeVideoModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeVideoModal();
  });
}

async function init() {
  const [site, videos, stats] = await Promise.all([
    getJson(paths.site, {}),
    getJson(paths.videos, []),
    getJson(paths.stats, { videos: {} })
  ]);

  state.site = site;
  state.videos = videos;
  state.stats = stats.videos || {};

  renderHero();
  renderFilters();
  renderVideos();
  renderPricing();
  renderSchedule();
  setupContactForm();
  setupModal();
}

init();
