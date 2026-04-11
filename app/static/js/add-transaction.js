const form = document.getElementById('transaction-form');
const message = document.getElementById('message');
const dateInput = document.getElementById('date');
const typeSelect = document.getElementById('type');
const categorySelect = document.getElementById('category');
const filterTypeSelect = document.getElementById('filter-type');
const filterCategorySelect = document.getElementById('filter-category');
const tableBody = document.getElementById('transactions-table-body');
const tableSummary = document.getElementById('table-summary');
const pageIndicator = document.getElementById('page-indicator');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const incomeTotalMetric = document.getElementById('metric-income-total');
const expenseTotalMetric = document.getElementById('metric-expense-total');
const totalBalanceMetric = document.getElementById('metric-total-balance');

const state = {
  page: 1,
  pageSize: 10,
  type: 'all',
  category: 'all',
  totalPages: 0,
  total: 0,
};

if (dateInput) {
  dateInput.value = new Date().toISOString().split('T')[0];
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-600'}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount);
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

async function loadDashboardSummary() {
  if (!incomeTotalMetric || !expenseTotalMetric || !totalBalanceMetric) {
    return;
  }

  try {
    const summary = await window.apiClient.getJson('/dashboard-summary', 'Failed to load summary.');
    incomeTotalMetric.textContent = formatCurrency(Number(summary.income_total ?? 0));
    expenseTotalMetric.textContent = formatCurrency(Number(summary.expense_total ?? 0));
    totalBalanceMetric.textContent = formatCurrency(Number(summary.total_balance ?? 0));
  } catch (err) {
    incomeTotalMetric.textContent = '--';
    expenseTotalMetric.textContent = '--';
    totalBalanceMetric.textContent = '--';
  }
}

async function fetchCategories(transactionType = null) {
  const data = await window.apiClient.postJson(
    '/categories',
    { transaction_type: transactionType },
    'Failed to load categories.'
  );
  return Array.isArray(data?.categories) ? data.categories : [];
}

function setCategoryOptions(selectElement, categories, selectedValue, includeAllOption = false) {
  if (!selectElement) return;

  const options = [];
  if (includeAllOption) {
    options.push('<option value="all">All Categories</option>');
  }

  options.push(...categories.map((category) => {
    const safeCategory = escapeHtml(category);
    return `<option value="${safeCategory}">${safeCategory}</option>`;
  }));
  selectElement.innerHTML = options.join('');

  if (selectedValue && (selectedValue === 'all' || categories.includes(selectedValue))) {
    selectElement.value = selectedValue;
  }
}

async function loadCategories(transactionType) {
  if (!categorySelect) return;

  const previouslySelected = categorySelect.value;

  try {
    const categories = await fetchCategories(transactionType || null);

    setCategoryOptions(categorySelect, categories, previouslySelected);

    if (!categories.includes(categorySelect.value)) {
      categorySelect.value = categories[0] || '';
    }
  } catch (err) {
    setCategoryOptions(categorySelect, [], previouslySelected);
  }
}

async function loadFilterCategories(selectedType, selectedCategory = 'all') {
  const transactionType = selectedType === 'all' ? null : selectedType;

  try {
    const categories = await fetchCategories(transactionType);
    setCategoryOptions(filterCategorySelect, categories, selectedCategory, true);
  } catch (err) {
    setCategoryOptions(filterCategorySelect, [], 'all', true);
  }
}

function updatePaginationControls() {
  const hasResults = state.total > 0;

  if (pageIndicator) {
    pageIndicator.textContent = hasResults
      ? `Page ${state.page} of ${state.totalPages} • ${state.total} transaction${state.total === 1 ? '' : 's'}`
      : 'No transactions match the selected filters.';
  }

  if (prevPageButton) {
    prevPageButton.disabled = !hasResults || state.page <= 1;
  }

  if (nextPageButton) {
    nextPageButton.disabled = !hasResults || state.page >= state.totalPages;
  }
}

function renderTransactions(items) {
  if (!tableBody) return;

  if (!items.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">No transactions found for the selected filters.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = items
    .map((item) => {
      const typeClass = item.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
      const amountClass = item.type === 'income' ? 'text-emerald-700' : 'text-rose-700';
      const sign = item.type === 'income' ? '+' : '-';
      const safeDate = escapeHtml(formatDate(item.date));
      const safeType = escapeHtml(item.type);
      const safeCategory = escapeHtml(item.category);
      const safeDescription = escapeHtml(item.description || '-');
      const safeId = Number(item.id);

      return `
        <tr class="hover:bg-slate-50/80">
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">${safeDate}</td>
          <td class="px-4 py-3 text-sm">
            <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${typeClass}">${safeType}</span>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${safeCategory}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${safeDescription}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${amountClass}">${sign}${formatCurrency(item.amount)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm">
            <button
              type="button"
              class="inline-flex items-center rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              data-delete-transaction="${safeId}"
              aria-label="Delete transaction ${safeId}"
            >
              Delete
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadTransactions() {
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="6" class="px-4 py-6 text-center text-sm text-slate-500">Loading transactions...</td>
    </tr>
  `;

  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('page_size', String(state.pageSize));

  if (state.type !== 'all') {
    params.set('type', state.type);
  }

  if (state.category !== 'all') {
    params.set('category', state.category);
  }

  try {
    const data = await window.apiClient.getJson(
      `/transactions?${params.toString()}`,
      'Failed to load transactions.'
    );
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data.items)
        ? data.items
        : [];

    state.total = Number(
      Array.isArray(data)
        ? data.length
        : data.total ?? items.length
    );
    state.page = Number(Array.isArray(data) ? 1 : data.page || 1);
    state.pageSize = Number(Array.isArray(data) ? items.length || state.pageSize : data.page_size || state.pageSize);
    state.totalPages = Number(
      Array.isArray(data)
        ? (items.length ? 1 : 0)
        : data.total_pages ?? (state.total ? Math.ceil(state.total / state.pageSize) : 0)
    );

    if (tableSummary) {
      tableSummary.textContent = state.total
        ? `Showing ${items.length} transaction${items.length === 1 ? '' : 's'} on this page.`
        : 'No transactions have been recorded yet.';
    }

    renderTransactions(items);
    updatePaginationControls();
  } catch (err) {
    if (tableSummary) {
      tableSummary.textContent = 'Unable to load transactions right now.';
    }

    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-8 text-center text-sm text-red-600">Failed to load transactions.</td>
        </tr>
      `;
    }

    updatePaginationControls();
  }
}

function syncFilterState({ type, category }) {
  if (typeof type === 'string') {
    state.type = type;
  }

  if (typeof category === 'string') {
    state.category = category;
  }

  state.page = 1;
  loadTransactions();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    amount: Number(formData.get('amount')),
    type: String(formData.get('type')),
    category: String(formData.get('category')),
    description: String(formData.get('description') || '').trim() || null,
    date: String(formData.get('date')),
  };

  try {
    const saved = await window.apiClient.postJson('/add-transaction', payload, 'Failed to save transaction.');
    showMessage(`Transaction saved. ID: ${saved.id}`);
    form.reset();
    dateInput.value = new Date().toISOString().split('T')[0];
    loadCategories(typeSelect?.value || 'expense');
    loadDashboardSummary();
    loadTransactions();
  } catch (err) {
    showMessage('Network error. Please try again.', true);
  }
});

typeSelect?.addEventListener('change', () => {
  loadCategories(typeSelect.value);
});

filterTypeSelect?.addEventListener('change', async () => {
  const selectedType = filterTypeSelect.value;
  await loadFilterCategories(selectedType, 'all');
  syncFilterState({ type: selectedType, category: 'all' });
});

filterCategorySelect?.addEventListener('change', () => {
  syncFilterState({ category: filterCategorySelect.value });
});

prevPageButton?.addEventListener('click', () => {
  if (state.page <= 1) return;
  state.page -= 1;
  loadTransactions();
});

nextPageButton?.addEventListener('click', () => {
  if (state.totalPages && state.page >= state.totalPages) return;
  state.page += 1;
  loadTransactions();
});

tableBody?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-transaction]');
  if (!button) return;

  const transactionId = button.getAttribute('data-delete-transaction');
  if (!transactionId) return;

  const confirmed = window.confirm('Delete this transaction? This cannot be undone.');
  if (!confirmed) return;

  button.disabled = true;
  const previousLabel = button.textContent;
  button.textContent = 'Deleting...';

  try {
    await window.apiClient.deleteJson(`/transactions/${transactionId}`, 'Failed to delete transaction.');

    showMessage('Transaction deleted.');
    await loadDashboardSummary();
    await loadTransactions();
  } catch (err) {
    showMessage(err.message || 'Failed to delete transaction.', true);
    button.disabled = false;
    button.textContent = previousLabel;
  }
});

async function initPage() {
  if (window.authGuardReady) {
    await window.authGuardReady;
  }

  await Promise.all([
    loadCategories(typeSelect?.value || 'expense'),
    loadFilterCategories(filterTypeSelect?.value || 'all', 'all'),
    loadDashboardSummary(),
    loadTransactions(),
  ]);
}

initPage();
