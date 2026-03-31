const form = document.getElementById('transaction-form');
const message = document.getElementById('message');
const dateInput = document.getElementById('date');

if (dateInput) {
  dateInput.value = new Date().toISOString().split('T')[0];
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-600'}`;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    amount: Number(formData.get('amount')),
    type: String(formData.get('type')),
    category: String(formData.get('category')),
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
  } catch (err) {
    showMessage('Network error. Please try again.', true);
  }
});
