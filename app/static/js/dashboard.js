const incomeTotalMetric = document.getElementById('metric-income-total');
const expenseTotalMetric = document.getElementById('metric-expense-total');
const totalBalanceMetric = document.getElementById('metric-total-balance');
const monthlySpendingMetric = document.getElementById('metric-monthly-spending');
const manualRefreshButton = document.getElementById('manual-refresh');
const lastSyncLabel = document.getElementById('last-sync');
const categoryEmptyNote = document.getElementById('category-empty-note');
const trendEmptyNote = document.getElementById('trend-empty-note');
const sessionStatus = document.getElementById('session-status');
const trendGranularitySelect = document.getElementById('trend-granularity');

const REFRESH_INTERVAL_MS = 10000;
const RECENT_WINDOW_DAYS = 100;
const PLOTLY_WAIT_TIMEOUT_MS = 8000;
const PLOTLY_WAIT_INTERVAL_MS = 120;
let refreshTimer = null;
let rawSpendingOverTime = [];
let latestDashboardPayload = null;
let plotlyWaitPromise = null;

const PLOTLY_COMMON_CONFIG = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
  toImageButtonOptions: {
    format: 'png',
    filename: 'pocket-tracker-chart',
    scale: 2,
  },
};

const PLOTLY_ANIMATED_LAYOUT = {
  transition: {
    duration: 450,
    easing: 'cubic-in-out',
  },
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount);
}

function formatDateTime(dateValue) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(dateValue);
}

function setLoadingStatus(text, isError = false) {
  if (!sessionStatus) return;
  sessionStatus.style.borderColor = isError ? '#fecaca' : '#bfdbfe';
  sessionStatus.style.background = isError ? '#fef2f2' : '#eff6ff';
  sessionStatus.style.color = isError ? '#991b1b' : '#1e40af';
  const textSpan = sessionStatus.querySelector('span:last-child');
  if (textSpan) {
    textSpan.textContent = text;
  }
}

function renderMetrics(summary) {
  if (incomeTotalMetric) {
    incomeTotalMetric.textContent = formatCurrency(Number(summary.income_total || 0));
  }
  if (expenseTotalMetric) {
    expenseTotalMetric.textContent = formatCurrency(Number(summary.expense_total || 0));
  }
  if (totalBalanceMetric) {
    totalBalanceMetric.textContent = formatCurrency(Number(summary.total_balance || 0));
  }
  if (monthlySpendingMetric) {
    monthlySpendingMetric.textContent = formatCurrency(Number(summary.monthly_spending || 0));
  }
}

function renderCategoryChart(categoryBreakdown) {
  const labels = Object.keys(categoryBreakdown || {});
  const values = labels.map((label) => Number(categoryBreakdown[label] || 0));

  if (!labels.length) {
    if (categoryEmptyNote) {
      categoryEmptyNote.style.display = 'block';
      categoryEmptyNote.textContent = 'No expense data yet to render category chart.';
    }
    Plotly.purge('category-chart');
    return;
  }

  if (categoryEmptyNote) {
    categoryEmptyNote.style.display = 'none';
  }

  Plotly.react('category-chart', [
    {
      type: 'pie',
      labels,
      values,
      textinfo: 'label+percent',
      hovertemplate: '<b>%{label}</b><br>Amount: GH₵%{value:,.2f}<br>Share: %{percent}<extra></extra>',
      marker: {
        colors: ['#16a34a', '#2563eb', '#0f766e', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#0ea5e9'],
      },
    },
  ], {
    ...PLOTLY_ANIMATED_LAYOUT,
    margin: { t: 10, r: 10, b: 10, l: 10 },
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.1,
    },
  }, PLOTLY_COMMON_CONFIG);
}

function toDateOnly(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function formatDateKey(dateValue) {
  return dateValue.toISOString().slice(0, 10);
}

function startOfWeek(dateValue) {
  const copy = new Date(dateValue);
  const day = copy.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + delta);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function monthKey(dateValue) {
  return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}`;
}

function withinRecentWindow(points, days) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));

  return points.filter((point) => {
    const pointDate = toDateOnly(point.date);
    return pointDate >= start && pointDate <= now;
  });
}

function aggregateTrendPoints(spendingOverTime, granularity) {
  const points = Array.isArray(spendingOverTime) ? spendingOverTime : [];
  const source = granularity === 'monthly'
    ? points
    : withinRecentWindow(points, RECENT_WINDOW_DAYS);

  if (!source.length) {
    return [];
  }

  if (granularity === 'daily') {
    return source
      .map((point) => ({
        date: point.date,
        total: Number(point.total || 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const bucketMap = new Map();
  source.forEach((point) => {
    const pointDate = toDateOnly(point.date);
    const key = granularity === 'weekly' ? formatDateKey(startOfWeek(pointDate)) : monthKey(pointDate);
    bucketMap.set(key, Number(bucketMap.get(key) || 0) + Number(point.total || 0));
  });

  return Array.from(bucketMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function trendAxisTitle(granularity) {
  if (granularity === 'weekly') return 'Week Start';
  if (granularity === 'monthly') return 'Month';
  return 'Date';
}

function trendEmptyStateMessage(granularity) {
  if (granularity === 'weekly' || granularity === 'daily') {
    return 'No spending data found in the last 100 days.';
  }
  return 'No spending timeline data yet.';
}

function renderTrendChart(spendingOverTime) {
  const granularity = trendGranularitySelect?.value || 'monthly';
  const points = aggregateTrendPoints(spendingOverTime, granularity);
  const x = points.map((point) => point.date);
  const y = points.map((point) => Number(point.total || 0));

  if (!x.length) {
    if (trendEmptyNote) {
      trendEmptyNote.style.display = 'block';
      trendEmptyNote.textContent = trendEmptyStateMessage(granularity);
    }
    Plotly.purge('trend-chart');
    return;
  }

  if (trendEmptyNote) {
    trendEmptyNote.style.display = 'none';
  }

  Plotly.react('trend-chart', [
    {
      type: 'scatter',
      mode: 'lines+markers',
      x,
      y,
      line: {
        color: '#2563eb',
        width: 3,
        shape: 'spline',
        smoothing: 0.8,
      },
      marker: {
        color: '#1d4ed8',
        size: 7,
      },
      hovertemplate: '<b>%{x}</b><br>Spending: GH₵%{y:,.2f}<extra></extra>',
    },
  ], {
    ...PLOTLY_ANIMATED_LAYOUT,
    margin: { t: 14, r: 12, b: 42, l: 54 },
    hovermode: 'x unified',
    xaxis: {
      title: trendAxisTitle(granularity),
      tickangle: -35,
    },
    yaxis: {
      title: 'Spending',
      tickprefix: 'GH₵',
    },
    showlegend: false,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
  }, PLOTLY_COMMON_CONFIG);
}

function waitForPlotly() {
  if (window.Plotly) {
    return Promise.resolve(true);
  }

  if (plotlyWaitPromise) {
    return plotlyWaitPromise;
  }

  plotlyWaitPromise = new Promise((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      if (window.Plotly) {
        resolve(true);
        return;
      }

      if (Date.now() - startedAt >= PLOTLY_WAIT_TIMEOUT_MS) {
        resolve(false);
        return;
      }

      window.setTimeout(check, PLOTLY_WAIT_INTERVAL_MS);
    };

    check();
  });

  return plotlyWaitPromise;
}

async function renderChartsFromLatestPayload() {
  if (!latestDashboardPayload) {
    return;
  }

  const plotlyReady = await waitForPlotly();
  if (!plotlyReady) {
    if (categoryEmptyNote) {
      categoryEmptyNote.style.display = 'block';
      categoryEmptyNote.textContent = 'Charts are taking longer to load. Please refresh in a moment.';
    }
    if (trendEmptyNote) {
      trendEmptyNote.style.display = 'block';
      trendEmptyNote.textContent = 'Charts are taking longer to load. Please refresh in a moment.';
    }
    return;
  }

  renderCategoryChart(latestDashboardPayload.category_breakdown || {});
  renderTrendChart(rawSpendingOverTime);
}

async function fetchAndRenderDashboard() {
  try {
    setLoadingStatus('Syncing live dashboard...');

    const payload = await window.apiClient.getJson('/dashboard-summary', 'Failed to load dashboard summary.');

    renderMetrics(payload);
    latestDashboardPayload = payload;
    rawSpendingOverTime = Array.isArray(payload.spending_over_time) ? payload.spending_over_time : [];
    renderChartsFromLatestPayload();

    const timestamp = new Date();
    if (lastSyncLabel) {
      lastSyncLabel.textContent = `Last sync: ${formatDateTime(timestamp)}`;
    }

    setLoadingStatus('Live updates every 10s');
  } catch (error) {
    setLoadingStatus('Live session interrupted - retrying automatically', true);
    if (lastSyncLabel) {
      lastSyncLabel.textContent = 'Last sync: failed to refresh';
    }
  }
}

function startRealtimeSession() {
  fetchAndRenderDashboard();

  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }

  refreshTimer = window.setInterval(() => {
    fetchAndRenderDashboard();
  }, REFRESH_INTERVAL_MS);
}

manualRefreshButton?.addEventListener('click', () => {
  fetchAndRenderDashboard();
});

trendGranularitySelect?.addEventListener('change', () => {
  if (window.Plotly) {
    renderTrendChart(rawSpendingOverTime);
  }
});

window.addEventListener('beforeunload', () => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }
});

async function initDashboardPage() {
  if (window.authGuardReady) {
    await window.authGuardReady;
  }
  startRealtimeSession();
}

initDashboardPage();
