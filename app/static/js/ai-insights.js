const aiFocusInput = document.getElementById('ai-focus');
const generateAiInsightButton = document.getElementById('generate-ai-insight');
const aiStatus = document.getElementById('ai-status');
const aiMeta = document.getElementById('ai-meta');
const aiInsight = document.getElementById('ai-insight');

function setAiState({ status = '', insight = '', meta = '', isError = false, isLoading = false }) {
  if (aiStatus) {
    aiStatus.textContent = status;
    aiStatus.style.color = isError ? '#be123c' : '#475569';
  }

  if (aiInsight && typeof insight === 'string' && insight.length) {
    aiInsight.textContent = insight;
  }

  if (aiMeta) {
    aiMeta.textContent = meta;
  }

  if (generateAiInsightButton) {
    generateAiInsightButton.disabled = isLoading;
    generateAiInsightButton.textContent = isLoading ? 'Generating...' : 'Generate AI Insight';
  }
}

async function generateAiInsight() {
  if (window.authGuardReady) {
    await window.authGuardReady;
  }

  if (!generateAiInsightButton || !aiInsight) {
    return;
  }

  setAiState({
    status: 'Requesting AI insight...',
    isError: false,
    isLoading: true,
  });

  const focus = String(aiFocusInput?.value || '').trim();
  const shouldUsePost = focus.length >= 2;

  try {
    const payload = shouldUsePost
      ? await window.apiClient.postJson('/ai-suggestions', { focus }, 'Failed to generate AI insight.')
      : await window.apiClient.getJson('/ai-suggestions', 'Failed to generate AI insight.');

    setAiState({
      status: 'Insight updated.',
      insight: payload?.insight || 'No AI response was generated.',
      meta: `Provider: ${payload?.provider || '-'} | Model: ${payload?.model || '-'}`,
      isError: false,
      isLoading: false,
    });
  } catch (err) {
    setAiState({
      status: err?.message || 'Failed to generate AI insight.',
      isError: true,
      isLoading: false,
    });
  }
}

generateAiInsightButton?.addEventListener('click', () => {
  generateAiInsight();
});
