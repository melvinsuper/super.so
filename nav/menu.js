
(function () {
  "use strict";

  if (window.__superSafePillNavLoadedV2) {
    return;
  }

  window.__superSafePillNavLoadedV2 = true;

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizePath(path) {
    return path.replace(/\/+$/, "") || "/";
  }

  function getOriginalLabel(link) {
    if (!link) return "";

    var existingMainLabel = link.querySelector(".super-pillnav-label-main");

    if (existingMainLabel && existingMainLabel.textContent.trim()) {
      return existingMainLabel.textContent.trim();
    }

    if (link.dataset.superPillnavOriginalLabel) {
      return link.dataset.superPillnavOriginalLabel;
    }

    return link.textContent.trim();
  }

  function isActiveLink(link) {
    var href = link.getAttribute("href");

    if (!href || href === "#") {
      return false;
    }

    try {
      var linkURL = new URL(href, window.location.origin);
      var currentPath = normalizePath(window.location.pathname);
      var linkPath = normalizePath(linkURL.pathname);

      return currentPath === linkPath;
    } catch (error) {
      return false;
    }
  }

  function removeOldEffects() {
    var oldEffects = document.querySelectorAll(
      ".super-gooey-effect, .super-gooey-pill, .super-gooey-filter, .super-gooey-text, .super-pillnav-hover-circle"
    );

    oldEffects.forEach(function (effect) {
      effect.remove();
    });
  }

  function getNavbarLinks() {
    var navbar = document.querySelector(".super-navbar");

    if (!navbar) {
      return null;
    }

    var list = navbar.querySelector(".super-navbar__item-list");

    if (!list) {
      return null;
    }

    var links = Array.prototype.slice.call(list.querySelectorAll("a, button"))
      .filter(function (link) {
        var label = getOriginalLabel(link);

        if (!label) return false;

        if (link.closest(".super-navbar__actions")) return false;
        if (link.closest(".super-navbar__cta")) return false;
        if (link.closest(".super-navbar__logo")) return false;

        return true;
      });

    if (!links.length) {
      return null;
    }

    return {
      navbar: navbar,
      links: links
    };
  }

  function transformLink(link) {
    var label = getOriginalLabel(link);

    if (!label) {
      return;
    }

    link.dataset.superPillnavOriginalLabel = label;
    link.classList.add("super-pillnav-link");

    if (isActiveLink(link)) {
      link.classList.add("super-pillnav-active");
    } else {
      link.classList.remove("super-pillnav-active");
    }

    if (!link.querySelector(".super-pillnav-label-stack")) {
      link.innerHTML =
        '<span class="super-pillnav-label-stack">' +
          '<span class="super-pillnav-label-main">' + escapeHTML(label) + '</span>' +
          '<span class="super-pillnav-label-hover" aria-hidden="true">' + escapeHTML(label) + '</span>' +
        '</span>';
    }
  }

  function refreshActiveState(links) {
    links.forEach(function (link) {
      if (isActiveLink(link)) {
        link.classList.add("super-pillnav-active");
      } else {
        link.classList.remove("super-pillnav-active");
      }
    });
  }

  function initSafePillNav() {
    var data = getNavbarLinks();

    if (!data) {
      return false;
    }

    removeOldEffects();

    data.navbar.classList.remove("super-gooey-ready");
    data.navbar.classList.remove("super-pillnav-ready");
    data.navbar.classList.remove("super-pillnav-clean");
    data.navbar.classList.add("super-pillnav-safe");

    data.links.forEach(function (link) {
      transformLink(link);
    });

    refreshActiveState(data.links);

    return true;
  }

  var scheduled = false;

  function scheduleInit() {
    if (scheduled) {
      return;
    }

    scheduled = true;

    requestAnimationFrame(function () {
      scheduled = false;
      initSafePillNav();
    });
  }

  function start() {
    var attempts = 0;
    var maxAttempts = 100;

    var timer = window.setInterval(function () {
      attempts++;

      if (initSafePillNav() || attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 50);
  }

  function watchForChanges() {
    var observer = new MutationObserver(function () {
      scheduleInit();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  document.addEventListener("click", function (event) {
    var clickedNavLink = event.target.closest(
      ".super-navbar .super-navbar__item-list a, .super-navbar .super-navbar__item-list button"
    );

    if (clickedNavLink) {
      scheduleInit();

      window.setTimeout(scheduleInit, 50);
      window.setTimeout(scheduleInit, 150);
      window.setTimeout(scheduleInit, 300);
    }
  }, true);

  window.addEventListener("resize", scheduleInit);
  window.addEventListener("popstate", scheduleInit);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      start();
      watchForChanges();
    });
  } else {
    start();
    watchForChanges();
  }
})();
