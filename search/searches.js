(function () {
  "use strict";

  var MAX_PAGES_TO_INDEX = 150;
  var MIN_SEARCH_CHARACTERS = 2;
  var MAX_RESULTS = 8;

  var STYLE_ID = "super-custom-site-search-style";
  var READY_ATTRIBUTE = "data-super-custom-search-ready";

  var STOP_WORDS = {
    a: true,
    an: true,
    the: true,
    and: true,
    or: true,
    of: true,
    in: true,
    on: true,
    to: true,
    for: true,
    from: true,
    with: true,
    by: true,
    at: true,
    is: true,
    are: true,
    was: true,
    were: true,
    this: true,
    that: true,
    it: true,
    its: true,
    de: true,
    la: true,
    le: true,
    les: true,
    du: true,
    des: true,
    del: true,
    el: true,
    en: true
  };

  window.SuperCustomSiteSearchState = window.SuperCustomSiteSearchState || {
    indexStarted: false,
    indexFinished: false,
    indexPromise: null,
    searchIndex: []
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .super-custom-site-search {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px 16px;
        box-sizing: border-box;
        position: relative;
        z-index: 20;
      }

      .super-custom-site-search__inner {
        width: min(100%, 430px);
        position: relative;
      }

      .super-custom-site-search__form {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
      }

      .super-custom-site-search__input {
        width: 100%;
        height: 50px;
        padding: 0 15px;
        border: 1.5px solid #153ee8;
        border-radius: 9px;
        background: #ffffff;
        color: #111111;
        font-size: 22px;
        line-height: 1;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
      }

      .super-custom-site-search__input::placeholder {
        color: #686868;
        opacity: 1;
      }

      .super-custom-site-search__input:focus {
        border-color: #153ee8;
        box-shadow: 0 0 0 4px rgba(21, 62, 232, 0.14);
        transform: translateY(-1px);
      }

      .super-custom-site-search__button {
        width: 52px;
        height: 50px;
        flex: 0 0 52px;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        border: 1.5px solid #153ee8;
        border-radius: 9px;
        background: #ffffff;
        color: #111111;
        cursor: pointer;
        padding: 0;
        box-sizing: border-box;
        transform-origin: center center;
        transition: background-color 0.25s ease, box-shadow 0.25s ease;
      }

      .super-custom-site-search__button svg {
        width: 26px;
        height: 26px;
        stroke: currentColor;
        pointer-events: none;
      }

      .super-custom-site-search__button:hover {
        background: #ffffff;
        box-shadow: 0 0 0 4px rgba(21, 62, 232, 0.12);
        animation: super-search-button-spin 1.2s ease-in-out;
      }

      .super-custom-site-search__button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 4px rgba(21, 62, 232, 0.18);
        animation: super-search-button-spin 1.2s ease-in-out;
      }

      @keyframes super-search-button-spin {
        0% {
          transform: rotate(0deg) scale(1);
        }

        50% {
          transform: rotate(180deg) scale(1.04);
        }

        100% {
          transform: rotate(360deg) scale(1);
        }
      }

      .super-custom-site-search__results {
        display: none;
        position: absolute;
        top: calc(100% + 10px);
        left: 0;
        right: 0;
        max-height: 420px;
        overflow-y: auto;
        background: #ffffff;
        border: 1px solid rgba(21, 62, 232, 0.22);
        border-radius: 12px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
        box-sizing: border-box;
        padding: 8px;
        z-index: 9999;
      }

      .super-custom-site-search__results.is-visible {
        display: block;
      }

      .super-custom-site-search__status {
        padding: 12px 13px;
        color: #555555;
        font-size: 14px;
        line-height: 1.45;
      }

      .super-custom-site-search__item {
        display: block;
        padding: 12px 13px;
        border-radius: 9px;
        text-decoration: none;
        color: #111111;
        transition: background-color 0.2s ease, transform 0.2s ease;
      }

      .super-custom-site-search__item:hover,
      .super-custom-site-search__item:focus {
        background: rgba(21, 62, 232, 0.07);
        transform: translateY(-1px);
        outline: none;
      }

      .super-custom-site-search__title {
        display: block;
        font-size: 15px;
        font-weight: 650;
        line-height: 1.35;
        color: #111111;
        margin-bottom: 4px;
      }

      .super-custom-site-search__url {
        display: block;
        font-size: 12px;
        line-height: 1.35;
        color: #153ee8;
        margin-bottom: 5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .super-custom-site-search__snippet {
        display: block;
        font-size: 13px;
        line-height: 1.45;
        color: #555555;
      }

      .super-custom-site-search__snippet mark,
      .super-custom-site-search__title mark {
        background: rgba(255, 216, 77, 0.72);
        color: inherit;
        padding: 0 2px;
        border-radius: 3px;
      }

      @media (max-width: 600px) {
        .super-custom-site-search {
          padding: 18px 12px;
        }

        .super-custom-site-search__inner {
          width: 100%;
          max-width: 100%;
        }

        .super-custom-site-search__input {
          height: 46px;
          font-size: 17px;
          padding: 0 13px;
        }

        .super-custom-site-search__button {
          width: 48px;
          height: 46px;
          flex-basis: 48px;
        }

        .super-custom-site-search__button svg {
          width: 23px;
          height: 23px;
        }

        .super-custom-site-search__results {
          max-height: 360px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .super-custom-site-search__button:hover,
        .super-custom-site-search__button:focus-visible {
          animation: none;
        }

        .super-custom-site-search__input,
        .super-custom-site-search__button,
        .super-custom-site-search__item {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    });
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getQueryParts(query) {
    var normalized = normalizeText(query);
    var words = normalized.split(" ").filter(function (word) {
      return word.length >= 2;
    });

    var importantWords = words.filter(function (word) {
      return !STOP_WORDS[word];
    });

    if (!importantWords.length) {
      importantWords = words;
    }

    return {
      normalized: normalized,
      words: words,
      importantWords: importantWords
    };
  }

  function highlightText(text, query) {
    var safeText = escapeHTML(text);
    var queryParts = getQueryParts(query);
    var terms = queryParts.importantWords.slice(0, 5);

    terms.forEach(function (term) {
      if (term.length < 2) return;

      var pattern = new RegExp("(" + escapeRegExp(term) + ")", "gi");
      safeText = safeText.replace(pattern, "<mark>$1</mark>");
    });

    return safeText;
  }

  function getMetaContent(doc, selector) {
    var element = doc.querySelector(selector);
    return element ? element.getAttribute("content") : "";
  }

  function getTextContent(doc, selector) {
    var element = doc.querySelector(selector);
    return element ? element.textContent : "";
  }

  function getReadablePath(url) {
    try {
      var parsed = new URL(url);
      return parsed.pathname === "/" ? parsed.hostname : parsed.pathname;
    } catch (error) {
      return url;
    }
  }

  function removeNonContentNodes(container) {
    if (!container) return;

    var selectorsToRemove = [
      "script",
      "style",
      "noscript",
      "svg",
      "iframe",
      "form",
      "input",
      "button",
      "nav",
      "header",
      "footer",
      ".super-navbar",
      ".super-footer",
      ".super-sidebar",
      ".super-custom-site-search",
      "[data-super-custom-search]",
      ".notion-breadcrumb",
      ".notion-header__breadcrumb",
      ".notion-table-of-contents"
    ];

    container.querySelectorAll(selectorsToRemove.join(",")).forEach(function (node) {
      node.remove();
    });
  }

  function getCleanContentText(doc, contentArea) {
    if (!contentArea) return "";

    var clone = contentArea.cloneNode(true);
    removeNonContentNodes(clone);

    return cleanText(clone.textContent);
  }

  function getSnippet(text, query) {
    var clean = cleanText(text);
    var normalizedClean = normalizeText(clean);
    var queryParts = getQueryParts(query);
    var terms = queryParts.importantWords;
    var firstMatch = -1;

    terms.some(function (term) {
      var foundIndex = normalizedClean.indexOf(term);

      if (foundIndex !== -1) {
        firstMatch = foundIndex;
        return true;
      }

      return false;
    });

    if (firstMatch === -1) {
      return clean.slice(0, 150) + (clean.length > 150 ? "..." : "");
    }

    var start = Math.max(0, firstMatch - 55);
    var end = Math.min(clean.length, firstMatch + 115);
    var prefix = start > 0 ? "..." : "";
    var suffix = end < clean.length ? "..." : "";

    return prefix + clean.slice(start, end) + suffix;
  }

  function makePageData(title, description, bodyText, url) {
    return {
      title: cleanText(title),
      description: cleanText(description),
      body: cleanText(bodyText),
      searchableTitle: normalizeText(title),
      searchableDescription: normalizeText(description),
      searchableBody: normalizeText(bodyText),
      searchableUrl: normalizeText(url),
      url: url
    };
  }

  function extractPageData(html, url) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");

    var title =
      getMetaContent(doc, 'meta[property="og:title"]') ||
      getTextContent(doc, "title") ||
      getTextContent(doc, "h1") ||
      url;

    var description =
      getMetaContent(doc, 'meta[name="description"]') ||
      getMetaContent(doc, 'meta[property="og:description"]') ||
      "";

    var contentArea =
      doc.querySelector("main") ||
      doc.querySelector(".super-content") ||
      doc.querySelector(".notion-page") ||
      doc.querySelector("body");

    var bodyText = getCleanContentText(doc, contentArea);

    return makePageData(title, description, bodyText, url);
  }

  function getCurrentPageData() {
    var title =
      getMetaContent(document, 'meta[property="og:title"]') ||
      getTextContent(document, "title") ||
      getTextContent(document, "h1") ||
      window.location.href;

    var description =
      getMetaContent(document, 'meta[name="description"]') ||
      getMetaContent(document, 'meta[property="og:description"]') ||
      "";

    var contentArea =
      document.querySelector("main") ||
      document.querySelector(".super-content") ||
      document.querySelector(".notion-page") ||
      document.body;

    var bodyText = getCleanContentText(document, contentArea);

    return makePageData(title, description, bodyText, window.location.href);
  }

  function isSuperDashboard() {
    return window.location.hostname === "app.super.so" || window.location.hostname.indexOf("app.super.so") > -1;
  }

  function isAllowedPageUrl(url) {
    try {
      var parsed = new URL(url);

      if (parsed.hostname !== window.location.hostname) return false;
      if (parsed.pathname.indexOf("/api") === 0) return false;
      if (parsed.pathname.indexOf("/_next") === 0) return false;
      if (parsed.pathname.indexOf("/assets") === 0) return false;
      if (parsed.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|pdf|zip|css|js|json|xml)$/i)) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  function uniqueUrls(urls) {
    var seen = {};
    var cleanUrls = [];

    urls.forEach(function (url) {
      try {
        var parsed = new URL(url);
        parsed.hash = "";

        var cleanUrl = parsed.href.replace(/\/$/, "");

        if (!seen[cleanUrl] && isAllowedPageUrl(cleanUrl)) {
          seen[cleanUrl] = true;
          cleanUrls.push(cleanUrl);
        }
      } catch (error) {}
    });

    return cleanUrls;
  }

  async function getSitemapUrls() {
    var sitemapUrl = window.location.origin + "/sitemap.xml";

    var response = await fetch(sitemapUrl, {
      method: "GET",
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error("Sitemap could not be loaded.");
    }

    var xmlText = await response.text();
    var xml = new DOMParser().parseFromString(xmlText, "application/xml");
    var locNodes = Array.prototype.slice.call(xml.querySelectorAll("loc"));

    return uniqueUrls(locNodes.map(function (node) {
      return node.textContent;
    })).slice(0, MAX_PAGES_TO_INDEX);
  }

  async function fetchPage(url) {
    var response = await fetch(url, {
      method: "GET",
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error("Page could not be loaded.");
    }

    var html = await response.text();
    return extractPageData(html, url);
  }

  async function buildSearchIndex() {
    var state = window.SuperCustomSiteSearchState;

    if (state.indexFinished) {
      return state.searchIndex;
    }

    if (state.indexPromise) {
      return state.indexPromise;
    }

    state.indexStarted = true;

    state.indexPromise = (async function () {
      try {
        if (isSuperDashboard()) {
          state.searchIndex = [getCurrentPageData()];
          state.indexFinished = true;
          return state.searchIndex;
        }

        var urls = await getSitemapUrls();

        if (!urls.length) {
          state.searchIndex = [getCurrentPageData()];
          state.indexFinished = true;
          return state.searchIndex;
        }

        var indexedPages = [];
        var currentIndex = 0;
        var workers = 4;

        async function worker() {
          while (currentIndex < urls.length) {
            var url = urls[currentIndex];
            currentIndex++;

            try {
              var pageData = await fetchPage(url);

              if (pageData.title || pageData.body) {
                indexedPages.push(pageData);
              }
            } catch (error) {}
          }
        }

        await Promise.all(Array.from({ length: workers }, worker));

        state.searchIndex = indexedPages.length ? indexedPages : [getCurrentPageData()];
        state.indexFinished = true;

        return state.searchIndex;
      } catch (error) {
        state.searchIndex = [getCurrentPageData()];
        state.indexFinished = true;

        return state.searchIndex;
      }
    })();

    return state.indexPromise;
  }

  function getPageMatch(page, query) {
    var queryParts = getQueryParts(query);
    var phrase = queryParts.normalized;
    var terms = queryParts.importantWords;

    if (!terms.length) {
      return {
        score: 0,
        exactSurfaceMatch: false,
        exactAnyMatch: false,
        matchedTermCount: 0
      };
    }

    var score = 0;
    var matchedTerms = {};
    var exactSurfaceMatch = false;
    var exactAnyMatch = false;

    function hasPhrase(text) {
      return phrase.length >= 3 && text.indexOf(phrase) > -1;
    }

    function addTermScores(text, weight) {
      terms.forEach(function (term) {
        if (text.indexOf(term) > -1) {
          matchedTerms[term] = true;
          score += weight;
        }
      });
    }

    if (hasPhrase(page.searchableTitle)) {
      score += 600;
      exactSurfaceMatch = true;
      exactAnyMatch = true;
    }

    if (hasPhrase(page.searchableUrl)) {
      score += 350;
      exactSurfaceMatch = true;
      exactAnyMatch = true;
    }

    if (hasPhrase(page.searchableDescription)) {
      score += 250;
      exactSurfaceMatch = true;
      exactAnyMatch = true;
    }

    if (hasPhrase(page.searchableBody)) {
      score += 120;
      exactAnyMatch = true;
    }

    addTermScores(page.searchableTitle, 80);
    addTermScores(page.searchableUrl, 50);
    addTermScores(page.searchableDescription, 30);
    addTermScores(page.searchableBody, 10);

    var matchedTermCount = Object.keys(matchedTerms).length;
    var requiredTermCount = terms.length >= 2 ? Math.min(terms.length, 2) : 1;

    if (!exactAnyMatch && matchedTermCount < requiredTermCount) {
      score = 0;
    }

    if (terms.length >= 2 && !exactAnyMatch && matchedTermCount < terms.length) {
      score = 0;
    }

    if (terms.length === 1 && score < 25) {
      score = 0;
    }

    return {
      score: score,
      exactSurfaceMatch: exactSurfaceMatch,
      exactAnyMatch: exactAnyMatch,
      matchedTermCount: matchedTermCount
    };
  }

  function searchPages(query) {
    var state = window.SuperCustomSiteSearchState;

    var scoredResults = state.searchIndex
      .map(function (page) {
        return {
          page: page,
          match: getPageMatch(page, query)
        };
      })
      .filter(function (result) {
        return result.match.score > 0;
      });

    var exactSurfaceResults = scoredResults.filter(function (result) {
      return result.match.exactSurfaceMatch;
    });

    if (exactSurfaceResults.length) {
      scoredResults = exactSurfaceResults;
    } else {
      var exactAnyResults = scoredResults.filter(function (result) {
        return result.match.exactAnyMatch;
      });

      if (exactAnyResults.length) {
        scoredResults = exactAnyResults;
      }
    }

    return scoredResults
      .sort(function (a, b) {
        return b.match.score - a.match.score;
      })
      .slice(0, MAX_RESULTS)
      .map(function (result) {
        return result.page;
      });
  }

  function debounce(callback, delay) {
    var timer;

    return function () {
      var args = arguments;

      clearTimeout(timer);

      timer = setTimeout(function () {
        callback.apply(null, args);
      }, delay);
    };
  }

  function initSearch(container) {
    if (!container || container.hasAttribute(READY_ATTRIBUTE)) return;

    container.setAttribute(READY_ATTRIBUTE, "true");
    container.classList.add("super-custom-site-search");

    container.innerHTML = `
      <div class="super-custom-site-search__inner">
        <form class="super-custom-site-search__form" role="search">
          <input
            class="super-custom-site-search__input"
            type="search"
            placeholder="Search Here..."
            aria-label="Search this site"
            autocomplete="off"
          />

          <button class="super-custom-site-search__button" type="submit" aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke-width="2.4"></circle>
              <path d="M16.2 16.2L21 21" stroke-width="2.4" stroke-linecap="round"></path>
            </svg>
          </button>
        </form>

        <div class="super-custom-site-search__results" aria-live="polite"></div>
      </div>
    `;

    var form = container.querySelector(".super-custom-site-search__form");
    var input = container.querySelector(".super-custom-site-search__input");
    var resultsBox = container.querySelector(".super-custom-site-search__results");

    function showResults() {
      resultsBox.classList.add("is-visible");
    }

    function hideResults() {
      resultsBox.classList.remove("is-visible");
    }

    function showStatus(message) {
      resultsBox.innerHTML = '<div class="super-custom-site-search__status">' + escapeHTML(message) + "</div>";
      showResults();
    }

    function renderSearch(query) {
      var cleanQuery = normalizeText(query);
      var state = window.SuperCustomSiteSearchState;

      if (cleanQuery.length < MIN_SEARCH_CHARACTERS) {
        showStatus("Type at least " + MIN_SEARCH_CHARACTERS + " characters to search.");
        return;
      }

      if (!state.indexFinished) {
        showStatus("Preparing search...");
        return;
      }

      var results = searchPages(query);

      if (!results.length) {
        showStatus("No results found.");
        return;
      }

      resultsBox.innerHTML = results.map(function (page) {
        var title = page.title || page.url;
        var snippetSource = page.description || page.body || "";
        var snippet = getSnippet(snippetSource, query);

        return [
          '<a class="super-custom-site-search__item" href="' + escapeHTML(page.url) + '">',
            '<span class="super-custom-site-search__title">' + highlightText(title, query) + '</span>',
            '<span class="super-custom-site-search__url">' + escapeHTML(getReadablePath(page.url)) + '</span>',
            '<span class="super-custom-site-search__snippet">' + highlightText(snippet, query) + '</span>',
          '</a>'
        ].join("");
      }).join("");

      showResults();
    }

    var debouncedSearch = debounce(function () {
      renderSearch(input.value);
    }, 180);

    input.addEventListener("focus", function () {
      showStatus("Preparing search...");

      buildSearchIndex().then(function () {
        if (normalizeText(input.value).length >= MIN_SEARCH_CHARACTERS) {
          renderSearch(input.value);
        } else {
          if (isSuperDashboard()) {
            showStatus("Search preview is ready for this page only. Full site search works on the live Super site after publishing.");
          } else {
            showStatus("Search is ready. Start typing to search this site.");
          }
        }
      });
    });

    input.addEventListener("input", function () {
      buildSearchIndex().then(function () {
        renderSearch(input.value);
      });

      debouncedSearch();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      buildSearchIndex().then(function () {
        renderSearch(input.value);
      });
    });

    document.addEventListener("click", function (event) {
      if (!container.contains(event.target)) {
        hideResults();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        hideResults();
        input.blur();
      }
    });
  }

  function initAllSearchBars() {
    injectStyles();

    var containers = document.querySelectorAll("[data-super-custom-search]");

    containers.forEach(function (container) {
      initSearch(container);
    });
  }

  function startObserver() {
    var observer = new MutationObserver(function () {
      initAllSearchBars();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initAllSearchBars();
      startObserver();
    });
  } else {
    initAllSearchBars();
    startObserver();
  }
})();
