const elements = {
  form: document.getElementById('invoice-form'),
  itemsContainer: document.getElementById('items-container'),
  btnAddItem: document.getElementById('btn-add-item'),
  btnExportPdf: document.getElementById('btn-export-pdf'),
  btnExportJson: document.getElementById('btn-export-json'),
  fileImportJson: document.getElementById('file-import-json'),

  // Preview elements
  pItemsBody: document.getElementById('p-items-body'),
  pSubtotal: document.getElementById('p-subtotal'),
  pTotal: document.getElementById('p-total'),
  invoicePaper: document.getElementById('invoice-paper')
};

// Map form input IDs to preview element IDs
const fieldMapping = {
  'f-issuer-name': 'p-issuer-name',
  'f-issuer-rfc': 'p-issuer-rfc',
  'f-issuer-address': 'p-issuer-address',
  'f-invoice-date': 'p-invoice-date',
  'f-invoice-number': 'p-invoice-number',
  'f-invoice-id': 'p-invoice-id',
  'f-client-name': 'p-client-name',
  'f-client-rfc': 'p-client-rfc',
  'f-client-address': 'p-client-address',
  'f-payment-method': 'p-payment-method',
  'f-payment-name': 'p-payment-name',
  'f-payment-id': 'p-payment-id',
  'f-payment-titular': 'p-payment-titular',
  'f-payment-cuenta': 'p-payment-cuenta',
  'f-payment-tipo': 'p-payment-tipo',
  'f-payment-banco': 'p-payment-banco',
  'f-payment-address': 'p-payment-address',
  'f-payment-link': 'p-payment-link',
  'f-contact-email': 'p-contact-email'
};

let items = [];

// Initialize
function init() {
  // Bind standard text fields
  for (const [inputId, previewId] of Object.entries(fieldMapping)) {
    const input = document.getElementById(inputId);
    input.addEventListener('input', () => updatePreview(inputId, previewId));
    // Trigger once on load to collapse empty wrappers
    updatePreview(inputId, previewId);
  }

  // Setup items
  elements.btnAddItem.addEventListener('click', () => addItem());
  addItem(); // Add one empty row by default

  // Export/Import
  elements.btnExportJson.addEventListener('click', exportJson);
  elements.fileImportJson.addEventListener('change', importJson);
  
  // PDF
  elements.btnExportPdf.addEventListener('click', exportPdf);
}

// Update single text field
function updatePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  
  preview.textContent = input.value;
  
  // Handle collapsing wrappers
  const wrapId = 'wrap-' + previewId.substring(2); // e.g. wrap-payment-id
  const wrap = document.getElementById(wrapId);
  if (wrap) {
    wrap.style.display = input.value.trim() ? 'block' : 'none';
  }
}

// Items logic
function addItem(qty = '', desc = '', val = '') {
  const item = { id: Date.now() + Math.random(), qty, desc, val };
  items.push(item);
  renderItemForm(item);
  updateItemsPreview();
}

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  const row = document.getElementById(`item-row-${id}`);
  if (row) row.remove();
  updateItemsPreview();
}

function renderItemForm(item) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.id = `item-row-${item.id}`;

  const iQty = document.createElement('input');
  iQty.type = 'text';
  iQty.className = 'item-qty';
  iQty.placeholder = 'Cant.';
  iQty.value = item.qty;
  iQty.addEventListener('input', (e) => { item.qty = e.target.value; updateItemsPreview(); });

  const iDesc = document.createElement('input');
  iDesc.type = 'text';
  iDesc.className = 'item-desc';
  iDesc.placeholder = 'Descripción';
  iDesc.value = item.desc;
  iDesc.addEventListener('input', (e) => { item.desc = e.target.value; updateItemsPreview(); });

  const iVal = document.createElement('input');
  iVal.type = 'text';
  iVal.className = 'item-val';
  iVal.placeholder = 'Valor (ej. 100$)';
  iVal.value = item.val;
  iVal.addEventListener('input', (e) => { item.val = e.target.value; updateItemsPreview(); });

  const btnRm = document.createElement('button');
  btnRm.type = 'button';
  btnRm.className = 'item-remove';
  btnRm.innerHTML = '&times;';
  btnRm.addEventListener('click', () => removeItem(item.id));

  row.appendChild(iQty);
  row.appendChild(iDesc);
  row.appendChild(iVal);
  row.appendChild(btnRm);
  elements.itemsContainer.appendChild(row);
}

function updateItemsPreview() {
  elements.pItemsBody.innerHTML = '';
  let subtotal = 0;

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.qty || ''}</td>
      <td>${item.desc || ''}</td>
      <td>${item.val || ''}</td>
    `;
    elements.pItemsBody.appendChild(tr);

    // Try to parse value for total
    const num = parseFloat(item.val.replace(/[^0-9.-]+/g, ""));
    if (!isNaN(num)) subtotal += num;
  });

  // Ensure there's always at least one empty row to keep table structure
  if (items.length === 0) {
    elements.pItemsBody.innerHTML = `<tr><td style="height:40px;"></td><td></td><td></td></tr>`;
  }

  // Formatting currency simply by appending '$' (you can adjust this if needed)
  elements.pSubtotal.textContent = subtotal > 0 ? `${subtotal}$` : '';
  elements.pTotal.textContent = subtotal > 0 ? `${subtotal}$` : '';
}

// Export JSON
function exportJson() {
  const data = {
    fields: {},
    items: items.map(i => ({ qty: i.qty, desc: i.desc, val: i.val }))
  };

  for (const inputId of Object.keys(fieldMapping)) {
    data.fields[inputId] = document.getElementById(inputId).value;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const invNumber = document.getElementById('f-invoice-number').value || '000';
  a.download = `Factura_${invNumber}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import JSON
function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Restore fields
      if (data.fields) {
        for (const [inputId, value] of Object.entries(data.fields)) {
          const input = document.getElementById(inputId);
          if (input) {
            input.value = value;
            updatePreview(inputId, fieldMapping[inputId]);
          }
        }
      }

      // Restore items
      if (data.items) {
        items = [];
        elements.itemsContainer.innerHTML = '';
        data.items.forEach(i => addItem(i.qty, i.desc, i.val));
      }

    } catch (err) {
      alert("Error al leer el archivo JSON.");
    }
  };
  reader.readAsText(file);
  
  // Reset input so the same file can be selected again
  event.target.value = '';
}

// Export PDF
function exportPdf() {
  const element = elements.invoicePaper;
  const invNumber = document.getElementById('f-invoice-number').value || '000';
  
  element.classList.add('exporting-pdf');

  // Opciones para asegurar la calidad de la hoja A4
  const opt = {
    margin:       0,
    filename:     `Factura_${invNumber}.pdf`,
    image:        { type: 'jpeg', quality: 1.0 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'px', format: [794, 1123], orientation: 'portrait' } // A4 en px a 96dpi
  };

  elements.btnExportPdf.textContent = "Generando...";
  elements.btnExportPdf.disabled = true;

  html2pdf().set(opt).from(element).save().then(() => {
    elements.btnExportPdf.textContent = "Descargar PDF";
    elements.btnExportPdf.disabled = false;
    element.classList.remove('exporting-pdf');
  });
}

// Run
init();
