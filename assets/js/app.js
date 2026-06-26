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
  activeFilter: "Todos",
  scheduleTimeZone: "Europe/Madrid"
};

const BASE_SCHEDULE_TIMEZONE = "America/Mexico_City";

const scheduleTimeZones = [
  { id: "Europe/Madrid", label: "España", country: "España" },
  { id: "America/Mexico_City", label: "México", country: "México" },
  { id: "America/Lima", label: "Perú", country: "Perú" },
  { id: "America/Argentina/Buenos_Aires", label: "Argentina", country: "Argentina" },
  { id: "America/Bogota", label: "Colombia", country: "Colombia" },
  { id: "America/Santiago", label: "Chile", country: "Chile" },
  { id: "America/Guayaquil", label: "Ecuador", country: "Ecuador" },
  { id: "America/New_York", label: "Estados Unidos Este", country: "Estados Unidos" },
  { id: "America/Los_Angeles", label: "Estados Unidos Oeste", country: "Estados Unidos" },
  { id: "America/Toronto", label: "Canadá Este", country: "Canadá" },
  { id: "America/Vancouver", label: "Canadá Oeste", country: "Canadá" }
];

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

const getTimeZoneParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
};

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

function baseWeekDateForIndex(index) {
  const today = getTimeZoneParts(new Date(), BASE_SCHEDULE_TIMEZONE);
  const todayUtc = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day)));
  const daysFromMonday = (todayUtc.getUTCDay() + 6) % 7;
  const mondayUtc = new Date(todayUtc.getTime() - daysFromMonday * 86400000);
  const targetUtc = new Date(mondayUtc.getTime() + index * 86400000);
  return {
    year: targetUtc.getUTCFullYear(),
    month: targetUtc.getUTCMonth() + 1,
    day: targetUtc.getUTCDate()
  };
}

function convertScheduleHours(hours, dayIndex, targetTimeZone) {
  const match = String(hours).match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
  if (!match) return hours;

  const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
  const baseDate = baseWeekDateForIndex(dayIndex);
  const start = zonedTimeToUtc({ ...baseDate, hour: startHour, minute: startMinute }, BASE_SCHEDULE_TIMEZONE);
  const end = zonedTimeToUtc({ ...baseDate, hour: endHour, minute: endMinute }, BASE_SCHEDULE_TIMEZONE);

  const timeFormatter = new Intl.DateTimeFormat("es-MX", {
    timeZone: targetTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: targetTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const crossesDay = dateFormatter.format(start) !== dateFormatter.format(end);
  return `${timeFormatter.format(start)}–${timeFormatter.format(end)}${crossesDay ? " (+1 día)" : ""}`;
}

function currentTimeLabel(targetTimeZone) {
  const zone = scheduleTimeZones.find((item) => item.id === targetTimeZone) ?? scheduleTimeZones[0];
  const now = new Intl.DateTimeFormat("es-MX", {
    timeZone: targetTimeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date());

  return `Hora actual en ${zone.country}: ${now}. Base: México 9:00–19:00.`;
}

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
  const target = $("[data-hero-video-grid]");
  if (!target) return;

  target.innerHTML = state.videos
    .slice(0, 6)
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
      </div>
      <div class="video-row-track marquee" id="${rowId}">
        <div class="marquee-inner">
          ${catVideos.map(videoCardHTML).join("")}
          ${catVideos.map(videoCardHTML).join("")}
        </div>
      </div>
    </div>`;
  }).join("");

  // setupSliderNav is no longer needed here for the auto marquee
  // but keep it for other places if used.

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
          if (form.quantity) form.quantity.value = "1";
          
          if (isShort) {
            if (form.footageHours) form.footageHours.value = "0";
            if (form.editedMinutes) form.editedMinutes.value = "1";
            if (form.format) {
               form.format.value = "Shorts / Reels / TikTok";
               form.format.dispatchEvent(new Event("change"));
            }
            if (form.editLevel) {
               if (planId.includes("inter")) form.editLevel.value = "Intermedio";
               else form.editLevel.value = "Basico";
            }
          } else if (!isCustom) {
            if (form.footageHours) form.footageHours.value = "1";
            if (form.editedMinutes) form.editedMinutes.value = "14";
            if (form.format) {
               form.format.value = "Video largo para YouTube";
               form.format.dispatchEvent(new Event("change"));
            }
            if (form.editLevel) {
               if (planId.includes("pro")) form.editLevel.value = "Avanzado";
               else if (planId.includes("inter")) form.editLevel.value = "Intermedio";
               else form.editLevel.value = "Basico";
            }
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
  const selectedZone = state.scheduleTimeZone || scheduleTimeZones[0].id;
  const timeZoneSelect = $("[data-timezone-select]");
  const currentTime = $("[data-timezone-current-time]");

  if (timeZoneSelect && !timeZoneSelect.dataset.ready) {
    timeZoneSelect.innerHTML = scheduleTimeZones
      .map((zone) => `<option value="${zone.id}">${zone.label}</option>`)
      .join("");
    timeZoneSelect.dataset.ready = "true";
    timeZoneSelect.addEventListener("change", () => {
      state.scheduleTimeZone = timeZoneSelect.value;
      renderSchedule();
    });
  }

  if (timeZoneSelect) timeZoneSelect.value = selectedZone;
  if (currentTime) currentTime.textContent = currentTimeLabel(selectedZone);
  // Week calendar — 7 day cards (Mon–Sun)
  $("[data-availability]").innerHTML = state.site.availability
    .map(
      (item, index) => `<div class="cal-day${item.workday ? "" : " cal-day--off"}">
        <span class="cal-abbr">${item.abbr || item.day.slice(0, 3)}</span>
        <strong class="cal-day-name">${item.day}</strong>
        <span class="cal-hours">${item.workday ? convertScheduleHours(item.hours, index, selectedZone) : item.hours}</span>
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

    const channelUrl = t.youtubeUrl || `https://www.youtube.com/${t.handle}`;
    return `<a class="testi-card" href="${channelUrl}" target="_blank" rel="noopener noreferrer" aria-label="Abrir el canal de YouTube de ${t.client}">
      <div class="testi-header">
        <div class="testi-avatar-wrap">
          ${avatarEl}
          <span class="testi-verified" title="Cliente verificado">${VERIFIED}</span>
        </div>
        <div class="testi-meta">
          <strong class="testi-name">${t.client}</strong>
          <span class="testi-handle">${t.handle}</span>
          <span class="testi-subscribers">${t.subscribers || "Canal de YouTube"}</span>
        </div>
      </div>
    </a>`;
  }).join("");
}

function selectedPlan() {
  const planId = $("[name='budget']").value;
  return selectedPlanById(planId);
}

function selectedPlanById(planId) {
  return state.site.pricing.find((plan) => plan.id === planId) ?? state.site.pricing[0];
}

function isShortPlan(plan) {
  return Boolean(plan?.id?.startsWith("short"));
}

function syncDeliveryOptions(form, plan) {
  if (!form?.deliveryTime) return;
  const previousValue = form.deliveryTime.value;

  if (isShortPlan(plan)) {
    form.deliveryTime.innerHTML = '<option value="short24">Short / Reel: 24 horas</option>';
    form.deliveryTime.value = "short24";
    form.deliveryTime.style.pointerEvents = "none";
    form.deliveryTime.style.opacity = "0.7";
  } else {
    form.deliveryTime.innerHTML = '<option value="normal">Estandar (3-5 dias)</option><option value="urgent">Urgente (48h) +50% costo</option>';
    form.deliveryTime.value = previousValue === "urgent" ? "urgent" : "normal";
    form.deliveryTime.style.pointerEvents = "auto";
    form.deliveryTime.style.opacity = "1";
  }
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
 * base-plus-extra (gaming)   → (base + extraH×15 + extraM×8) × quantity
 * base-plus-extra (creator)  → (base + extraH×15) × quantity (no per-min)
 * hourly (custom)            → (cutRate(povs)×h + 8×min) × quantity
 */
function computeSmartEstimate(plan, { footageHours, editedMinutes, quantity, povs, deliveryTime, revisions }) {
  const h  = Math.max(0, Number(footageHours || 0));
  const m  = Math.max(0, Number(editedMinutes || 0));
  const q  = Math.max(1, Number(quantity || 1));
  const pv = Math.min(4, Math.max(1, Number(povs || 1)));
  const rev = Math.max(2, Number(revisions || 2));

  if (!plan) return { total: 0, note: "" };

  let total = 0;
  let note  = "";

  if (plan.rateType === "per-minute") {
    total = plan.ratePerMinute * m * q;
    note  = `${q} short(s) × ${m}min × $${plan.ratePerMinute}/min`;

  } else if (plan.rateType === "base-plus-extra") {
    // El precio base cubre el paquete, aunque el material ya venga recortado.
    const extraH = Math.max(0, h - (plan.baseHours || 1));
    const extraM = plan.extraMinuteRate > 0
      ? Math.max(0, m - (plan.baseMinutes || 0))
      : 0;
    
    let perVideo = (plan.basePrice || 0)
      + extraH * (plan.extraHourRate || 15)
      + extraM * (plan.extraMinuteRate || 0);
      
    total = perVideo * q;
    const parts = [`Base $${plan.basePrice}`];
    if (extraH > 0) parts.push(`+${extraH}h extra × $${plan.extraHourRate}`);
    
    if (extraM > 0) parts.push(`+${extraM}min extra × $${plan.extraMinuteRate}`);
    note = `${q} video(s): ${parts.join(", ")}`;

  } else {
    // hourly / custom
    const cutRate = getCutRate(pv);
    const cutCost = h * cutRate;
    const editCost = m * (state.site.rates?.editedMinute ?? 8);
    total = (cutCost + editCost) * q;
    note  = `${q} video(s): ${h}h × $${cutRate}/h + ${m}min × $${state.site.rates?.editedMinute ?? 8}`;
  }

  if (rev > 2) {
    const extraRevCost = (rev - 2) * 15;
    total += extraRevCost * q;
    note += ` | +${rev - 2} ronda(s) extra ($${extraRevCost * q})`;
  }

  if (deliveryTime === "urgent" && !isShortPlan(plan)) {
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
    povs: $("[data-calc-field='povs']", calculator).value,
    revisions: $("[data-calc-field='revisions']", calculator)?.value || 2
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
  const deliveryTime = isShortPlan(plan)
    ? "Short / Reel: 24 horas"
    : data.get("deliveryTime") === "urgent"
      ? "Urgente (48h o menos)"
      : "Estandar (3-5 dias)";
  const offerPrice = data.get("offerPrice");
  const estimatedQuote = computeSmartEstimate(plan, {
    footageHours: data.get("footageHours"),
    editedMinutes: data.get("editedMinutes"),
    quantity: data.get("quantity"),
    povs: data.get("povs"),
    deliveryTime: data.get("deliveryTime"),
    revisions: data.get("revisions")
  });
  const offeredAmount = Number(offerPrice || 0);
  const priorityDifference = Math.max(0, offeredAmount - estimatedQuote.total);
  const priorityText = offeredAmount > estimatedQuote.total
    ? `Prioridad sugerida: ALTA (+${formatMoney(priorityDifference, state.site.currency)} sobre el estimado).`
    : "Prioridad sugerida: normal.";
  const offerSummary = [
    `Presupuesto calculado por la pagina: ${formatMoney(estimatedQuote.total, state.site.currency)}`,
    `Presupuesto ofertado por el cliente: ${formatMoney(offeredAmount, state.site.currency)}`,
    priorityText
  ];
  const deliveryMethod = data.get("deliveryMethod");
  const finalDeliveryMethod = deliveryMethod === "Otro" ? `Otro: ${data.get("otherDeliveryMethod")}` : deliveryMethod;
  const paymentType = data.get("paymentType") === "monthly" ? "1 vez al mes" : "Por video";
  const monthlyDate = data.get("monthlyDate") || "No especificada";
  const allLinks = data.getAll("links[]").filter(l => l.trim()).join(", ") || "Ninguno proporcionado";
  
  const youtubeChannel = data.get("youtubeChannel") || "No proporcionado";
  
  const paymentMethod = data.get("paymentMethod");
  const relationType = data.get("relationType");
  const contactMethod = data.get("contactMethod");
  const contactHandle = data.get("contactHandle");

  return [
    `Hola ${state.site.name}, quiero cotizar edicion de video.`,
    "",
    `Nombre: ${data.get("name")}`,
    `Correo: ${data.get("email")}`,
    `Medio de contacto: ${contactMethod} - ${contactHandle}`,
    `Canal de YouTube: ${youtubeChannel}`,
    `Paquete elegido: ${plan.name} — ${plan.priceLabel}`,
    `Cantidad de videos: ${data.get("quantity")}`,
    `Formato: ${data.get("format")}`,
    `Nivel de edicion: ${data.get("editLevel")}`,
    `POVs del material: ${data.get("povs")}`,
    `Horas de recorte estimadas: ${data.get("footageHours")}`,
    `Minutos editados finales estimados: ${data.get("editedMinutes")}`,
    `Rondas de cambios solicitadas: ${data.get("revisions") || 2}`,
    `Tiempo de entrega: ${deliveryTime}`,
    `Metodo de entrega: ${finalDeliveryMethod}`,
    `Tipo de pago: ${paymentType} ${paymentType === "1 vez al mes" ? `(Fecha: ${monthlyDate})` : ""}`,
    `Metodo de pago: ${paymentMethod}`,
    `Tipo de relacion: ${relationType}`,
    `Links de referencia: ${allLinks}`,
    "",
    ...offerSummary,
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

  syncDeliveryOptions(form, plan);

  const inputs = form ? {
    footageHours:  Number(form.footageHours?.value  || 0),
    editedMinutes: Number(form.editedMinutes?.value || 0),
    quantity:      Number(form.quantity?.value      || 1),
    povs:          Number(form.povs?.value          || 1),
    deliveryTime:  form.deliveryTime?.value         || "normal",
    revisions:     Number(form.revisions?.value     || 2)
  } : {};

  const { total, note } = computeSmartEstimate(plan, inputs);

  const nameEl  = $("[data-selected-plan-name]");
  const priceEl = $("[data-selected-plan-price]");
  const noteEl  = $("[data-selected-plan-note]");

  const formatSelect = document.getElementById("formatSelect");
  if (formatSelect && form) {
    if (plan.id.includes("short")) {
      formatSelect.innerHTML = '<option value="Shorts / Reels / TikTok">Shorts / Reels / TikTok</option>';
      formatSelect.style.pointerEvents = "none";
      formatSelect.style.opacity = "0.7";
    } else if (plan.id !== "custom") {
      formatSelect.innerHTML = '<option value="Video largo para YouTube">Video largo para YouTube</option>';
      formatSelect.style.pointerEvents = "none";
      formatSelect.style.opacity = "0.7";
    } else {
      formatSelect.innerHTML = '<option value="Video largo para YouTube">Video largo para YouTube</option><option value="Shorts / Reels / TikTok">Shorts / Reels / TikTok</option>';
      formatSelect.style.pointerEvents = "auto";
      formatSelect.style.opacity = "1";
    }
    formatSelect.dispatchEvent(new Event("change"));
  }

  if (nameEl)  nameEl.textContent  = plan.name;
  if (priceEl) priceEl.textContent = total > 0
    ? formatMoney(total, state.site.currency)
    : plan.priceLabel;
  if (noteEl)  noteEl.textContent  = note || "";

  const upfrontEl = $("[data-upfront-payment]");
  if (upfrontEl) {
    if (form && form.paymentType && form.paymentType.value === "monthly") {
      upfrontEl.style.display = "block";
      upfrontEl.textContent = `Adelanto por seguridad (50%): ${formatMoney(total / 2, state.site.currency)}`;
    } else {
      upfrontEl.style.display = "none";
    }
  }

  if (form && form.offerPrice && total > 0) {
     const minOffer = Math.floor(total * 0.7);
     form.offerPrice.min = minOffer;
     
     if (form.dataset.lastTotal != total) {
       form.offerPrice.value = total;
       form.dataset.lastTotal = total;
     }
  }

  const offerHint = $("[data-offer-priority-hint]", form);
  if (offerHint && form?.offerPrice && total > 0) {
    const offered = Number(form.offerPrice.value || 0);
    if (offered > total) {
      offerHint.textContent = `Oferta +${formatMoney(offered - total, state.site.currency)} sobre el estimado: mayor prioridad en agenda.`;
    } else if (offered < total) {
      offerHint.textContent = "Puedes ofertar menos, pero las ofertas que superan el estimado tienen mayor prioridad.";
    } else {
      offerHint.textContent = "Puedes ofertar. Si tu oferta supera el estimado, le doy mayor prioridad en agenda.";
    }
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
  
  const offerMinus = $("[data-offer-minus]", form);
  const offerPlus = $("[data-offer-plus]", form);
  if (offerMinus && offerPlus && form.offerPrice) {
    offerMinus.addEventListener("click", () => {
      let val = Number(form.offerPrice.value);
      const min = Number(form.offerPrice.min);
      if (val - 5 >= min) form.offerPrice.value = val - 5;
      updatePlanSummary();
    });
    offerPlus.addEventListener("click", () => {
      let val = Number(form.offerPrice.value);
      form.offerPrice.value = val + 5;
      updatePlanSummary();
    });
  }
  
  const formatSelect = document.getElementById("formatSelect");
  const editLevelSelect = document.getElementById("editLevelSelect");
  if (formatSelect && editLevelSelect) {
    formatSelect.addEventListener("change", () => {
      const isShort = formatSelect.value === "Shorts / Reels / TikTok";
      const currentLevel = editLevelSelect.value;
      editLevelSelect.innerHTML = isShort 
        ? `<option value="Basico">Basico</option><option value="Intermedio">Intermedio</option>`
        : `<option value="Basico">Basico</option><option value="Intermedio">Intermedio</option><option value="Avanzado">Avanzado</option>`;
      if (currentLevel && editLevelSelect.querySelector(`option[value="${currentLevel}"]`)) {
        editLevelSelect.value = currentLevel;
      }
    });
  }
  
  const deliveryMethodSelect = document.getElementById("deliveryMethod");
  const otherDeliveryMethodLabel = document.getElementById("otherDeliveryMethodLabel");
  if (deliveryMethodSelect && otherDeliveryMethodLabel) {
    deliveryMethodSelect.addEventListener("change", () => {
      otherDeliveryMethodLabel.style.display = deliveryMethodSelect.value === "Otro" ? "block" : "none";
      if (deliveryMethodSelect.value !== "Otro") form.otherDeliveryMethod.value = "";
    });
  }

  const paymentTypeSelect = document.getElementById("paymentType");
  const monthlyDateLabel = document.getElementById("monthlyDateLabel");
  if (paymentTypeSelect && monthlyDateLabel) {
    paymentTypeSelect.addEventListener("change", () => {
      monthlyDateLabel.style.display = paymentTypeSelect.value === "monthly" ? "block" : "none";
      if (paymentTypeSelect.value !== "monthly") form.monthlyDate.value = "";
    });
  }

  const addLinkBtn = $("[data-add-link]", form);
  const linksContainer = document.getElementById("links-container");
  if (addLinkBtn && linksContainer) {
    addLinkBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.name = "links[]";
      input.type = "url";
      input.placeholder = "https://...";
      linksContainer.appendChild(input);
    });
  }

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
