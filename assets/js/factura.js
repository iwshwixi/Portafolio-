const form = document.querySelector("#invoice-form");
const paper = document.querySelector("#invoice-paper");
const itemsEditor = document.querySelector("[data-items-editor]");
const itemsBody = document.querySelector("[data-preview-items]");
const importInput = document.querySelector("[data-import-json]");
const previewArea = document.querySelector("[data-preview-area]");
const paperStage = document.querySelector("[data-paper-stage]");
const zoomLabel = document.querySelector("[data-zoom-label]");

const moneyFields = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const fiscalInvoiceLinks = [
  { label: "México", url: "https://www.sat.gob.mx/portal/public/tramites/factura-electronica" },
  { label: "Estados Unidos", url: "https://www.irs.gov/businesses/small-businesses-self-employed/self-employed-individuals-tax-center" },
  { label: "Canadá", url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-receipts-invoices.html" },
  { label: "España", url: "https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro.html" },
  { label: "Perú", url: "https://cpe.sunat.gob.pe/" },
  { label: "Chile", url: "https://www.sii.cl/servicios_online/1039-.html" },
  { label: "Argentina", url: "https://www.afip.gob.ar/fe/" },
  { label: "Colombia", url: "https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/" },
  { label: "Ecuador", url: "https://www.sri.gob.ec/facturacion-electronica" },
  { label: "Uruguay", url: "https://www.efactura.dgi.gub.uy/" }
];

let items = [];
let previewZoom = 1;

const uid = () => Math.random().toString(36).slice(2, 10);
const clean = (value) => String(value ?? "").trim();
const numberValue = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyPreviewZoom(nextZoom, anchor = null) {
  const previousZoom = previewZoom;
  previewZoom = clamp(Number(nextZoom) || 1, 0.35, 2.5);
  paper.style.setProperty("--invoice-zoom", previewZoom);
  if (paperStage) {
    paperStage.style.width = `${paper.offsetWidth * previewZoom}px`;
    paperStage.style.minHeight = `${paper.offsetHeight * previewZoom + 42}px`;
  }
  if (zoomLabel) zoomLabel.textContent = `${Math.round(previewZoom * 100)}%`;

  if (anchor && previewArea && previousZoom > 0) {
    const ratio = previewZoom / previousZoom;
    previewArea.scrollLeft = (previewArea.scrollLeft + anchor.x) * ratio - anchor.x;
    previewArea.scrollTop = (previewArea.scrollTop + anchor.y) * ratio - anchor.y;
  }
}

function getFields() {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, clean(value)]));
}

function formatMoney(value, currency) {
  const code = (clean(currency) || "USD").toUpperCase();
  const amount = moneyFields.format(value);
  if (code === "USD") return `$${amount}`;
  if (code === "EUR") return `${amount} €`;
  if (code === "MXN") return `$${amount} MXN`;
  return `${amount} ${code}`;
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function updateDirectPreview(fields) {
  document.querySelectorAll("[data-preview]").forEach((target) => {
    const key = target.dataset.preview;
    const value = clean(fields[key]);
    const prefix = target.dataset.prefix || "";
    target.textContent = "";
    if (value) {
      if (prefix) {
        const label = document.createElement("strong");
        label.className = "preview-label";
        label.textContent = prefix;
        target.append(label, document.createTextNode(value));
      } else {
        target.textContent = value;
      }
    }
    target.dataset.empty = value ? "false" : "true";
    const wrapper = target.closest("[data-hide-empty]");
    if (wrapper) wrapper.dataset.empty = value ? "false" : "true";
  });
}

function updateParties() {
  ["client", "company"].forEach((type) => {
    const party = document.querySelector(`[data-party="${type}"]`);
    const hasData = [...party.querySelectorAll("[data-preview]")].some((node) => clean(node.textContent));
    party.dataset.empty = hasData ? "false" : "true";
  });

  const companyRule = document.querySelector("[data-company-rule]");
  if (companyRule) {
    const hasLowerIssuerData = ["companyDocument", "companyAddress"].some((key) =>
      clean(document.querySelector(`[data-preview="${key}"]`)?.textContent)
    );
    companyRule.hidden = !hasLowerIssuerData;
  }

  const client = document.querySelector('[data-party="client"]');
  const company = document.querySelector('[data-party="company"]');
  if (client && company) {
    const top = document.querySelector(".classic-top");
    const metaHasData = [...document.querySelectorAll(".classic-meta [data-preview]")].some((node) =>
      clean(node.textContent)
    );
    if (top) top.dataset.empty = company.dataset.empty === "true" && !metaHasData ? "true" : "false";
  }
}

function updatePayment() {
  const payment = document.querySelector("[data-payment-section]");
  const hasData = [...payment.querySelectorAll("[data-preview]")].some((node) => clean(node.textContent));
  payment.dataset.empty = hasData ? "false" : "true";

  const hasPaymentDetails = ["paymentRecipient", "paymentReference", "paymentNotes"].some((key) =>
    clean(document.querySelector(`[data-preview="${key}"]`)?.textContent)
  );
  const rule = document.querySelector("[data-payment-rule]");
  if (rule) rule.hidden = !hasPaymentDetails;
}

function itemHasData(item) {
  return Boolean(clean(item.description) || clean(item.quantity) || clean(item.price));
}

function itemTotal(item) {
  return numberValue(item.price);
}

function renderItemEditor() {
  itemsEditor.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.itemId = item.id;
    row.innerHTML = `
      <label style="display: flex; flex-direction: column; gap: 6px; align-items: center;" title="Color de fondo de esta fila">
        <span style="font-size: 11px; color: transparent; user-select: none;">C</span>
        <input data-item-field="color" type="color" value="${escapeAttr(item.color || '#ffffff')}" style="width: 28px; height: 38px; padding: 0; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; background: transparent;">
      </label>
      <label>
        Cantidad
        <input data-item-field="quantity" type="number" min="0" step="1" placeholder="Ej. 3" value="${item.quantity}">
      </label>
      <label>
        Descripción
        <input data-item-field="description" type="text" placeholder="Ej. Edición de videos en 16:9" value="${escapeAttr(item.description)}">
      </label>
      <label>
        Precio
        <input data-item-field="price" type="number" min="0" step="0.01" placeholder="Ej. 400" value="${escapeAttr(item.price)}">
      </label>
      <button class="item-remove" type="button" aria-label="Eliminar fila ${index + 1}">×</button>
    `;

    row.querySelectorAll("[data-item-field]").forEach((input) => {
      input.addEventListener("input", () => {
        item[input.dataset.itemField] = input.value;
        updatePreview();
      });
    });

    row.querySelector(".item-remove").addEventListener("click", () => {
      items = items.filter((entry) => entry.id !== item.id);
      if (!items.length) addItem();
      renderItemEditor();
      updatePreview();
    });

    itemsEditor.appendChild(row);
  });
}

function renderPreviewItems(fields) {
  const visibleItems = items.filter(itemHasData);
  const showQuantity = fields.showQuantity !== "no";
  const head = document.querySelector("[data-preview-items-head]");
  const itemsSection = document.querySelector("[data-items-section]");
  const customConceptName = clean(fields.customConceptName) || "Concepto";

  if (head) {
    head.innerHTML = showQuantity
      ? "<th>Cant.</th><th>Descripción</th><th>Valor</th>"
      : `<th>${escapeAttr(customConceptName)}</th><th>Valor</th>`;
  }

  if (itemsSection) {
    itemsSection.classList.toggle("classic-items--no-quantity", !showQuantity);
  }

  itemsBody.innerHTML = "";

  visibleItems.forEach((item) => {
    const quantity = clean(item.quantity);
    const total = itemTotal(item);
    const tr = document.createElement("tr");

    let styleStr = "";
    if (item.color && item.color !== "#ffffff") {
      const hex = item.color.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      const textColor = (yiq >= 128) ? "#000000" : "#ffffff";
      styleStr = ` style="background-color: ${item.color}; color: ${textColor};"`;
    }

    tr.innerHTML = showQuantity
      ? `
        <td${styleStr}>${quantity}</td>
        <td${styleStr}>${clean(item.description)}</td>
        <td${styleStr}>${total ? formatMoney(total, fields.currency) : ""}</td>
      `
      : `
        <td${styleStr}>${clean(item.description)}</td>
        <td${styleStr}>${total ? formatMoney(total, fields.currency) : ""}</td>
      `;
    itemsBody.appendChild(tr);
  });

  itemsSection.dataset.empty = visibleItems.length ? "false" : "true";

  const subtotal = visibleItems.reduce((sum, item) => sum + itemTotal(item), 0);
  
  let taxAmount = 0;
  const taxRow = document.querySelector("[data-tax-row]");
  if (fields.applyTax === "yes") {
    taxAmount = numberValue(fields.taxAmount);
    const taxName = clean(fields.taxName) || "Impuesto / Comisión";
    document.querySelector("[data-tax-label]").textContent = taxName;
    document.querySelector("[data-preview-tax]").textContent = formatMoney(taxAmount, fields.currency);
    if (taxRow) taxRow.hidden = false;
  } else {
    if (taxRow) taxRow.hidden = true;
  }

  const finalTotal = subtotal + taxAmount;

  document.querySelector("[data-preview-total]").textContent = finalTotal ? formatMoney(finalTotal, fields.currency) : "";
  document.querySelector("[data-total-label]").textContent = `Total ${(clean(fields.currency) || "USD").toUpperCase()}`;
  document.querySelector("[data-summary-section]").dataset.empty = finalTotal ? "false" : "true";
}

function syncItemsFromEditor() {
  items = [...itemsEditor.querySelectorAll(".item-row")].map((row) => {
    const id = row.dataset.itemId || uid();
    return {
      id,
      color: row.querySelector('[data-item-field="color"]')?.value || "#ffffff",
      quantity: clean(row.querySelector('[data-item-field="quantity"]')?.value),
      description: clean(row.querySelector('[data-item-field="description"]')?.value),
      price: clean(row.querySelector('[data-item-field="price"]')?.value)
    };
  });
}

function updatePreview() {
  syncItemsFromEditor();
  const fields = getFields();
  
  const conceptLabelContainer = document.querySelector("[data-concept-label-container]");
  if (conceptLabelContainer) conceptLabelContainer.style.display = fields.showQuantity === "yes" ? "none" : "block";
  
  const taxFields = document.querySelector("[data-tax-fields]");
  if (taxFields) taxFields.style.display = fields.applyTax === "no" ? "none" : "grid";
  
  const toggleDateBtn = document.querySelector("[data-toggle-date]");
  if (toggleDateBtn) {
    const isAct = fields.appendDateToFilename === "true";
    toggleDateBtn.textContent = isAct ? "Sí" : "No";
    toggleDateBtn.style.background = isAct ? "#ff4d4d" : "transparent";
    toggleDateBtn.style.color = isAct ? "#fff" : "#ff4d4d";
  }

  updateDirectPreview(fields);
  updateParties();
  updatePayment();
  renderPreviewItems(fields);
}

function addItem(values = {}) {
  items.push({
    id: values.id || uid(),
    quantity: clean(values.quantity),
    description: clean(values.description),
    price: clean(values.price)
  });
  renderItemEditor();
  updatePreview();
}

function invoiceNumberForFile() {
  const fields = getFields();
  let baseName = clean(fields.companyName) || "Documento";
  let brand = baseName.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  if (!brand) brand = "Factura";
  
  let fileName = `${brand}_Factura`;
  
  const invNumber = clean(fields.invoiceNumber).replace(/[^\w-]+/g, "_");
  if (invNumber) {
    fileName += `_${invNumber}`;
  }
  
  const appendDateInput = document.querySelector('[name="appendDateToFilename"]');
  if (appendDateInput && appendDateInput.value === "true") {
    const dateObj = new Date();
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    fileName += `_${dateStr}`;
  }
  
  return fileName;
}

function exportJson() {
  const data = {
    type: "invoice-generator-config",
    version: 1,
    savedAt: new Date().toISOString(),
    fields: getFields(),
    items: items.map(({ quantity, description, price }) => ({ quantity, description, price }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `factura_${invoiceNumberForFile()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const fields = data.fields || {};

  form.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });

  Object.entries(fields).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) {
      if (input.type === "checkbox") {
        input.checked = true;
      } else {
        input.value = value ?? "";
      }
    }
  });

  items = Array.isArray(data.items) && data.items.length
    ? data.items.map((item) => ({ id: uid(), ...item }))
    : [];

  if (!items.length) addItem();
  renderItemEditor();
  updatePreview();
}

async function exportPdf() {
  if (!window.html2pdf) {
    alert("No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo.");
    return;
  }

  const button = document.querySelector("[data-export-pdf]");
  button.disabled = true;
  button.textContent = "Generando...";
  paper.classList.add("exporting");

  const options = {
    margin: 0,
    filename: `factura_${invoiceNumberForFile()}.pdf`,
    image: { type: "jpeg", quality: 1 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "px", format: [794, 1123], orientation: "portrait" }
  };

  try {
    await window.html2pdf().set(options).from(paper).save();
  } finally {
    paper.classList.remove("exporting");
    button.disabled = false;
    button.textContent = "Descargar PDF";
  }
}

function setupLegalInfoModal() {
  const modal = document.getElementById("invoice-legal-modal");
  const trigger = document.querySelector("[data-legal-info-trigger]");
  const closeButtons = document.querySelectorAll("[data-legal-info-close]");
  const fiscalCountrySelect = document.getElementById("invoice-fiscal-country-select");
  if (!modal || !trigger) return;

  if (fiscalCountrySelect) {
    fiscalInvoiceLinks.forEach(({ label, url }) => {
      const option = document.createElement("option");
      option.value = url;
      option.textContent = label;
      fiscalCountrySelect.appendChild(option);
    });

    fiscalCountrySelect.addEventListener("change", () => {
      const url = fiscalCountrySelect.value;
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
      fiscalCountrySelect.value = "";
    });
  }

  const openModal = () => {
    if (fiscalCountrySelect) fiscalCountrySelect.value = "";
    modal.hidden = false;
  };
  const closeModal = () => {
    modal.hidden = true;
  };

  trigger.addEventListener("click", openModal);
  closeButtons.forEach((button) => button.addEventListener("click", closeModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });
}

function init() {
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);
  itemsEditor.addEventListener("input", updatePreview);
  itemsEditor.addEventListener("change", updatePreview);
  document.querySelector("[data-add-item]").addEventListener("click", () => addItem());
  document.querySelector("[data-export-json]").addEventListener("click", exportJson);
  document.querySelector("[data-export-pdf]").addEventListener("click", exportPdf);
  document.querySelector("[data-import-trigger]").addEventListener("click", () => importInput.click());
  document.querySelector("[data-zoom-out]")?.addEventListener("click", () => applyPreviewZoom(previewZoom - 0.1));
  document.querySelector("[data-zoom-in]")?.addEventListener("click", () => applyPreviewZoom(previewZoom + 0.1));
  document.querySelector("[data-zoom-reset]")?.addEventListener("click", () => applyPreviewZoom(1));
  setupLegalInfoModal();

  const toggleDateBtn = document.querySelector("[data-toggle-date]");
  const appendDateInput = document.querySelector('[name="appendDateToFilename"]');
  if (toggleDateBtn && appendDateInput) {
    toggleDateBtn.addEventListener("click", () => {
      const isAct = appendDateInput.value === "true";
      appendDateInput.value = isAct ? "false" : "true";
      updatePreview();
    });
  }

  previewArea?.addEventListener("wheel", (event) => {
    if (!event.altKey) return;
    event.preventDefault();
    const rect = previewArea.getBoundingClientRect();
    const anchor = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    const direction = event.deltaY > 0 ? -1 : 1;
    applyPreviewZoom(previewZoom + direction * 0.08, anchor);
  }, { passive: false });
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      await importJson(file);
    } catch (error) {
      alert("No se pudo cargar el JSON. Revisa que sea un archivo válido.");
    } finally {
      importInput.value = "";
    }
  });

  document.querySelector("[data-random-example]")?.addEventListener("click", generateRandomExample);
  document.querySelector("[data-clear-form]")?.addEventListener("click", clearForm);

  addItem();
  applyPreviewZoom(1);
  updatePreview();
  window.setInterval(updatePreview, 500);
}

function clearForm() {
  if (!confirm("¿Seguro que quieres borrar todos los datos de la factura?")) return;
  form.reset();
  items = [];
  addItem();
  const appendDateInput = document.querySelector('[name="appendDateToFilename"]');
  if (appendDateInput) appendDateInput.value = "false";
  updatePreview();
}

function generateRandomExample() {
  const fNames = ["Juan Pérez", "Carlos Mendoza", "Ana Gómez", "Lucía Fernández", "Mateo Silva", "Laura Torres", "Diego Ruiz"];
  const fCompanies = ["Nebula Studio", "Pixel Perfecto", "Agencia Creativa Omega", "Horizonte Digital", "Ediciones Quasar", "CineMágica", "Creative Labs", "Vanguardia Visual"];
  const fAddresses = ["Av. Siempre Viva 123, Depto 4B, Springfield, CP 90210, País ficticio", "Calle Principal 456, Piso 2, Metrópolis, CP 10001, Estado Nuevo", "Boulevard de las Artes 789, Oficina 10, Capital, CP 54321", "Sector 7, Distrito Central, Código 9090, Región Alfa", "123 Calle Falsa, Suite 100, Ciudadela, CP 12345"];
  const fServices = ["Edición de video para YouTube (10 min)", "Corrección de color - Proyecto Cortometraje", "Diseño de miniaturas (Paquete de 5)", "Animación de intro 2D", "Mezcla de audio y masterización", "Subtítulos y traducción ENG-ESP", "Montaje y efectos visuales"];
  const fMethods = ["Transferencia Bancaria", "PayPal", "Binance Pay", "Mercado Pago", "Stripe", "Zelle"];

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  form.elements["invoiceNumber"].value = "INV-2026-" + Math.floor(Math.random() * 900 + 100);
  form.elements["invoiceDate"].value = "26 Junio de 2026";
  form.elements["invoiceId"].value = randomItem(fCompanies);
  form.elements["currency"].value = "USD";
  
  form.elements["showQuantity"].value = Math.random() > 0.3 ? "yes" : "no";
  form.elements["customConceptName"].value = "Servicio";
  
  const applyTax = Math.random() > 0.5;
  form.elements["applyTax"].value = applyTax ? "yes" : "no";
  form.elements["taxName"].value = applyTax ? (Math.random() > 0.5 ? "Impuesto IVA (16%)" : "Comisión PayPal") : "";
  form.elements["taxAmount"].value = applyTax ? Math.floor(Math.random() * 50 + 10) : "";
  
  form.elements["clientName"].value = form.elements["invoiceId"].value;
  form.elements["clientDocument"].value = "ID-" + Math.floor(Math.random() * 90000 + 10000);
  form.elements["clientAddress"].value = randomItem(fAddresses);
  
  form.elements["companyName"].value = randomItem(fNames) + " Editor";
  form.elements["companyDocument"].value = "RFC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  form.elements["companyAddress"].value = randomItem(fAddresses);
  
  const cleanFirstName = form.elements["companyName"].value.toLowerCase().split(' ')[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  form.elements["companyEmail"].value = "contacto@" + cleanFirstName + ".com";
  
  form.elements["paymentMethod"].value = randomItem(fMethods);
  form.elements["paymentRecipient"].value = form.elements["companyName"].value;
  form.elements["paymentReference"].value = Math.floor(Math.random() * 9000000000 + 1000000000);
  form.elements["paymentNotes"].value = "";
  
  const appendDateInput = document.querySelector('[name="appendDateToFilename"]');
  if (appendDateInput) appendDateInput.value = Math.random() > 0.5 ? "true" : "false";

  items = [];
  const numItems = Math.floor(Math.random() * 3) + 2;
  const fColors = ["#ffffff", "#ffffff", "#ffffff", "#ff4d4d", "#9b59b6", "#3498db", "#2ecc71"];
  for (let i = 0; i < numItems; i++) {
    items.push({
      id: uid(),
      color: randomItem(fColors),
      quantity: Math.floor(Math.random() * 5) + 1,
      description: randomItem(fServices),
      price: Math.floor(Math.random() * 200) + 50
    });
  }
  
  renderItemEditor();
  updatePreview();
}

init();
