if (!customElements.get('product-splide-gallery')) {
  customElements.define(
    'product-splide-gallery',
    class ProductSplideGallery extends HTMLElement {
      connectedCallback() {
        if (typeof window.Splide === 'undefined') {
          // Splide is loaded with `defer`; wait for it if this element connects first.
          window.addEventListener('load', () => this.init(), { once: true });
          return;
        }
        this.init();
      }

      disconnectedCallback() {
        this.destroySliders();
        this.desktopQuery?.removeEventListener('change', this.onBreakpointChange);
        this.resizeObserver?.disconnect();
        this.unsubscribeVariantChange?.();
      }

      init() {
        if (this.initialized || !this.isConnected) return;
        this.initialized = true;

        this.mainEl = this.querySelector('[data-splide-main]');
        this.thumbsEl = this.querySelector('[data-splide-thumbs]');
        this.desktopQuery = window.matchMedia('(min-width: 750px)');

        this.onBreakpointChange = () => this.mount(this.main ? this.main.index : 0);
        this.desktopQuery.addEventListener('change', this.onBreakpointChange);

        this.mount(Number(this.dataset.startIndex) || 0);

        // Keep the vertical thumbnail column as tall as the main image.
        this.resizeObserver = new ResizeObserver(() => this.syncThumbsHeight());
        this.resizeObserver.observe(this.mainEl);

        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          this.unsubscribeVariantChange = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
            if (event.data.sectionId !== this.dataset.section) return;
            const mediaId = event.data.variant?.featured_media?.id;
            if (mediaId) this.goToMedia(mediaId);
          });
        }
      }

      mount(start = 0) {
        this.destroySliders();

        const isDesktop = this.desktopQuery.matches;
        const hasMultiple = Number(this.dataset.mediaCount) > 1;

        this.main = new Splide(this.mainEl, {
          type: 'slide',
          rewind: true,
          start,
          speed: 400,
          arrows: false,
          pagination: false,
          drag: hasMultiple,
          noDrag: 'model-viewer, video, iframe, .deferred-media__poster',
          i18n: this.getI18n(),
        });

        this.main.on('move', () => window.pauseAllMedia?.());

        if (!this.thumbsEl) {
          this.main.mount();
          return;
        }

        const thumbOptions = isDesktop
          ? {
              direction: 'ttb',
              height: '100%', // the root element's height is matched to the main carousel in syncThumbsHeight()
              fixedWidth: '100%',
              fixedHeight: 'var(--splide-thumb-size)',
              wheel: true,
              releaseWheel: true,
            }
          : {
              direction: 'ltr',
              fixedWidth: 'var(--splide-thumb-size)',
              fixedHeight: 'var(--splide-thumb-size)',
            };

        this.thumbs = new Splide(this.thumbsEl, {
          ...thumbOptions,
          start,
          gap: '1rem',
          rewind: true,
          arrows: true,
          pagination: false,
          isNavigation: true,
          focus: 0,
          i18n: this.getI18n(),
        });

        // Splide requires sync() before mount(), main first.
        this.main.sync(this.thumbs);
        this.main.mount();
        this.syncThumbsHeight(false);
        this.thumbs.mount();
      }

      syncThumbsHeight(refresh = true) {
        if (!this.thumbsEl) return;

        if (!this.desktopQuery.matches) {
          this.thumbsEl.style.removeProperty('height');
          this.lastThumbsHeight = 0;
          return;
        }

        const height = this.mainEl.offsetHeight;
        if (Math.abs(height - (this.lastThumbsHeight || 0)) < 2) return;
        this.lastThumbsHeight = height;
        this.thumbsEl.style.height = `${height}px`;
        if (refresh) this.thumbs?.refresh();
      }

      goToMedia(mediaId) {
        if (!this.main) return;
        const slides = Array.from(this.mainEl.querySelectorAll('.splide__slide:not(.splide__slide--clone)'));
        const index = slides.findIndex((slide) => slide.dataset.mediaId === String(mediaId));
        if (index > -1) this.main.go(index);
      }

      destroySliders() {
        this.thumbs?.destroy();
        this.main?.destroy();
        this.thumbs = null;
        this.main = null;
        this.lastThumbsHeight = 0;
      }

      getI18n() {
        return {
          prev: this.dataset.labelPrev || 'Previous slide',
          next: this.dataset.labelNext || 'Next slide',
        };
      }
    }
  );
}
