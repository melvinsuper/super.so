(() => {
  const SELECTOR = "h2.notion-heading, .notion-text, .notion-header__title";

  const INITIAL_TRANSFORM = "translate3d(0, 56px, 0) scale(0.982)";
  const MID_TRANSFORM = "translate3d(0, 18px, 0) scale(0.992)";
  const FINAL_TRANSFORM = "translate3d(0, 0, 0) scale(1)";

  const INITIAL_FILTER = "blur(3px)";
  const MID_FILTER = "blur(0.5px)";
  const FINAL_FILTER = "blur(0)";

  const ANIMATION_DURATION = 1200;
  const CLEANUP_DELAY = 1250;
  const FALLBACK_DELAY = 2000;

  const observedElements = new WeakSet();

  function setInitialState(element) {
    if (!element || element.dataset.scrollRevealReady === "true") return;

    element.dataset.scrollRevealReady = "true";
    element.style.opacity = "0";
    element.style.transform = INITIAL_TRANSFORM;
    element.style.filter = INITIAL_FILTER;
    element.style.willChange = "opacity, transform, filter";
    element.style.backfaceVisibility = "hidden";
    element.style.webkitFontSmoothing = "antialiased";
  }

  function finalizeAnimation(element) {
    if (!element) return;
    element.style.opacity = "1";
    element.style.transform = FINAL_TRANSFORM;
    element.style.filter = FINAL_FILTER;
    element.style.willChange = "auto";
  }

  function animateElement(element) {
    if (!element || element.dataset.scrollRevealDone === "true") return;

    element.dataset.scrollRevealDone = "true";

    element.animate(
      [
        {
          opacity: 0,
          transform: INITIAL_TRANSFORM,
          filter: INITIAL_FILTER
        },
        {
          opacity: 1,
          transform: MID_TRANSFORM,
          filter: MID_FILTER,
          offset: 0.62
        },
        {
          opacity: 1,
          transform: FINAL_TRANSFORM,
          filter: FINAL_FILTER
        }
      ],
      {
        duration: ANIMATION_DURATION,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards"
      }
    );

    window.setTimeout(() => {
      finalizeAnimation(element);
    }, CLEANUP_DELAY);
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.96 && rect.bottom > 0;
  }

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animateElement(entry.target);
        intersectionObserver.unobserve(entry.target);
      }
    },
    {
      threshold: 0,
      rootMargin: "0px 0px -2% 0px"
    }
  );

  function observeElements() {
    const elements = document.querySelectorAll(SELECTOR);

    for (const element of elements) {
      if (observedElements.has(element)) continue;

      observedElements.add(element);
      setInitialState(element);

      if (isInViewport(element)) {
        animateElement(element);
      } else {
        intersectionObserver.observe(element);
      }

      window.setTimeout(() => {
        finalizeAnimation(element);
      }, FALLBACK_DELAY);
    }
  }

  function init() {
    observeElements();

    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
