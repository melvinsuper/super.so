(() => {
  const DEFAULTS = {
    selector: ".notion-collection-table",
    search: true,
    filter: true,
    sort: true,
    emptySearch: true,
    theme: {}
  };

  const READY_KEY = "superDbToolsReady";
  const tableState = new WeakMap();
  const observerSettings = [];

  let observer = null;
  let hasManualInit = false;

  const icons = {
    filter: `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `,
    sort: `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    search: `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="m20 20-4.2-4.2M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `
  };

  const themeDefaults = {
    toolsAlign: "flex-end",
    toolsGap: "8px",
    toolsMargin: "0 0 12px 0",

    barGap: "6px",
    barMinHeight: "36px",
    barPadding: "0",
    barBackground: "transparent",
    barBorderColor: "transparent",
    barRadius: "0",
    barShadow: "none",

    countColor: "rgba(55, 53, 47, 0.56)",
    countFontSize: "13px",

    buttonBackground: "transparent",
    buttonColor: "rgba(55, 53, 47, 0.58)",
    buttonBorderColor: "transparent",
    buttonRadius: "8px",
    buttonHeight: "32px",
    buttonHoverBackground: "rgba(55, 53, 47, 0.08)",
    buttonHoverColor: "rgba(55, 53, 47, 0.88)",
    buttonHoverBorderColor: "rgba(55, 53, 47, 0.08)",
    activeBackground: "rgba(55, 53, 47, 0.08)",
    activeColor: "rgba(55, 53, 47, 0.88)",
    activeBorderColor: "rgba(55, 53, 47, 0.08)",
    activeShadow: "0 0 0 2px rgba(55, 53, 47, 0.05)",

    panelWidth: "520px",
    panelGap: "10px",
    panelPadding: "12px",
    panelBackground: "rgba(255, 255, 255, 0.96)",
    panelBorderColor: "rgba(55, 53, 47, 0.12)",
    panelRadius: "12px",
    panelShadow: "0 12px 32px rgba(15, 15, 15, 0.08)",

    labelColor: "rgba(55, 53, 47, 0.72)",
    labelFontSize: "12px",
    labelFontWeight: "600",

    inputBackground: "#ffffff",
    inputColor: "rgba(55, 53, 47, 0.9)",
    inputBorderColor: "rgba(55, 53, 47, 0.16)",
    inputRadius: "8px",
    inputHeight: "36px",
    inputFontSize: "14px",
    focusBorderColor: "rgba(35, 131, 226, 0.52)",
    focusShadow: "0 0 0 3px rgba(35, 131, 226, 0.12)"
  };

  function init(options = {}) {
    hasManualInit = true;
    runInit(options);
  }

  function runInit(options = {}) {
    const settings = normalizeSettings(options);

    const start = () => {
      applyTheme(settings.theme);
      initAllTables(settings);
      observeTables(settings);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
      return;
    }

    start();
  }

  function normalizeSettings(options) {
    return {
      ...DEFAULTS,
      ...options,
      theme: {
        ...themeDefaults,
        ...(options.theme || {})
      }
    };
  }

  function initAllTables(settings) {
    document.querySelectorAll(settings.selector).forEach(table => initTable(table, settings));
  }

  function initTable(table, settings) {
    if (table.dataset[READY_KEY] === "true") return;

    const rows = getRows(table);
    if (!rows.length) return;

    table.dataset[READY_KEY] = "true";

    setOriginalIndexes(rows);

    const headers = getHeaders(table, rows[0]);
    const toolbar = createToolbar(headers, settings);

    table.parentNode.insertBefore(toolbar, table);

    const state = {
      search: "",
      filterColumn: "all",
      filterText: "",
      sortColumn: "none",
      sortDirection: "asc",
      headers,
      toolbar,
      settings
    };

    tableState.set(table, state);

    toolbar.addEventListener("input", event => {
      const target = event.target;

      if (target.matches("[data-super-db-search]")) {
        state.search = target.value.trim().toLowerCase();
      }

      if (target.matches("[data-super-db-filter-text]")) {
        state.filterText = target.value.trim().toLowerCase();
      }

      updateTable(table);
    });

    toolbar.addEventListener("change", event => {
      const target = event.target;

      if (target.matches("[data-super-db-filter-column]")) {
        state.filterColumn = target.value;
      }

      if (target.matches("[data-super-db-sort-column]")) {
        state.sortColumn = target.value;
      }

      updateTable(table);
    });

    toolbar.addEventListener("click", event => {
      const panelButton = event.target.closest("[data-super-db-panel]");
      const directionButton = event.target.closest("[data-super-db-sort-direction]");
      const clearButton = event.target.closest("[data-super-db-clear]");

      if (panelButton) {
        togglePanel(toolbar, panelButton.dataset.superDbPanel);
        return;
      }

      if (directionButton) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        directionButton.textContent = state.sortDirection === "asc" ? "Ascending" : "Descending";
        updateTable(table);
        return;
      }

      if (clearButton) {
        resetToolbar(table);
      }
    });

    updateTable(table);
  }

  function createToolbar(headers, settings) {
    const filterOptions = `
      <option value="all">All columns</option>
      ${headers.map(header => `<option value="${header.index}">${escapeHTML(header.label)}</option>`).join("")}
    `;

    const sortOptions = `
      <option value="none">Original order</option>
      ${headers.map(header => `<option value="${header.index}">${escapeHTML(header.label)}</option>`).join("")}
    `;

    const toolbar = document.createElement("div");
    toolbar.className = "super-db-tools";

    toolbar.innerHTML = `
      <div class="super-db-tools__bar">
        <span class="super-db-tools__count" data-super-db-count></span>

        ${settings.filter ? `
          <button type="button" class="super-db-tools__icon" data-super-db-panel="filter" aria-label="Filter">
            ${icons.filter}
          </button>
        ` : ""}

        ${settings.sort ? `
          <button type="button" class="super-db-tools__icon" data-super-db-panel="sort" aria-label="Sort">
            ${icons.sort}
          </button>
        ` : ""}

        ${settings.search ? `
          <button type="button" class="super-db-tools__icon" data-super-db-panel="search" aria-label="Search">
            ${icons.search}
          </button>
        ` : ""}

        <button type="button" class="super-db-tools__clear" data-super-db-clear>
          Clear
        </button>
      </div>

      ${settings.filter ? `
        <div class="super-db-tools__panel" data-super-db-panel-content="filter" hidden>
          <label>
            Filter column
            <select data-super-db-filter-column>
              ${filterOptions}
            </select>
          </label>

          <label>
            Contains
            <input type="text" data-super-db-filter-text placeholder="Type filter text or empty">
          </label>
        </div>
      ` : ""}

      ${settings.sort ? `
        <div class="super-db-tools__panel" data-super-db-panel-content="sort" hidden>
          <label>
            Sort by
            <select data-super-db-sort-column>
              ${sortOptions}
            </select>
          </label>

          <button type="button" class="super-db-tools__direction" data-super-db-sort-direction>
            Ascending
          </button>
        </div>
      ` : ""}

      ${settings.search ? `
        <div class="super-db-tools__panel" data-super-db-panel-content="search" hidden>
          <label>
            Search table
            <input type="search" data-super-db-search placeholder="Search rows or type empty">
          </label>
        </div>
      ` : ""}
    `;

    return toolbar;
  }

  function updateTable(table) {
    const state = tableState.get(table);
    if (!state) return;

    const rows = getRows(table);
    if (!rows.length) return;

    setOriginalIndexes(rows);
    sortRows(rows, state);

    let visibleCount = 0;

    rows.forEach(row => {
      const rowText = getText(row).toLowerCase();

      const matchesSearch =
        !state.search ||
        (
          state.settings.emptySearch && isEmptyKeyword(state.search)
            ? rowHasEmptyCell(row)
            : rowText.includes(state.search)
        );

      let matchesFilter = true;

      if (state.filterText) {
        if (state.filterColumn === "all") {
          matchesFilter = state.settings.emptySearch && isEmptyKeyword(state.filterText)
            ? rowHasEmptyCell(row)
            : rowText.includes(state.filterText);
        } else {
          const cellText = getCellText(row, Number(state.filterColumn));
          matchesFilter = matchesSmartFilter(cellText, state.filterText, state.settings);
        }
      }

      const shouldShow = matchesSearch && matchesFilter;

      row.classList.toggle("super-db-row-hidden", !shouldShow);

      if (shouldShow) {
        visibleCount += 1;
      }
    });

    const countEl = state.toolbar.querySelector("[data-super-db-count]");

    if (countEl) {
      countEl.textContent = `${visibleCount} shown`;
    }
  }

  function sortRows(rows, state) {
    const parent = rows[0]?.parentElement;
    if (!parent) return;

    const sortedRows = [...rows].sort((a, b) => {
      if (state.sortColumn === "none") {
        return Number(a.dataset.superOriginalIndex) - Number(b.dataset.superOriginalIndex);
      }

      const columnIndex = Number(state.sortColumn);
      const aValue = getCellText(a, columnIndex);
      const bValue = getCellText(b, columnIndex);

      const result = compareValues(aValue, bValue);

      return state.sortDirection === "asc" ? result : -result;
    });

    const insertBeforeNode = getInsertBeforeNode(parent, rows);

    sortedRows.forEach(row => {
      parent.insertBefore(row, insertBeforeNode || null);
    });
  }

  function resetToolbar(table) {
    const state = tableState.get(table);
    if (!state) return;

    state.search = "";
    state.filterColumn = "all";
    state.filterText = "";
    state.sortColumn = "none";
    state.sortDirection = "asc";

    state.toolbar.querySelectorAll("input").forEach(input => {
      input.value = "";
    });

    const filterColumn = state.toolbar.querySelector("[data-super-db-filter-column]");
    const sortColumn = state.toolbar.querySelector("[data-super-db-sort-column]");
    const sortDirection = state.toolbar.querySelector("[data-super-db-sort-direction]");

    if (filterColumn) filterColumn.value = "all";
    if (sortColumn) sortColumn.value = "none";
    if (sortDirection) sortDirection.textContent = "Ascending";

    state.toolbar.querySelectorAll("[data-super-db-panel-content]").forEach(panel => {
      panel.hidden = true;
    });

    state.toolbar.querySelectorAll("[data-super-db-panel]").forEach(button => {
      button.classList.remove("is-active");
    });

    updateTable(table);
  }

  function togglePanel(toolbar, panelName) {
    const selectedPanel = toolbar.querySelector(`[data-super-db-panel-content="${panelName}"]`);
    const selectedButton = toolbar.querySelector(`[data-super-db-panel="${panelName}"]`);

    if (!selectedPanel || !selectedButton) return;

    const alreadyOpen = !selectedPanel.hidden;

    toolbar.querySelectorAll("[data-super-db-panel-content]").forEach(panel => {
      panel.hidden = true;
    });

    toolbar.querySelectorAll("[data-super-db-panel]").forEach(button => {
      button.classList.remove("is-active");
    });

    if (!alreadyOpen) {
      selectedPanel.hidden = false;
      selectedButton.classList.add("is-active");

      const firstInput = selectedPanel.querySelector("input, select");
      if (firstInput) firstInput.focus();
    }
  }

  function getRows(table) {
    const selectors = [
      "tbody tr",
      ".notion-collection-table__body .notion-collection-table__row",
      ".notion-collection-table__row",
      "[role='row']"
    ];

    for (const selector of selectors) {
      const rows = unique(
        [...table.querySelectorAll(selector)].filter(row => isUsableRow(row))
      );

      if (rows.length) return rows;
    }

    return [];
  }

  function isUsableRow(row) {
    if (!row || row.closest(".super-db-tools")) return false;

    if (
      row.matches("thead tr") ||
      row.matches(".notion-collection-table__head") ||
      row.matches(".notion-collection-table__header") ||
      row.matches(".notion-collection-table__row--header") ||
      row.matches(".notion-collection-table__row--add")
    ) {
      return false;
    }

    if (row.querySelector("th, [role='columnheader']")) return false;

    const text = getText(row).toLowerCase();

    if (
      text === "new" ||
      text === "+ new" ||
      text === "new page" ||
      text === "+ new page"
    ) {
      return false;
    }

    return getCells(row).length > 0;
  }

  function getHeaders(table, firstRow) {
    const selectors = [
      "thead th",
      ".notion-collection-table__head-cell",
      ".notion-collection-table__header-cell",
      "[role='columnheader']"
    ];

    for (const selector of selectors) {
      const headerNodes = [...table.querySelectorAll(selector)];

      if (headerNodes.length) {
        return headerNodes.map((node, index) => ({
          index,
          label: cleanHeader(getText(node)) || `Column ${index + 1}`
        }));
      }
    }

    return getCells(firstRow).map((cell, index) => ({
      index,
      label: `Column ${index + 1}`
    }));
  }

  function getCells(row) {
    const cells = [
      ...row.querySelectorAll(
        "td, .notion-collection-table__cell, [role='cell'], [class*='collection-table__cell']"
      )
    ];

    if (cells.length) return unique(cells);

    return [...row.children];
  }

  function getCellText(row, index) {
    const cells = getCells(row);

    return getText(cells[index] || row);
  }

  function matchesSmartFilter(cellValue, filterValue, settings) {
    const cellText = cleanText(cellValue);
    const filterText = cleanText(filterValue);

    if (settings.emptySearch && isEmptyKeyword(filterText)) {
      return cellText === "";
    }

    const cellNumber = parseNumber(cellText);
    const filterNumber = parseNumber(filterText);

    if (cellNumber !== null && filterNumber !== null) {
      return cellNumber === filterNumber;
    }

    const numericComparison = filterText.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);

    if (cellNumber !== null && numericComparison) {
      const operator = numericComparison[1];
      const targetNumber = Number(numericComparison[2]);

      if (operator === ">") return cellNumber > targetNumber;
      if (operator === "<") return cellNumber < targetNumber;
      if (operator === ">=") return cellNumber >= targetNumber;
      if (operator === "<=") return cellNumber <= targetNumber;
      if (operator === "=") return cellNumber === targetNumber;
    }

    return cellText.toLowerCase().includes(filterText.toLowerCase());
  }

  function compareValues(a, b) {
    const aClean = cleanText(a);
    const bClean = cleanText(b);

    const aNumber = parseNumber(aClean);
    const bNumber = parseNumber(bClean);

    if (aNumber !== null && bNumber !== null) {
      return aNumber - bNumber;
    }

    const aDate = Date.parse(aClean);
    const bDate = Date.parse(bClean);

    if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
      return aDate - bDate;
    }

    return aClean.localeCompare(bClean, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function parseNumber(value) {
    const cleaned = cleanText(value)
      .replace(/[$,%]/g, "")
      .replace(/,/g, "");

    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
      return null;
    }

    return Number(cleaned);
  }

  function rowHasEmptyCell(row) {
    return getCells(row).some(cell => getText(cell) === "");
  }

  function isEmptyKeyword(value) {
    const text = cleanText(value).toLowerCase();

    return (
      text === "empty" ||
      text === "blank" ||
      text === "is:empty" ||
      text === "is:blank"
    );
  }

  function getInsertBeforeNode(parent, rows) {
    const rowSet = new Set(rows);

    return [...parent.children].find(child => {
      if (rowSet.has(child)) return false;

      const text = getText(child).toLowerCase();

      return (
        child.matches(".notion-collection-table__row--add") ||
        text === "new page" ||
        text === "+ new page"
      );
    });
  }

  function setOriginalIndexes(rows) {
    rows.forEach((row, index) => {
      if (!row.dataset.superOriginalIndex) {
        row.dataset.superOriginalIndex = String(index);
      }
    });
  }

  function applyTheme(theme = {}) {
    const styles = {
      ...themeDefaults,
      ...theme
    };

    const styleId = "super-db-tools-theme";
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    const value = key => cleanCSSValue(styles[key]);

    style.textContent = `
      .super-db-tools {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: ${value("toolsAlign")};
        gap: ${value("toolsGap")};
        margin: ${value("toolsMargin")};
        position: relative;
        z-index: 5;
      }

      .super-db-tools__bar {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: ${value("barGap")};
        min-height: ${value("barMinHeight")};
        padding: ${value("barPadding")};
        background: ${value("barBackground")};
        border: 1px solid ${value("barBorderColor")};
        border-radius: ${value("barRadius")};
        box-shadow: ${value("barShadow")};
      }

      .super-db-tools__count {
        font-size: ${value("countFontSize")};
        line-height: 1;
        color: ${value("countColor")};
        margin-right: 4px;
        white-space: nowrap;
      }

      .super-db-tools__icon,
      .super-db-tools__clear,
      .super-db-tools__direction {
        appearance: none;
        border: 1px solid ${value("buttonBorderColor")};
        background: ${value("buttonBackground")};
        color: ${value("buttonColor")};
        border-radius: ${value("buttonRadius")};
        height: ${value("buttonHeight")};
        cursor: pointer;
        transition:
          background-color 160ms ease,
          color 160ms ease,
          border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .super-db-tools__icon {
        width: ${value("buttonHeight")};
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .super-db-tools__clear,
      .super-db-tools__direction {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
        font-size: 13px;
        font-weight: 500;
      }

      .super-db-tools__icon:hover,
      .super-db-tools__clear:hover,
      .super-db-tools__direction:hover {
        background: ${value("buttonHoverBackground")};
        color: ${value("buttonHoverColor")};
        border-color: ${value("buttonHoverBorderColor")};
      }

      .super-db-tools__icon.is-active {
        background: ${value("activeBackground")};
        color: ${value("activeColor")};
        border-color: ${value("activeBorderColor")};
        box-shadow: ${value("activeShadow")};
      }

      .super-db-tools__panel {
        width: min(${value("panelWidth")}, 100%);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: ${value("panelGap")};
        padding: ${value("panelPadding")};
        background: ${value("panelBackground")};
        border: 1px solid ${value("panelBorderColor")};
        border-radius: ${value("panelRadius")};
        box-shadow: ${value("panelShadow")};
      }

      .super-db-tools__panel[hidden] {
        display: none !important;
      }

      .super-db-tools__panel label {
        display: grid;
        gap: 6px;
        font-size: ${value("labelFontSize")};
        font-weight: ${value("labelFontWeight")};
        color: ${value("labelColor")};
      }

      .super-db-tools__panel input,
      .super-db-tools__panel select {
        width: 100%;
        height: ${value("inputHeight")};
        border: 1px solid ${value("inputBorderColor")};
        border-radius: ${value("inputRadius")};
        background: ${value("inputBackground")};
        color: ${value("inputColor")};
        font-size: ${value("inputFontSize")};
        outline: none;
        padding: 0 10px;
      }

      .super-db-tools__panel input:focus,
      .super-db-tools__panel select:focus {
        border-color: ${value("focusBorderColor")};
        box-shadow: ${value("focusShadow")};
      }

      .super-db-row-hidden {
        display: none !important;
      }

      @media (max-width: 640px) {
        .super-db-tools {
          align-items: stretch;
        }

        .super-db-tools__bar {
          justify-content: flex-start;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .super-db-tools__panel {
          grid-template-columns: 1fr;
        }

        .super-db-tools__count {
          margin-right: auto;
        }
      }
    `;
  }

  function observeTables(settings) {
    observerSettings.push(settings);

    if (observer) return;

    observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        observerSettings.forEach(initAllTables);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function getText(element) {
    return cleanText(element?.innerText || element?.textContent || "");
  }

  function cleanText(text) {
    return String(text).replace(/\s+/g, " ").trim();
  }

  function cleanHeader(text) {
    return cleanText(text)
      .replace(/^Aa\s+/i, "")
      .replace(/^#\s*/, "")
      .replace(/^@\s*/, "");
  }

  function unique(items) {
    return [...new Set(items)];
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cleanCSSValue(value) {
    return String(value ?? "")
      .replace(/<\/?style[^>]*>/gi, "")
      .replace(/[{};]/g, "")
      .trim();
  }

  if (!window.superDbToolsOutsideClickReady) {
    window.superDbToolsOutsideClickReady = true;

    document.addEventListener("click", event => {
      if (event.target.closest(".super-db-tools")) return;

      document.querySelectorAll(".super-db-tools").forEach(toolbar => {
        toolbar.querySelectorAll("[data-super-db-panel-content]").forEach(panel => {
          panel.hidden = true;
        });

        toolbar.querySelectorAll("[data-super-db-panel]").forEach(button => {
          button.classList.remove("is-active");
        });
      });
    });
  }

  window.SuperDatabaseTools = {
    init,
    applyTheme
  };

  const autoStart = () => {
    if (hasManualInit || window.SuperDatabaseToolsAutoInit === false) return;

    runInit(window.SuperDatabaseToolsConfig || {});
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoStart, { once: true });
  } else {
    window.setTimeout(autoStart, 0);
  }
})();
