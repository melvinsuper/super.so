
(function () {
  var MARKER = "super-tabs";
  var initialized = new WeakSet();

  function cleanText(element) {
    return (element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function normalizedText(element) {
    return cleanText(element).toLowerCase();
  }

  function isMarker(element) {
    return normalizedText(element) === MARKER;
  }

  function hasToggle(element) {
    if (!element) return false;

    var className = String(element.className || "");

    return (
      className.indexOf("notion-toggle") > -1 ||
      element.matches("details") ||
      !!element.querySelector(
        ".notion-toggle, [class*='notion-toggle'], details, summary"
      )
    );
  }

  function getToggle(element) {
    if (!element) return null;

    if (hasToggle(element)) {
      if (
        String(element.className || "").indexOf("notion-toggle") > -1 ||
        element.matches("details")
      ) {
        return element;
      }

      return element.querySelector(
        ".notion-toggle, [class*='notion-toggle'], details"
      ) || element;
    }

    return null;
  }

  function getToggleTitle(toggle, index) {
    var title =
      toggle.querySelector(".notion-toggle__summary .notion-semantic-string") ||
      toggle.querySelector(".notion-toggle__title .notion-semantic-string") ||
      toggle.querySelector(".notion-toggle__summary") ||
      toggle.querySelector(".notion-toggle__title") ||
      toggle.querySelector("summary") ||
      toggle.querySelector(".notion-semantic-string");

    var label = title ? cleanText(title) : "";

    return label || "Tab " + (index + 1);
  }

  function getToggleContent(toggle) {
    return (
      toggle.querySelector(".notion-toggle__content") ||
      toggle.querySelector(".notion-toggle__children") ||
      toggle.querySelector("[class*='toggle__content']") ||
      toggle.querySelector("[class*='toggle-content']")
    );
  }

  function moveToggleContent(toggle, panel) {
    var content = getToggleContent(toggle);

    if (content && content.childNodes.length) {
      while (content.firstChild) {
        panel.appendChild(content.firstChild);
      }

      return;
    }

    var summary =
      toggle.querySelector(".notion-toggle__summary") ||
      toggle.querySelector(".notion-toggle__title") ||
      toggle.querySelector("summary");

    Array.prototype.slice.call(toggle.children).forEach(function (child) {
      if (summary && (child === summary || child.contains(summary))) {
        return;
      }

      panel.appendChild(child);
    });
  }

  function findWorkingMarkerBlock(markerElement) {
    var current = markerElement;

    while (current && current !== document.body) {
      var tabs = collectFollowingToggles(current);

      if (tabs.length >= 2) {
        return {
          markerBlock: current,
          tabs: tabs
        };
      }

      current = current.parentElement;
    }

    return null;
  }

  function collectFollowingToggles(markerBlock) {
    var tabs = [];
    var node = markerBlock.nextElementSibling;

    while (node) {
      var toggle = getToggle(node);

      if (toggle) {
        tabs.push({
          wrapper: node,
          toggle: toggle
        });

        node = node.nextElementSibling;
        continue;
      }

      if (!cleanText(node)) {
        node = node.nextElementSibling;
        continue;
      }

      break;
    }

    return tabs;
  }

  function setActiveTab(nav, panels, activeButton, activePanel) {
    nav.querySelectorAll(".super-tabs__button").forEach(function (button) {
      button.classList.remove("is-active");
      button.setAttribute("aria-selected", "false");
    });

    panels.querySelectorAll(".super-tabs__panel").forEach(function (panel) {
      panel.classList.remove("is-active");
      panel.setAttribute("aria-hidden", "true");
    });

    activeButton.classList.add("is-active");
    activeButton.setAttribute("aria-selected", "true");

    activePanel.classList.add("is-active");
    activePanel.setAttribute("aria-hidden", "false");
  }

  function buildTabs(markerElement) {
    var result = findWorkingMarkerBlock(markerElement);

    if (!result) return;

    var markerBlock = result.markerBlock;
    var tabs = result.tabs;

    if (initialized.has(markerBlock)) return;

    initialized.add(markerBlock);

    var tabsId = "super-tabs-" + Math.random().toString(36).slice(2, 9);

    var wrapper = document.createElement("section");
    var nav = document.createElement("div");
    var panels = document.createElement("div");

    wrapper.className = "super-tabs";
    nav.className = "super-tabs__nav";
    panels.className = "super-tabs__panels";

    nav.setAttribute("role", "tablist");

    tabs.forEach(function (tab, index) {
      var button = document.createElement("button");
      var panel = document.createElement("div");

      var buttonId = tabsId + "-button-" + index;
      var panelId = tabsId + "-panel-" + index;
      var isActive = index === 0;

      button.type = "button";
      button.id = buttonId;
      button.className = "super-tabs__button" + (isActive ? " is-active" : "");
      button.textContent = getToggleTitle(tab.toggle, index);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.setAttribute("aria-controls", panelId);

      panel.id = panelId;
      panel.className = "super-tabs__panel" + (isActive ? " is-active" : "");
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", buttonId);
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");

      moveToggleContent(tab.toggle, panel);

      button.addEventListener("click", function () {
        setActiveTab(nav, panels, button, panel);
      });

      nav.appendChild(button);
      panels.appendChild(panel);
    });

    wrapper.appendChild(nav);
    wrapper.appendChild(panels);

    markerBlock.parentNode.insertBefore(wrapper, markerBlock);

    markerBlock.remove();

    tabs.forEach(function (tab) {
      tab.wrapper.remove();
    });
  }

  function initSuperTabs() {
    var elements = document.querySelectorAll(
      ".notion-text, .notion-text__content, .notion-semantic-string, .notion-heading, h1, h2, h3, h4, p"
    );

    elements.forEach(function (element) {
      if (isMarker(element)) {
        buildTabs(element);
      }
    });
  }

  function run() {
    setTimeout(initSuperTabs, 100);
    setTimeout(initSuperTabs, 500);
    setTimeout(initSuperTabs, 1200);
    setTimeout(initSuperTabs, 2500);
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("load", run);

  var observerTimer;

  new MutationObserver(function () {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(initSuperTabs, 300);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
