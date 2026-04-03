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

const state = {
  page: 1,
  pageSize: 10,
  type: 'all',
  category: 'all',
  totalPages: 0,
  total: 0,
};

const CATEGORY_OPTIONS = [
  'Food & Drink',
  'Transport',
  'Entertainment',
  'Shopping',
  'Health',
  'Salary',
  'Utility',
  'Housing',
  'Others',
];

if (dateInput) {
  dateInput.value = new Date().toISOString().split('T')[0];
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-600'}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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

function setCategoryOptions(selectElement, selectedValue, includeAllOption = false) {
  if (!selectElement) return;

  const options = [];
  if (includeAllOption) {
    options.push('<option value="all">All Categories</option>');
  }

  options.push(...CATEGORY_OPTIONS.map((category) => `<option value="${category}">${category}</option>`));
  selectElement.innerHTML = options.join('');

  if (selectedValue) {
    selectElement.value = selectedValue;
  }
}

async function loadCategories(transactionType) {
  if (!categorySelect) return;

  try {
    const response = await fetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_type: transactionType || null }),
    });

    if (!response.ok) {
      throw new Error('Failed to load categories.');
    }

    const data = await response.json();
    const categories = Array.isArray(data.categories) ? data.categories : [];
    if (!categories.length) {
      categorySelect.innerHTML = '<option value="Food & Drink">Food & Drink</option>';
      return;
    }

    categorySelect.innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join('');

    categorySelect.value = categorySelect.value || 'Food & Drink';
  } catch (err) {
    categorySelect.innerHTML = '<option value="Food & Drink">Food & Drink</option>';
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

      return `
        <tr class="hover:bg-slate-50/80">
          <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-700">${formatDate(item.date)}</td>
          <td class="px-4 py-3 text-sm">
            <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${typeClass}">${item.type}</span>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${item.category}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${item.description || '-'}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${amountClass}">${sign}${formatCurrency(item.amount)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm">
            <button
              type="button"
              class="inline-flex items-center rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              data-delete-transaction="${item.id}"
              aria-label="Delete transaction ${item.id}"
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
    const response = await fetch(`/transactions?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to load transactions.');
    }

    const data = await response.json();
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
    const response = await fetch('/add-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      showMessage(error.detail ? JSON.stringify(error.detail) : 'Failed to save transaction.', true);
      return;
    }

    const saved = await response.json();
    showMessage(`Transaction saved. ID: ${saved.id}`);
    form.reset();
    dateInput.value = new Date().toISOString().split('T')[0];
    loadCategories(typeSelect?.value || 'expense');
    loadTransactions();
  } catch (err) {
    showMessage('Network error. Please try again.', true);
  }
});

typeSelect?.addEventListener('change', () => {
  loadCategories(typeSelect.value);
});

filterTypeSelect?.addEventListener('change', () => {
  syncFilterState({ type: filterTypeSelect.value });
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
    const response = await fetch(`/transactions/${transactionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.detail || 'Failed to delete transaction.');
    }

    showMessage('Transaction deleted.');
    await loadTransactions();
  } catch (err) {
    showMessage(err.message || 'Failed to delete transaction.', true);
    button.disabled = false;
    button.textContent = previousLabel;
  }
});

setCategoryOptions(filterCategorySelect, 'all', true);
loadCategories(typeSelect?.value || 'expense');
loadTransactions();
