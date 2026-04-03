const form = document.getElementById('transaction-form');
const message = document.getElementById('message');
const dateInput = document.getElementById('date');
const typeSelect = document.getElementById('type');
const categorySelect = document.getElementById('category');
const aiChatForm = document.getElementById('ai-chat-form');
const aiQuestionInput = document.getElementById('ai-question');
const aiChatSubmit = document.getElementById('ai-chat-submit');
const aiChatResponse = document.getElementById('ai-chat-response');

if (dateInput) {
  dateInput.value = new Date().toISOString().split('T')[0];
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-600'}`;
}

function showChatResponse(text, isError = false) {
  if (!aiChatResponse) return;
  aiChatResponse.innerHTML = '';

  const p = document.createElement('p');
  p.className = `text-sm leading-6 ${isError ? 'text-red-700' : 'text-slate-700'}`;
  p.textContent = text;
  aiChatResponse.appendChild(p);
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

    categorySelect.innerHTML = categories
      .map((category) => `<option value="${category}">${category}</option>`)
      .join('');

    categorySelect.value = 'Food & Drink';
  } catch (err) {
    categorySelect.innerHTML = '<option value="Food & Drink">Food & Drink</option>';
  }
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
  } catch (err) {
    showMessage('Network error. Please try again.', true);
  }
});

typeSelect?.addEventListener('change', () => {
  loadCategories(typeSelect.value);
});

loadCategories(typeSelect?.value || 'expense');

aiChatForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const question = String(aiQuestionInput?.value || '').trim();
  if (!question) {
    showChatResponse('Please enter a question first.', true);
    return;
  }

  if (aiChatSubmit) {
    aiChatSubmit.disabled = true;
    aiChatSubmit.textContent = 'Thinking...';
  }
  showChatResponse('Generating answer...');

  try {
    const response = await fetch('/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const error = await response.json();
      const detail = typeof error.detail === 'string' ? error.detail : 'AI request failed.';
      showChatResponse(detail, true);
      return;
    }

    const result = await response.json();
    showChatResponse(result.answer || 'No answer returned from AI.', false);
  } catch (err) {
    showChatResponse('Network error while contacting AI service.', true);
  } finally {
    if (aiChatSubmit) {
      aiChatSubmit.disabled = false;
      aiChatSubmit.textContent = 'Ask AI';
    }
  }
});
