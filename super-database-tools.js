(() => {
  const DB_SELECTOR = ".notion-collection-table";
  const READY_KEY = "superDbToolsReady";

  const tableState = new WeakMap();

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

  function initAllTables() {
    injectHighlightStyles();
    document.querySelectorAll(DB_SELECTOR).forEach(initTable);
  }

  function initTable(table) {
    if (table.dataset[READY_KEY] === "true") return;

    const rows = getRows(table);
    if (!rows.length) return;

    table.dataset[READY_KEY] = "true";

    setOriginalIndexes(rows);

    const headers = getHeaders(table, rows[0]);
    const toolbar = createToolbar(headers);

    table.parentNode.insertBefore(toolbar, table);

    const state = {
      search: "",
      filterColumn: "all",
      filterText: "",
      sortColumn: "none",
      sortDirection: "asc",
      headers,
      toolbar
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

  function createToolbar(headers) {
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

        <button type="button" class="super-db-tools__icon" data-super-db-panel="filter" aria-label="Filter">
          ${icons.filter}
        </button>

        <button type="button" class="super-db-tools__icon" data-super-db-panel="sort" aria-label="Sort">
          ${icons.sort}
        </button>

        <button type="button" class="super-db-tools__icon" data-super-db-panel="search" aria-label="Search">
          ${icons.search}
        </button>

        <button type="button" class="super-db-tools__clear" data-super-db-clear>
          Clear
        </button>
      </div>

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

      <div class="super-db-tools__panel" data-super-db-panel-content="search" hidden>
        <label>
          Search table
          <input type="search" data-super-db-search placeholder="Search rows or type empty">
        </label>
      </div>
    `;

    return toolbar;
  }

  function updateTable(table) {
    const state = tableState.get(table);
    if (!state) return;

    const rows = getRows(table);
    if (!rows.length) return;

    rows.forEach(clearSearchHighlights);

    setOriginalIndexes(rows);
    sortRows(rows, state);

    let visibleCount = 0;

    rows.forEach(row => {
      const rowText = getText(row).toLowerCase();

      const matchesSearch = matchesSmartSearch(row, state.search);

      let matchesFilter = true;

      if (state.filterText) {
        if (state.filterColumn === "all") {
          matchesFilter = isEmptyKeyword(state.filterText)
            ? rowHasEmptyCell(row)
            : rowText.includes(state.filterText);
        } else {
          const cellText = getCellText(row, Number(state.filterColumn));
          matchesFilter = matchesSmartFilter(cellText, state.filterText);
        }
      }

      const shouldShow = matchesSearch && matchesFilter;

      row.classList.toggle("super-db-row-hidden", !shouldShow);

      if (shouldShow) {
        visibleCount += 1;
        highlightSearchMatches(row, state.search);
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

  function highlightSearchMatches(row, searchValue) {
    const searchText = cleanText(searchValue);

    if (!searchText || isEmptyKeyword(searchText)) {
      return;
    }

    const exactNumberOnly = isNumberSearch(searchText);

    getCells(row).forEach(cell => {
      highlightTextInsideElement(cell, searchText, exactNumberOnly);
    });
  }

  function clearSearchHighlights(row) {
    row.querySelectorAll("mark.super-db-tools__highlight").forEach(mark => {
      const parent = mark.parentNode;

      if (!parent) return;

      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  function highlightTextInsideElement(element, searchText, exactNumberOnly) {
    if (!element) return;

    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent) return NodeFilter.FILTER_REJECT;

          if (
            parent.closest("mark.super-db-tools__highlight") ||
            parent.closest("script, style, textarea, input, select, svg")
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return cleanText(node.nodeValue)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;

    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      highlightTextNode(textNode, searchText, exactNumberOnly);
    });
  }

  function highlightTextNode(textNode, searchText, exactNumberOnly) {
    const text = textNode.nodeValue;
    const ranges = getHighlightRanges(text, searchText, exactNumberOnly);

    if (!ranges.length) return;

    const fragment = document.createDocumentFragment();
    let currentIndex = 0;

    ranges.forEach(range => {
      if (range.start > currentIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(currentIndex, range.start))
        );
      }

      const mark = document.createElement("mark");
      mark.className = "super-db-tools__highlight";
      mark.textContent = text.slice(range.start, range.end);

      fragment.appendChild(mark);

      currentIndex = range.end;
    });

    if (currentIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(currentIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function getHighlightRanges(text, searchText, exactNumberOnly) {
    const ranges = [];
    const escapedSearchText = escapeRegExp(searchText);

    const pattern = exactNumberOnly
      ? new RegExp(`(^|[^0-9])(${escapedSearchText})(?=[^0-9]|$)`, "gi")
      : new RegExp(escapedSearchText, "gi");

    let match;

    while ((match = pattern.exec(text)) !== null) {
      const prefixLength = exactNumberOnly ? match[1].length : 0;
      const matchedValue = exactNumberOnly ? match[2] : match[0];

      const start = match.index + prefixLength;
      const end = start + matchedValue.length;

      ranges.push({ start, end });

      if (match.index === pattern.lastIndex) {
        pattern.lastIndex += 1;
      }
    }

    return ranges;
  }

  function matchesSmartSearch(row, searchValue) {
    const searchText = cleanText(searchValue).toLowerCase();

    if (!searchText) {
      return true;
    }

    if (isEmptyKeyword(searchText)) {
      return rowHasEmptyCell(row);
    }

    if (isNumberSearch(searchText)) {
      return getCells(row).some(cell => {
        return matchesExactNumber(getText(cell), searchText);
      });
    }

    return getText(row).toLowerCase().includes(searchText);
  }

  function matchesExactNumber(cellValue, searchValue) {
    const cellText = cleanText(cellValue);
    const searchNumber = parseNumber(searchValue);
    const cellNumber = parseNumber(cellText);

    if (searchNumber === null) {
      return false;
    }

    if (cellNumber !== null) {
      return cellNumber === searchNumber;
    }

    const normalizedCellText = cellText.replace(/,/g, "");
    const normalizedSearchValue = searchValue.replace(/,/g, "");
    const escapedSearchValue = escapeRegExp(normalizedSearchValue);

    const exactNumberPattern = new RegExp(`(^|[^0-9])${escapedSearchValue}([^0-9]|$)`);

    return exactNumberPattern.test(normalizedCellText);
  }

  function isNumberSearch(value) {
    return parseNumber(value) !== null;
  }

  function matchesSmartFilter(cellValue, filterValue) {
    const cellText = cleanText(cellValue);
    const filterText = cleanText(filterValue);

    if (isEmptyKeyword(filterText)) {
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

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function injectHighlightStyles() {
    if (document.getElementById("super-db-tools-highlight-style")) return;

    const style = document.createElement("style");
    style.id = "super-db-tools-highlight-style";
    style.textContent = `
      .super-db-tools__highlight {
        border-radius: 3px;
        padding: 0 2px;
        background: color-mix(in srgb, currentColor 18%, transparent);
        color: inherit;
      }
    `;

    document.head.appendChild(style);
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

  initAllTables();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(initAllTables);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();

