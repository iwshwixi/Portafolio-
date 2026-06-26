const form = document.querySelector("#invoice-form");
const paper = document.querySelector("#invoice-paper");
const itemsEditor = document.querySelector("[data-items-editor]");
const itemsBody = document.querySelector("[data-preview-items]");
const importInput = document.querySelector("[data-import-json]");

const moneyFields = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

let items = [];

const uid = () => Math.random().toString(36).slice(2, 10);
const clean = (value) => String(value ?? "").trim();
const numberValue = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

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

  if (head) {
    head.innerHTML = showQuantity
      ? "<th>Cant.</th><th>Descripción</th><th>Valor</th>"
      : "<th>Nombre</th><th>Precio</th>";
  }

  if (itemsSection) {
    itemsSection.classList.toggle("classic-items--no-quantity", !showQuantity);
  }

  itemsBody.innerHTML = "";

  visibleItems.forEach((item) => {
    const quantity = clean(item.quantity);
    const total = itemTotal(item);
    const row = document.createElement("tr");
    row.innerHTML = showQuantity
      ? `
        <td>${quantity}</td>
        <td>${clean(item.description)}</td>
        <td>${total ? formatMoney(total, fields.currency) : ""}</td>
      `
      : `
        <td>${clean(item.description)}</td>
        <td>${total ? formatMoney(total, fields.currency) : ""}</td>
      `;
    itemsBody.appendChild(row);
  });

  itemsSection.dataset.empty = visibleItems.length ? "false" : "true";

  const subtotal = visibleItems.reduce((sum, item) => sum + itemTotal(item), 0);
  document.querySelector("[data-preview-subtotal]").textContent = subtotal ? formatMoney(subtotal, fields.currency) : "";
  document.querySelector("[data-preview-total]").textContent = subtotal ? formatMoney(subtotal, fields.currency) : "";
  document.querySelector("[data-total-label]").textContent = `Total ${(clean(fields.currency) || "USD").toUpperCase()}`;
  document.querySelector("[data-summary-section]").dataset.empty = subtotal ? "false" : "true";
}

function syncItemsFromEditor() {
  items = [...itemsEditor.querySelectorAll(".item-row")].map((row) => {
    const id = row.dataset.itemId || uid();
    return {
      id,
      quantity: clean(row.querySelector('[data-item-field="quantity"]')?.value),
      description: clean(row.querySelector('[data-item-field="description"]')?.value),
      price: clean(row.querySelector('[data-item-field="price"]')?.value)
    };
  });
}

function updatePreview() {
  syncItemsFromEditor();
  const fields = getFields();
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
  return clean(getFields().invoiceNumber).replace(/[^\w-]+/g, "_") || "sin_numero";
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

  Object.entries(fields).forEach(([name, value]) => {
    const input = form.elements[name];
    if (input) input.value = value ?? "";
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

function init() {
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);
  itemsEditor.addEventListener("input", updatePreview);
  itemsEditor.addEventListener("change", updatePreview);
  document.querySelector("[data-add-item]").addEventListener("click", () => addItem());
  document.querySelector("[data-export-json]").addEventListener("click", exportJson);
  document.querySelector("[data-export-pdf]").addEventListener("click", exportPdf);
  document.querySelector("[data-import-trigger]").addEventListener("click", () => importInput.click());
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

  addItem();
  updatePreview();
  window.setInterval(updatePreview, 500);
}

init();
