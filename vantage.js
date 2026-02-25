(() => {
  if (window.__superSeamlessCalloutMarqueeRed) return;
  window.__superSeamlessCalloutMarqueeRed = true;

  const TARGET_CALLOUT = '.notion-callout.bg-red-light';
  const TARGET_ROW = '.notion-column-list';
  const VIEWPORT_CLASS = 'super-seamless-marquee-viewport-red';

  const marqueeMap = new WeakMap();

  function isTargetRow(row) {
    return row && row.matches(TARGET_ROW) && row.querySelector(TARGET_CALLOUT);
  }

  function getDirectColumns(row) {
    return Array.from(row.children).filter(
      el => el.classList && el.classList.contains('notion-column')
    );
  }

  function getOriginalColumns(row) {
    return getDirectColumns(row).filter(
      col => col.dataset.marqueeClone !== '1' && col.querySelector(TARGET_CALLOUT)
    );
  }

  function getGap(row) {
    const cs = getComputedStyle(row);
    const gap = parseFloat(cs.gap || cs.columnGap || '0');
    return Number.isFinite(gap) ? gap : 0;
  }

  function measureSetWidth(row, originals) {
    const gap = getGap(row);
    if (!originals.length) return 0;

    let width = 0;
    originals.forEach((col, i) => {
      width += col.getBoundingClientRect().width;
      if (i < originals.length - 1) width += gap; // gaps inside the original set
    });

    width += gap; // boundary gap between original set and cloned set
    return width;
  }

  function getDurationSeconds() {
    if (window.matchMedia('(max-width: 768px)').matches) return 18;   // mobile
    if (window.matchMedia('(max-width: 1024px)').matches) return 22;  // tablet
    return 24;                                                        // desktop
  }

  function initRow(row) {
    if (!isTargetRow(row) || row.dataset.seamlessMarqueeReady === '1') return;

    const originals = getOriginalColumns(row);
    if (originals.length < 2) return; // need at least 2 cards for a good marquee

    row.dataset.seamlessMarqueeReady = '1';

    // Disable CSS marquee animation (JS will control movement for a seamless loop)
    row.style.setProperty('animation', 'none', 'important');
    row.style.setProperty('transform', 'translate3d(0,0,0)', 'important');
    row.style.setProperty('will-change', 'transform', 'important');
    row.style.setProperty('backface-visibility', 'hidden', 'important');

    // Wrap row in viewport (clips the clones cleanly)
    const viewport = document.createElement('div');
    viewport.className = VIEWPORT_CLASS;
    viewport.style.overflow = 'hidden';
    viewport.style.width = '100%';
    viewport.style.position = 'relative';

    row.parentNode.insertBefore(viewport, row);
    viewport.appendChild(row);

    let paused = false;
    let rafId = null;
    let lastTs = 0;
    let offset = 0;
    let setWidth = 0;
    let resizeTimer = null;
    let resizeObserver = null;

    function removeClones() {
      getDirectColumns(row).forEach(col => {
        if (col.dataset.marqueeClone === '1') col.remove();
      });
    }

    function rebuild() {
      removeClones();
      offset = 0;
      lastTs = 0;
      row.style.setProperty('transform', 'translate3d(0,0,0)', 'important');

      const originalsNow = getOriginalColumns(row);
      if (!originalsNow.length) return;

      setWidth = measureSetWidth(row, originalsNow);
      if (!setWidth) return;

      // Clone until track is long enough to loop seamlessly
      const neededWidth = Math.max(viewport.clientWidth + setWidth * 2, setWidth * 3);

      while (row.scrollWidth < neededWidth) {
        originalsNow.forEach(col => {
          const clone = col.cloneNode(true);
          clone.dataset.marqueeClone = '1';
          clone.setAttribute('aria-hidden', 'true');
          clone.style.pointerEvents = 'none';

          // prevent focus on cloned links/buttons if any
          clone.querySelectorAll('a, button, input, textarea, select, [tabindex]').forEach(el => {
            el.setAttribute('tabindex', '-1');
            el.setAttribute('aria-hidden', 'true');
          });

          row.appendChild(clone);
        });
      }
    }

    function tick(ts) {
      // Respect reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        row.style.setProperty('transform', 'translate3d(0,0,0)', 'important');
        lastTs = ts;
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Avoid giant jumps when tab becomes visible again
      if (document.hidden) {
        lastTs = ts;
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (!lastTs) lastTs = ts;
      let dt = ts - lastTs;
      lastTs = ts;

      // Clamp dt to avoid stutter/jumps on frame drops
      if (dt > 50) dt = 16.67;

      if (!paused && setWidth > 0) {
        const duration = getDurationSeconds();
        const pxPerSec = setWidth / duration;

        offset += (pxPerSec * dt) / 1000;
        if (offset >= setWidth) offset -= setWidth;

        row.style.setProperty('transform', `translate3d(${-offset}px,0,0)`, 'important');
      }

      rafId = requestAnimationFrame(tick);
    }

    function queueRebuild() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        rebuild();
      }, 120);
    }

    function onVisibilityChange() {
      lastTs = 0; // reset frame timing to prevent jumps
    }

    // Pause on hover/touch
    viewport.addEventListener('mouseenter', () => { paused = true; });
    viewport.addEventListener('mouseleave', () => { paused = false; });
    viewport.addEventListener('touchstart', () => { paused = true; }, { passive: true });
    viewport.addEventListener('touchend', () => { paused = false; }, { passive: true });
    viewport.addEventListener('touchcancel', () => { paused = false; }, { passive: true });

    window.addEventListener('resize', queueRebuild);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // More reliable rebuild when Super reflows content
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => queueRebuild());
      resizeObserver.observe(viewport);
      resizeObserver.observe(row);
    }

    const start = () => {
      rebuild();
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start).catch(start);
    } else {
      setTimeout(start, 400);
    }

    marqueeMap.set(row, {
      rebuild,
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', queueRebuild);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (resizeObserver) resizeObserver.disconnect();
      }
    });
  }

  function scan() {
    document.querySelectorAll(TARGET_ROW).forEach(row => {
      if (row.closest(`.${VIEWPORT_CLASS}`)) return;
      if (isTargetRow(row)) initRow(row);
    });
  }

  // Initial scan
  scan();

  // Re-scan when Super re-renders blocks
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
})();
</script>






<script>
(() => {
  if (window.__superPremiumGallerySlider) return;
  window.__superPremiumGallerySlider = true;

  const TARGET = ".notion-collection-gallery.medium";
  const instances = [];

  function getCardsPerView() {
    if (window.innerWidth <= 767) return 1;
    if (window.innerWidth <= 1023) return 2;
    return 3;
  }

  function getCardNodes(gallery) {
    return Array.from(gallery.children).filter((el) =>
      el.matches(".notion-collection-card, a.notion-collection-card")
    );
  }

  function createArrowButton(direction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "super-gallery-nav " + (direction === "prev" ? "super-gallery-prev" : "super-gallery-next");
    btn.setAttribute("aria-label", direction === "prev" ? "Back" : "Forward");

    btn.innerHTML =
      direction === "prev"
        ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    return btn;
  }

  function initGallery(gallery) {
    if (!gallery || gallery.dataset.superSliderInit === "1") return;

    const cards = getCardNodes(gallery);
    if (cards.length <= getCardsPerView()) return;

    gallery.dataset.superSliderInit = "1";
    gallery.classList.add("super-slider-ready");

    const wrapper = document.createElement("div");
    wrapper.className = "super-gallery-slider";

    const viewport = document.createElement("div");
    viewport.className = "super-gallery-viewport";

    const prevBtn = createArrowButton("prev");
    const nextBtn = createArrowButton("next");

    const parent = gallery.parentNode;
    parent.insertBefore(wrapper, gallery);
    wrapper.appendChild(prevBtn);
    wrapper.appendChild(viewport);
    viewport.appendChild(gallery);
    wrapper.appendChild(nextBtn);

    const state = {
      gallery,
      viewport,
      prevBtn,
      nextBtn,
      index: 0,
      pointerDownX: 0,
      pointerMoveX: 0,
      isPointerDown: false,
      activePointerId: null,
      didDrag: false,
      suppressClick: false
    };

    function maxIndex() {
      const total = getCardNodes(state.gallery).length;
      return Math.max(0, total - getCardsPerView());
    }

    function gapPx() {
      const cs = getComputedStyle(state.gallery);
      const gap = parseFloat(cs.gap || cs.columnGap || "16");
      return Number.isFinite(gap) ? gap : 16;
    }

    function stepBy(pageDirection) {
      const step = getCardsPerView();
      state.index += pageDirection * step;
      if (state.index < 0) state.index = 0;
      if (state.index > maxIndex()) state.index = maxIndex();
      update();
    }

    function update() {
      const cardsNow = getCardNodes(state.gallery);
      if (!cardsNow.length) return;

      const first = cardsNow[0];
      const cardWidth = first.getBoundingClientRect().width;
      const offset = state.index * (cardWidth + gapPx());

      state.gallery.style.transform = "translate3d(" + (-offset) + "px, 0, 0)";
      state.prevBtn.disabled = state.index <= 0;
      state.nextBtn.disabled = state.index >= maxIndex();

      if (maxIndex() === 0) {
        state.prevBtn.style.display = "none";
        state.nextBtn.style.display = "none";
      } else {
        state.prevBtn.style.display = "";
        state.nextBtn.style.display = "";
      }
    }

    prevBtn.addEventListener("click", () => stepBy(-1));
    nextBtn.addEventListener("click", () => stepBy(1));

    // Preserve normal clicks, only suppress click after a real swipe
    viewport.addEventListener(
      "click",
      (e) => {
        if (!state.suppressClick) return;
        e.preventDefault();
        e.stopPropagation();
        state.suppressClick = false;
      },
      true
    );

    viewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      state.isPointerDown = true;
      state.activePointerId = e.pointerId;
      state.pointerDownX = e.clientX;
      state.pointerMoveX = e.clientX;
      state.didDrag = false;
      state.suppressClick = false;
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!state.isPointerDown || e.pointerId !== state.activePointerId) return;

      state.pointerMoveX = e.clientX;
      const delta = state.pointerMoveX - state.pointerDownX;

      // Mark as drag only after a tiny threshold, so simple taps still click
      if (Math.abs(delta) > 8) {
        state.didDrag = true;
        // Prevent accidental text/image dragging while swiping
        if (e.cancelable) e.preventDefault();
      }
    });

    function endPointer(e) {
      if (!state.isPointerDown) return;
      if (e && state.activePointerId != null && e.pointerId !== state.activePointerId) return;

      const delta = state.pointerMoveX - state.pointerDownX;

      state.isPointerDown = false;
      state.activePointerId = null;

      // Swipe threshold
      if (Math.abs(delta) > 45) {
        state.suppressClick = true; // block the synthetic click after swipe
        if (delta < 0) stepBy(1);   // swipe left → next
        else stepBy(-1);            // swipe right → prev
      } else {
        state.suppressClick = false; // allow normal click/tap
      }

      // Reset in case no click fires (e.g. pointercancel)
      setTimeout(() => {
        state.suppressClick = false;
      }, 0);
    }

    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);

    // If pointer leaves viewport while dragging, finish gesture safely
    viewport.addEventListener("pointerleave", (e) => {
      if (!state.isPointerDown) return;
      endPointer(e);
    });

    const images = gallery.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", update, { once: true });
      }
    });

    wrapper.tabIndex = 0;
    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") stepBy(-1);
      if (e.key === "ArrowRight") stepBy(1);
    });

    instances.push({ update, state });
    requestAnimationFrame(update);
    setTimeout(update, 200);
  }

  function scanAndInit() {
    document.querySelectorAll(TARGET).forEach(initGallery);
  }

  scanAndInit();

  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    let shouldUpdate = false;

    for (const m of mutations) {
      if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) {
        shouldScan = true;
        shouldUpdate = true;
        break;
      }
    }

    if (shouldScan) {
      requestAnimationFrame(() => {
        scanAndInit();
        instances.forEach((i) => i.update());
      });
    } else if (shouldUpdate) {
      requestAnimationFrame(() => {
        instances.forEach((i) => i.update());
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      instances.forEach((i) => i.update());
    }, 120);
  });

  window.addEventListener("load", () => {
    instances.forEach((i) => i.update());
  });
})();
