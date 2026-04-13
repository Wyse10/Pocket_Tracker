const aiFocusInput = document.getElementById('ai-focus');
const generateAiInsightButton = document.getElementById('generate-ai-insight');
const aiStatus = document.getElementById('ai-status');
const aiMeta = document.getElementById('ai-meta');
const aiInsight = document.getElementById('ai-insight');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const blocks = [];
  let paragraphLines = [];
  let orderedListItems = [];
  let unorderedListItems = [];
  let titleRendered = false;

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }
    blocks.push(`<p>${formatInlineMarkdown(paragraphLines.join(' ').trim())}</p>`);
    paragraphLines = [];
  };

  const flushOrderedList = () => {
    if (!orderedListItems.length) {
      return;
    }
    blocks.push(`<ol>${orderedListItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ol>`);
    orderedListItems = [];
  };

  const flushUnorderedList = () => {
    if (!unorderedListItems.length) {
      return;
    }
    blocks.push(`<ul>${unorderedListItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ul>`);
    unorderedListItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushOrderedList();
      flushUnorderedList();
      continue;
    }

    if (/^[-=]{3,}$/.test(line)) {
      flushParagraph();
      flushOrderedList();
      flushUnorderedList();
      continue;
    }

    if (!titleRendered && /^Financial Analysis for\s+.+$/i.test(line)) {
      flushParagraph();
      flushOrderedList();
      flushUnorderedList();
      blocks.push(`<h2><strong>${formatInlineMarkdown(line)}</strong></h2>`);
      titleRendered = true;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushOrderedList();
      flushUnorderedList();
      const headingLevel = headingMatch[1].length;
      blocks.push(`<h${headingLevel}>${formatInlineMarkdown(headingMatch[2])}</h${headingLevel}>`);
      continue;
    }

    const orderedItemMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedItemMatch) {
      flushParagraph();
      flushUnorderedList();
      orderedListItems.push(orderedItemMatch[1]);
      continue;
    }

    const unorderedItemMatch = line.match(/^[*\-]\s+(.+)$/);
    if (unorderedItemMatch) {
      flushParagraph();
      flushOrderedList();
      unorderedListItems.push(unorderedItemMatch[1]);
      continue;
    }

    flushOrderedList();
    flushUnorderedList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushOrderedList();
  flushUnorderedList();

  return blocks.join('');
}

function setAiState({ status = '', insight = '', meta = '', isError = false, isLoading = false }) {
  if (aiStatus) {
    aiStatus.textContent = status;
    aiStatus.style.color = isError ? '#be123c' : '#475569';
  }

  if (aiInsight && typeof insight === 'string' && insight.length) {
    aiInsight.innerHTML = renderMarkdown(insight);
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
