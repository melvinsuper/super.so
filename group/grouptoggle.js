
  document.documentElement.classList.add("super-groups-preparing");
</script>

<style>
  /*
    Short anti-flash state.
    This prevents the open grouped database from being obvious on first load.
    It does NOT hide the database for the full retry duration.
  */

  html.super-groups-preparing .notion-collection-group__section.open {
    opacity: 0;
  }

  html.super-groups-ready .notion-collection-group__section {
    opacity: 1;
    transition: opacity 160ms ease;
  }
</style>

<script>
(function () {
  const CONFIG = {
    closeDelay: 80,
    retryDuration: 5000,
    retryInterval: 250,

    /*
      Important:
      This controls how long the page hides the open groups on first load.
      Keep this short so the page does not feel delayed.
    */
    prepareMaxDuration: 450
  };

  const GROUP_SECTION_SELECTOR = ".notion-collection-group__section";

  const GROUP_TOGGLE_SELECTOR =
    ".notion-collection-group__section-toggle";

  /*
    Currently supported grouped database views in Super:
    Table, Gallery, and List.
  */
  const GROUPED_COLLECTION_SELECTOR =
    ".notion-collection-table.grouped," +
    ".notion-collection-gallery.grouped," +
    ".notion-collection-list.grouped";

  let currentPath = window.location.pathname;
  let retryTimer = null;
  let retryStopTimer = null;
  let revealTimer = null;

  function getGroupToggle(section) {
    if (!section || !section.querySelector) return null;
    return section.querySelector(GROUP_TOGGLE_SELECTOR);
  }

  function isDatabaseGroup(section) {
    if (!section || !section.classList) return false;

    if (!section.classList.contains("notion-collection-group__section")) {
      return false;
    }

    const groupToggle = getGroupToggle(section);
    if (!groupToggle) return false;

    if (section.matches(GROUPED_COLLECTION_SELECTOR)) return true;
    if (section.closest(GROUPED_COLLECTION_SELECTOR)) return true;
    if (section.querySelector(GROUPED_COLLECTION_SELECTOR)) return true;

    const parent = section.parentElement;
    if (parent && parent.closest(GROUPED_COLLECTION_SELECTOR)) return true;
    if (parent && parent.querySelector(GROUPED_COLLECTION_SELECTOR)) return true;

    /*
      Fallback:
      This class is specific to grouped Notion database sections.
    */
    return true;
  }

  function isOpen(section) {
    return section.classList.contains("open");
  }

  function closeGroup(section) {
    if (!isDatabaseGroup(section)) return;

    /*
      Do not force-close a group after the visitor manually opened
      or closed it.
    */
    if (section.dataset.superGroupUserChanged === "true") return;

    if (!isOpen(section)) return;

    const trigger = getGroupToggle(section);
    if (!trigger) return;

    section.dataset.superGroupClosing = "true";
    trigger.click();

    window.setTimeout(function () {
      delete section.dataset.superGroupClosing;
      section.dataset.superGroupDefaultClosed = "true";
    }, CONFIG.closeDelay);
  }

  function closeAllGroups() {
    document
      .querySelectorAll(GROUP_SECTION_SELECTOR)
      .forEach(function (section) {
        closeGroup(section);
      });
  }

  function resetGroupMemory() {
    document
      .querySelectorAll(GROUP_SECTION_SELECTOR)
      .forEach(function (section) {
        delete section.dataset.superGroupUserChanged;
        delete section.dataset.superGroupDefaultClosed;
        delete section.dataset.superGroupClosing;
      });
  }

  function hideBrieflyBeforeClosing() {
    clearTimeout(revealTimer);

    document.documentElement.classList.add("super-groups-preparing");
    document.documentElement.classList.remove("super-groups-ready");

    revealTimer = window.setTimeout(function () {
      document.documentElement.classList.remove("super-groups-preparing");
      document.documentElement.classList.add("super-groups-ready");
    }, CONFIG.prepareMaxDuration);
  }

  function revealNow() {
    clearTimeout(revealTimer);

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        document.documentElement.classList.remove("super-groups-preparing");
        document.documentElement.classList.add("super-groups-ready");
      });
    });
  }

  function startRetryClose() {
    clearInterval(retryTimer);
    clearTimeout(retryStopTimer);

    hideBrieflyBeforeClosing();

    closeAllGroups();

    /*
      Reveal quickly after the first close attempt.
      The retry continues in the background, but it no longer keeps the
      database hidden.
    */
    window.setTimeout(revealNow, CONFIG.closeDelay + 60);

    retryTimer = window.setInterval(closeAllGroups, CONFIG.retryInterval);

    retryStopTimer = window.setTimeout(function () {
      clearInterval(retryTimer);
      retryTimer = null;
    }, CONFIG.retryDuration);
  }

  document.addEventListener(
    "click",
    function (event) {
      const trigger = event.target.closest(GROUP_TOGGLE_SELECTOR);
      if (!trigger) return;

      const section = trigger.closest(GROUP_SECTION_SELECTOR);
      if (!section) return;

      /*
        Ignore clicks made by this script.
        Only remember real visitor clicks.
      */
      if (section.dataset.superGroupClosing === "true") return;

      section.dataset.superGroupUserChanged = "true";
    },
    true
  );

  const observer = new MutationObserver(function () {
    document
      .querySelectorAll(GROUP_SECTION_SELECTOR + ".open")
      .forEach(function (section) {
        closeGroup(section);
      });

    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      resetGroupMemory();
      startRetryClose();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  ["pushState", "replaceState"].forEach(function (method) {
    const original = history[method];

    history[method] = function () {
      const result = original.apply(this, arguments);

      window.setTimeout(function () {
        if (window.location.pathname !== currentPath) {
          currentPath = window.location.pathname;
          resetGroupMemory();
          startRetryClose();
        }
      }, 100);

      return result;
    };
  });

  window.addEventListener("popstate", function () {
    window.setTimeout(function () {
      resetGroupMemory();
      startRetryClose();
    }, 100);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startRetryClose);
  } else {
    startRetryClose();
  }

  window.addEventListener("load", startRetryClose);
})();
