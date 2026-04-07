
(function () {
  const selector = '.notion-callout.bg-brown-light .notion-collection-gallery .notion-collection-card.active';
  let openCard = null;

  function openLightbox(card) {
    if (openCard && openCard !== card) {
      openCard.classList.remove('is-lightbox-open');
    }

    openCard = card;
    openCard.classList.add('is-lightbox-open');
    document.body.classList.add('gallery-lightbox-open');
  }

  function closeLightbox() {
    if (!openCard) return;

    openCard.classList.remove('is-lightbox-open');
    document.body.classList.remove('gallery-lightbox-open');
    openCard = null;
  }

  document.addEventListener('click', function (e) {
    const clickedCard = e.target.closest(selector);

    /* Click on a gallery card */
    if (clickedCard) {
      e.preventDefault();

      if (openCard === clickedCard) {
        closeLightbox();
      } else {
        openLightbox(clickedCard);
      }
      return;
    }

    /* Click anywhere outside the open card closes it */
    if (openCard) {
      e.preventDefault();
      closeLightbox();
    }
  }, true);

  /* ESC key closes the enlarged image */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeLightbox();
    }
  });

  /* Clean up on navigation */
  window.addEventListener('hashchange', closeLightbox);
  window.addEventListener('popstate', closeLightbox);
})();
