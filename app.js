if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

window.addEventListener("pageshow", () => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, { once: true });

const state = {
  data: null,
  query: "",
  theme: "all",
  status: "all",
  limit: 12,
  quoteIndex: 0,
};

const elements = {
  clearFilters: document.querySelector("#clear-filters"),
  emptyState: document.querySelector("#empty-state"),
  evidenceGrid: document.querySelector("#evidence-grid"),
  filterCount: document.querySelector(".filter-count"),
  filtersPanel: document.querySelector("#filters-panel"),
  filterToggle: document.querySelector(".filter-toggle"),
  loadMore: document.querySelector("#load-more"),
  menuToggle: document.querySelector(".menu-toggle"),
  methodText: document.querySelector("#method-text"),
  metricGrid: document.querySelector("#metric-grid"),
  mobileNav: document.querySelector("#mobile-nav"),
  modal: document.querySelector("#evidence-modal"),
  modalContent: document.querySelector("#modal-content"),
  pageProgress: document.querySelector("#page-progress-bar"),
  quoteCurrent: document.querySelector("#quote-current"),
  quoteStage: document.querySelector("#quote-stage"),
  quoteTotal: document.querySelector("#quote-total"),
  resultCount: document.querySelector("#result-count"),
  search: document.querySelector("#evidence-search"),
  statusFilters: document.querySelector("#status-filters"),
  statusLegend: document.querySelector("#status-legend"),
  summaryGrid: document.querySelector("#summary-grid"),
  themeFilters: document.querySelector("#theme-filters"),
};

const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character],
  );

const slug = (value = "") =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const sourceLink = (source) => {
  if (!source.url) {
    return `<p class="source-note">${escapeHtml(source.label)}</p>`;
  }
  try {
    const url = new URL(source.url);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} <span aria-hidden="true">↗</span></a>`;
  } catch {
    return "";
  }
};

function renderSummary() {
  elements.summaryGrid.innerHTML = state.data.meta.summary
    .map(
      (item, index) => `
        <article class="summary-item motion-reveal" style="--delay: ${index * 70}ms">
          <span class="summary-number">${String(index + 1).padStart(2, "0")}</span>
          <p>${escapeHtml(item)}</p>
        </article>`,
    )
    .join("");
}

function renderMetrics() {
  elements.metricGrid.innerHTML = state.data.metrics
    .map(
      (metric, index) => `
        <button class="metric-card motion-reveal" style="--delay: ${(index % 4) * 75}ms" type="button" data-target="${escapeHtml(metric.target)}" aria-label="Open evidence for ${escapeHtml(metric.value)}: ${escapeHtml(metric.label)}">
          <span class="metric-top"><span>Impact ${String(index + 1).padStart(2, "0")}</span></span>
          <span class="metric-value">${escapeHtml(metric.value)}</span>
          <span class="metric-label">${escapeHtml(metric.label)}</span>
        </button>`,
    )
    .join("");

  elements.metricGrid.querySelectorAll(".metric-card").forEach((card) => {
    card.addEventListener("click", () => openEvidence(card.dataset.target));
  });
}

function renderStatusLegend() {
  const counts = Object.groupBy(state.data.achievements, (item) => item.status);
  elements.statusLegend.innerHTML = Object.entries(counts)
    .map(
      ([status, items]) =>
        `<span class="status-pill status-${slug(status)}">${escapeHtml(status)} ${items.length}</span>`,
    )
    .join("");
}

function filterButton(value, label, count, group) {
  const active = state[group] === value;
  return `<button class="filter-chip" type="button" data-group="${group}" data-value="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}${count === undefined ? "" : ` · ${count}`}</button>`;
}

function renderFilters() {
  elements.themeFilters.innerHTML = [
    filterButton("all", "All themes", state.data.achievements.length, "theme"),
    ...state.data.themes.map((theme) => filterButton(theme.id, theme.title, theme.count, "theme")),
  ].join("");

  const counts = Object.groupBy(state.data.achievements, (item) => item.status);
  elements.statusFilters.innerHTML = [
    filterButton("all", "Any status", state.data.achievements.length, "status"),
    ...Object.entries(counts).map(([status, items]) => filterButton(status, status, items.length, "status")),
  ].join("");

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state[button.dataset.group] = button.dataset.value;
      state.limit = 12;
      renderFilters();
      renderEvidence();
    });
  });
}

function filteredEvidence() {
  const normalizedQuery = state.query.trim().toLowerCase();
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  return state.data.achievements.filter((item) => {
    const matchesTheme = state.theme === "all" || item.theme === state.theme;
    const matchesStatus = state.status === "all" || item.status === state.status;
    const haystack = [
      item.title,
      item.figure,
      item.description,
      item.sector,
      item.location,
      item.creditedTo,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = queryTerms.length === 0 || queryTerms.every((term) => haystack.includes(term));
    return matchesTheme && matchesStatus && matchesQuery;
  });
}

function evidenceCard(item, index) {
  const theme = state.data.themes.find((entry) => entry.id === item.theme);
  return `
    <article class="evidence-card" style="--delay: ${(index % 6) * 45}ms" data-id="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="Open evidence item ${item.rank}: ${escapeHtml(item.title)}">
      <div class="card-topline">
        <span class="card-rank">#${String(item.rank).padStart(2, "0")}</span>
        <span class="item-status status-${slug(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      ${item.figure ? `<p class="figure">${escapeHtml(item.figure)}</p>` : ""}
      <p class="excerpt">${escapeHtml(item.description)}</p>
      <div class="card-footer">
        <span class="card-meta">${escapeHtml(theme?.title || item.sector)}<br />${escapeHtml(item.location)} · ${escapeHtml(item.date)}</span>
      </div>
    </article>`;
}

function updateFilterState() {
  const count = Number(Boolean(state.query.trim())) + Number(state.theme !== "all") + Number(state.status !== "all");
  elements.filterCount.hidden = count === 0;
  elements.filterCount.textContent = count;
  elements.clearFilters.hidden = count === 0;
}

function renderEvidence() {
  const matches = filteredEvidence();
  const visible = matches.slice(0, state.limit);

  elements.evidenceGrid.innerHTML = visible.map(evidenceCard).join("");
  elements.resultCount.textContent = `${matches.length} result${matches.length === 1 ? "" : "s"} in the evidence bank`;
  elements.loadMore.hidden = matches.length <= state.limit;
  elements.loadMore.textContent = `Load ${Math.min(12, matches.length - state.limit)} more`;
  elements.emptyState.hidden = matches.length !== 0;
  elements.evidenceGrid.hidden = matches.length === 0;
  updateFilterState();

  elements.evidenceGrid.querySelectorAll(".evidence-card").forEach((card) => {
    const activate = () => openEvidence(card.dataset.id);
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });
}

function openEvidence(id) {
  const item = state.data.achievements.find((entry) => entry.id === id);
  if (!item) return;
  const theme = state.data.themes.find((entry) => entry.id === item.theme);
  const sources = item.sources.map(sourceLink).filter(Boolean).join("");

  elements.modalContent.innerHTML = `
    <p class="modal-eyebrow">Evidence item #${String(item.rank).padStart(2, "0")} · ${escapeHtml(theme?.title || item.sector)}</p>
    <h2>${escapeHtml(item.title)}</h2>
    ${item.figure ? `<p class="modal-figure">${escapeHtml(item.figure)}</p>` : ""}
    <p class="modal-description">${escapeHtml(item.description)}</p>
    <div class="modal-meta">
      <div><span>Status</span><strong>${escapeHtml(item.status)}</strong></div>
      <div><span>Location</span><strong>${escapeHtml(item.location)}</strong></div>
      <div><span>Date</span><strong>${escapeHtml(item.date)}</strong></div>
      <div><span>Credited to</span><strong>${escapeHtml(item.creditedTo)}</strong></div>
    </div>
    <div class="source-list">
      <h3>Sources (${item.sources.length})</h3>
      ${sources || "<p>No source link was included for this item.</p>"}
    </div>`;

  elements.modal.showModal();
  document.body.classList.add("modal-open");
}

function closeEvidence() {
  elements.modal.close();
  document.body.classList.remove("modal-open");
}

function renderQuote() {
  const item = state.data.quotes[state.quoteIndex];
  if (!item) return;
  const firstSource = item.sources[0];
  elements.quoteCurrent.textContent = String(state.quoteIndex + 1).padStart(2, "0");
  elements.quoteTotal.textContent = String(state.data.quotes.length).padStart(2, "0");
  elements.quoteStage.innerHTML = `
    <article class="quote-item">
      <div class="quote-mark" aria-hidden="true">“</div>
      <div class="quote-content">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </div>
      <aside class="quote-aside">
        <div><span>On record</span><p>${escapeHtml(item.creditedTo)}</p></div>
        <div><span>Place & date</span><p>${escapeHtml(item.location)} · ${escapeHtml(item.date)}</p></div>
        ${firstSource ? sourceLink(firstSource) : ""}
      </aside>
    </article>`;
}

function shiftQuote(direction) {
  state.quoteIndex = (state.quoteIndex + direction + state.data.quotes.length) % state.data.quotes.length;
  renderQuote();
}

function clearFilters() {
  state.query = "";
  state.theme = "all";
  state.status = "all";
  state.limit = 12;
  elements.search.value = "";
  renderFilters();
  renderEvidence();
}

function setupNavigation() {
  elements.menuToggle.addEventListener("click", () => {
    const open = elements.menuToggle.getAttribute("aria-expanded") === "true";
    elements.menuToggle.setAttribute("aria-expanded", String(!open));
    elements.mobileNav.classList.toggle("open", !open);
    document.body.classList.toggle("menu-open", !open);
  });

  elements.mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      elements.menuToggle.setAttribute("aria-expanded", "false");
      elements.mobileNav.classList.remove("open");
      document.body.classList.remove("menu-open");
    });
  });

  window.addEventListener("scroll", () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    elements.pageProgress.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  }, { passive: true });
}

function setupInteractions() {
  let searchTimer;
  elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = elements.search.value;
      state.limit = 12;
      renderEvidence();
    }, 90);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.search.focus();
      document.querySelector("#record").scrollIntoView({ behavior: "smooth" });
    }
  });

  elements.filterToggle.addEventListener("click", () => {
    const open = elements.filterToggle.getAttribute("aria-expanded") === "true";
    elements.filterToggle.setAttribute("aria-expanded", String(!open));
    elements.filterToggle.querySelector("span:last-child").textContent = open ? "＋" : "−";
    elements.filtersPanel.classList.toggle("open", !open);
  });

  elements.clearFilters.addEventListener("click", clearFilters);
  elements.loadMore.addEventListener("click", () => {
    state.limit += 12;
    renderEvidence();
  });
  document.querySelector("#quote-prev").addEventListener("click", () => shiftQuote(-1));
  document.querySelector("#quote-next").addEventListener("click", () => shiftQuote(1));
  document.querySelector(".modal-close").addEventListener("click", closeEvidence);
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) closeEvidence();
  });
  elements.modal.addEventListener("close", () => document.body.classList.remove("modal-open"));

  document.querySelectorAll(".v2-state-grid .state").forEach((button) => {
    button.addEventListener("click", () => {
      state.query = button.dataset.state || "";
      elements.search.value = state.query;
      state.limit = 12;
      renderEvidence();
      document.querySelector("#record")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll(".section-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      const expanded = target.classList.toggle("is-expanded");
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = expanded
        ? (target.id === "people-directory" ? "Show fewer appointees" : "Show fewer categories")
        : (target.id === "people-directory" ? "View full directory" : "Show all categories");
    });
  });

  const submissionForm = document.querySelector("#submission-form");
  const formMessage = document.querySelector("#form-message");
  submissionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const item = Object.fromEntries(new FormData(submissionForm).entries());
    item.submittedAt = new Date().toISOString();
    item.reviewStatus = "Pending editorial verification";
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "SEPAF_evidence_submission.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (formMessage) formMessage.textContent = "Submission file prepared for the SEPAF editorial team.";
  });
}

function setupReveals() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".reveal, .motion-reveal").forEach((element) => element.classList.add("revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  document.querySelectorAll(".reveal, .motion-reveal").forEach((element) => observer.observe(element));
}

function setupStatCounters() {
  const figures = [...document.querySelectorAll(".hero-stat strong")];
  if (!figures.length) return;

  const format = (value) => Math.round(value).toLocaleString("en-NG");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const animate = (figure) => {
    const target = Number(figure.textContent.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(target) || reducedMotion) {
      figure.textContent = format(target);
      return;
    }

    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      figure.textContent = format(target * eased);
      if (progress < 1) window.requestAnimationFrame(tick);
    };

    figure.textContent = "0";
    window.requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animate(entry.target);
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.35 });

  figures.forEach((figure) => observer.observe(figure));
}

async function initialize() {
  try {
    const response = await fetch("data/evidence.json");
    if (!response.ok) throw new Error(`Could not load evidence (${response.status})`);
    state.data = await response.json();

    renderSummary();
    renderMetrics();
    renderStatusLegend();
    renderFilters();
    renderEvidence();
    renderQuote();
    elements.methodText.textContent = state.data.meta.methodology;
    setupNavigation();
    setupInteractions();
    setupReveals();
    setupStatCounters();
  } catch (error) {
    console.error(error);
    elements.evidenceGrid.innerHTML = `<div class="empty-state"><strong>The evidence could not be loaded.</strong><p>Run the site through <code>npm run dev</code> and refresh this page.</p></div>`;
  }
}

initialize();
