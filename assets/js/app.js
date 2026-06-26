const paths = {
  site: "data/site.json",
  videos: "data/videos.json",
  stats: "data/youtube-stats.json",
  testimonials: "data/testimonials.json"
};

const state = {
  site: null,
  videos: [],
  stats: {},
  testimonials: [],
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
  const count = state.videos.length;

  const countEl = $("[data-video-count]");
  if (countEl) countEl.textContent = formatNumber(count);

  const target = $("[data-hero-video-grid]");
  if (!target) return;

  target.innerHTML = state.videos
    .map((video) => {
      const thumb = thumbUrl(video);
      const poster = thumb
        ? `<img src="${thumb}" alt="${video.title}" loading="eager">`
        : `<div class="poster-placeholder"><span>${video.category}</span></div>`;
      return `<button class="hero-thumb" type="button" data-play-video="${video.videoId}" title="${video.title}">
        ${poster}
        <span class="play-dot" aria-hidden="true">▶</span>
        <div class="hero-thumb-info">
          <strong>${video.client}</strong>
          <small>${video.category}</small>
        </div>
      </button>`;
    })
    .join("");

  $$("[data-play-video]", target).forEach((btn) => {
    btn.addEventListener("click", () => openVideoModal(btn.dataset.playVideo));
  });
}

function setupSliderNav(scope = document) {
  $$(".slider-nav", scope).forEach((btn) => {
    const trackId = btn.dataset.sliderNext || btn.dataset.sliderPrev;
    const track = document.getElementById(trackId);
    if (!track) return;
    const dir = btn.dataset.sliderNext ? 1 : -1;
    btn.addEventListener("click", () => {
      track.scrollBy({ left: dir * track.offsetWidth * 0.82, behavior: "smooth" });
    });
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

function videoCardHTML(video) {
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
        <span class="pill">${video.client}</span>
        ${dur ? `<span class="pill">${dur}</span>` : ""}
      </div>
      <h3>${video.title}</h3>
    </div>
  </article>`;
}

function renderVideos() {
  const target = $("[data-video-grid]");
  const filtered =
    state.activeFilter === "Todos"
      ? state.videos
      : state.videos.filter((video) => video.category === state.activeFilter);

  // Group by category
  const categories = [...new Set(filtered.map((v) => v.category).filter(Boolean))];

  target.innerHTML = categories.map((cat, idx) => {
    const catVideos = filtered.filter((v) => v.category === cat);
    const rowId = `row-track-${idx}`;
    return `<div class="video-category-row">
      <div class="video-cat-header">
        <h3 class="video-cat-label">${cat}</h3>
        <div class="row-nav-pair">
          <button class="slider-nav slider-nav--prev" data-slider-prev="${rowId}" aria-label="Anterior">&#8249;</button>
          <button class="slider-nav slider-nav--next" data-slider-next="${rowId}" aria-label="Siguiente">&#8250;</button>
        </div>
      </div>
      <div class="video-row-track" id="${rowId}">
        ${catVideos.map(videoCardHTML).join("")}
      </div>
    </div>`;
  }).join("");

  setupSliderNav(target);

  $$("[data-play-video]", target).forEach((btn) => {
    btn.addEventListener("click", () => openVideoModal(btn.dataset.playVideo));
  });
}

function renderPricing() {
  const filterRow = $("[data-pricing-filters]");
  if (!state.pricingFilter) state.pricingFilter = "short";

  const categories = [
    { id: "short", label: "Shorts" },
    { id: "gaming", label: "Gaming" },
    { id: "creator", label: "Vlogs" },
    { id: "custom", label: "Personalizado" }
  ];

  if (filterRow) {
    filterRow.innerHTML = categories.map(cat => 
      `<button class="filter-chip" type="button" aria-pressed="${state.pricingFilter === cat.id}" data-price-filter="${cat.id}">${cat.label}</button>`
    ).join("");
    $$("[data-price-filter]", filterRow).forEach(btn => {
      btn.addEventListener("click", () => {
        state.pricingFilter = btn.dataset.priceFilter;
        renderPricing();
      });
    });
  }

  const grid = $("[data-pricing-grid]");
  const filteredPlans = state.site.pricing.filter(p => p.id.startsWith(state.pricingFilter));

  grid.innerHTML = filteredPlans
    .map(
      (plan) => `<article class="price-card${plan.id === 'custom' ? ' price-card--highlight' : ''}">
        <h3>${plan.name}</h3>
        <strong class="price-label">${plan.priceLabel}</strong>
        <p class="price-unit">${plan.unit}</p>
        <p>${plan.summary}</p>
        <ul>${plan.features.map((feature) => `<li>${feature}</li>`).join("")}</ul>
        <button class="button primary" style="background:var(--red);border-color:var(--red);color:#fff;" type="button" data-plan-action="${plan.id}">Elegir plan</button>
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
      const planId = button.dataset.planAction;
      if (select) {
        select.value = planId;
        
        const form = $("[data-contact-form]");
        if (form) {
          const isShort = planId.startsWith("short");
          const isCustom = planId === "custom";
          
          if (isShort) {
            if (form.footageHours) form.footageHours.value = "0";
            if (form.editedMinutes) form.editedMinutes.value = "1";
            if (form.format) form.format.value = "Shorts / Reels / TikTok";
          } else if (!isCustom) {
            if (form.footageHours) form.footageHours.value = "1";
            if (form.editedMinutes) form.editedMinutes.value = "14";
            if (form.format) form.format.value = "Video largo para YouTube";
          }
          form.dispatchEvent(new Event("input"));
        }
        
        select.dispatchEvent(new Event("change"));
      }
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

function renderTestimonials() {
  const track = $("[data-testimonials-track]");
  if (!track || !state.testimonials.length) return;

  const STAR = "★";
  const VERIFIED = "✔"; //  const VERIFIED = "✔";

  track.innerHTML = state.testimonials.map((t) => {
    const avatarEl = t.avatar
      ? `<img src="${t.avatar}" alt="${t.client}" class="testi-avatar">`
      : `<div class="testi-avatar testi-avatar--initials" style="background:${t.color}">${t.initials}</div>`;

    return `<article class="testi-card">
      <div class="testi-header">
        <div class="testi-avatar-wrap">
          ${avatarEl}
          <span class="testi-verified" title="Cliente verificado">${VERIFIED}</span>
        </div>
        <div class="testi-meta">
          <strong class="testi-name">${t.client}</strong>
          <span class="testi-handle">${t.handle}</span>
        </div>
      </div>
    </article>`;
  }).join("");

  setupSliderNav($(".testimonials-slider-wrapper"));
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

// ── Smart price calculator ─────────────────────────────────
/**
 * Compute estimated price based on plan type and form inputs.
 *
 * short-basic / short-inter  → ratePerMinute × editedMinutes × quantity
 * base-plus-extra (gaming)   → (base + extraH×15 + extraM×9) × quantity
 * base-plus-extra (creator)  → (base + extraH×15) × quantity (no per-min)
 * hourly (custom)            → (cutRate(povs)×h + 9×min) × quantity
 */
function computeSmartEstimate(plan, { footageHours, editedMinutes, quantity, povs, deliveryTime }) {
  const h  = Math.max(0, Number(footageHours || 0));
  const m  = Math.max(0, Number(editedMinutes || 0));
  const q  = Math.max(1, Number(quantity || 1));
  const pv = Math.min(4, Math.max(1, Number(povs || 1)));

  if (!plan) return { total: 0, note: "" };

  let total = 0;
  let note  = "";

  if (plan.rateType === "per-minute") {
    total = plan.ratePerMinute * m * q;
    note  = `${q} short(s) × ${m}min × $${plan.ratePerMinute}/min`;

  } else if (plan.rateType === "base-plus-extra") {
    let extraH = 0;
    if (h === 0) {
      extraH = -(plan.baseHours || 1);
    } else {
      extraH = Math.max(0, h - (plan.baseHours || 1));
    }
    const extraM = plan.extraMinuteRate > 0
      ? Math.max(0, m - (plan.baseMinutes || 0))
      : 0;
    
    let perVideo = (plan.basePrice || 0)
      + extraH * (plan.extraHourRate || 15)
      + extraM * (plan.extraMinuteRate || 0);
      
    total = perVideo * q;
    const parts = [`Base $${plan.basePrice}`];
    if (h === 0) parts.push(`- $${(plan.baseHours || 1) * (plan.extraHourRate || 15)} (Ya recortado)`);
    else if (extraH > 0) parts.push(`+${extraH}h extra × $${plan.extraHourRate}`);
    
    if (extraM > 0) parts.push(`+${extraM}min extra × $${plan.extraMinuteRate}`);
    note = `${q} video(s): ${parts.join(", ")}`;

  } else {
    // hourly / custom
    const cutRate = getCutRate(pv);
    const cutCost = h * cutRate;
    const editCost = m * (state.site.rates?.editedMinute ?? 9);
    total = (cutCost + editCost) * q;
    note  = `${q} video(s): ${h}h × $${cutRate}/h + ${m}min × $${state.site.rates?.editedMinute ?? 9}`;
  }

  if (deliveryTime === "urgent") {
    total = total * 1.5;
    note += " | +50% (Entrega Urgente)";
  }

  return { total, note };
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
  const deliveryTime = data.get("deliveryTime") === "urgent" ? "Urgente (48h o menos)" : "Estandar (3-5 dias)";
  const links = data.get("links") || "Ninguno proporcionado";
  const offerPrice = data.get("offerPrice");
  const offerText = offerPrice ? `Presupuesto ofertado: $${offerPrice} USD` : "Sin oferta (acepta tarifa normal)";
  
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
    `Tiempo de entrega: ${deliveryTime}`,
    `Links de referencia: ${links}`,
    `Fecha ideal: ${data.get("deadline") || "Sin fecha definida"}`,
    "",
    offerText,
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
  if (!select || !state.site) return;
  const plan = state.site.pricing.find((p) => p.id === select.value) ?? state.site.pricing[0];
  const form = $("[data-contact-form]");

  const inputs = form ? {
    footageHours:  Number(form.footageHours?.value  || 0),
    editedMinutes: Number(form.editedMinutes?.value || 0),
    quantity:      Number(form.quantity?.value      || 1),
    povs:          Number(form.povs?.value          || 1),
    deliveryTime:  form.deliveryTime?.value         || "normal"
  } : {};

  const { total, note } = computeSmartEstimate(plan, inputs);

  const nameEl  = $("[data-selected-plan-name]");
  const priceEl = $("[data-selected-plan-price]");
  const noteEl  = $("[data-selected-plan-note]");

  if (nameEl)  nameEl.textContent  = plan.name;
  if (priceEl) priceEl.textContent = total > 0
    ? formatMoney(total, state.site.currency)
    : plan.priceLabel;
  if (noteEl)  noteEl.textContent  = note || "";

  if (form && form.offerPrice && total > 0) {
     const minOffer = Math.floor(total * 0.8);
     form.offerPrice.min = minOffer;
     form.offerPrice.title = `Puedes ofertar minimo $${minOffer} USD (20% de descuento maximo)`;
  }
}

function setupContactForm() {
  const form = $("[data-contact-form]");
  const status = $("[data-form-status]");
  if (!form) return;

  // Sync plan summary when plan or inputs change
  const budgetSelect = $("[data-budget-select]");
  if (budgetSelect) {
    budgetSelect.addEventListener("change", updatePlanSummary);
  }
  // Update estimate as user types hours/minutes/quantity
  form.addEventListener("input", updatePlanSummary);
  updatePlanSummary();

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
  const [site, videos, stats, testimonials] = await Promise.all([
    getJson(paths.site, {}),
    getJson(paths.videos, []),
    getJson(paths.stats, { videos: {} }),
    getJson(paths.testimonials, [])
  ]);

  state.site = site;
  state.videos = videos;
  state.stats = stats.videos || {};
  state.testimonials = testimonials;

  renderHero();
  renderFilters();
  renderVideos();
  renderPricing();
  renderTestimonials();
  renderSchedule();
  setupContactForm();
  setupModal();
}

init();
