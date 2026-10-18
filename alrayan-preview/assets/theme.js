/*
 * Alrayan theme
 * Progressive enhancement only: every feature here has a working no-JS fallback
 * (links, regular form posts and the cart page).
 */
(() => {
  'use strict';

  const theme = window.theme || {};
  const routes = theme.routes || {};
  const strings = theme.strings || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const isRTL = () => document.documentElement.dir === 'rtl';
  const desktop = window.matchMedia('(min-width: 990px)');
  const canHover = window.matchMedia('(hover: hover)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const debounce = (fn, wait = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* ------------------------------------------------------------------
   * Drawers (menu, search, cart, mobile filters)
   * ------------------------------------------------------------------ */
  const Drawer = {
    active: null,
    trigger: null,

    open(id, trigger) {
      const drawer = document.getElementById(id);
      if (!drawer) return;
      if (this.active && this.active !== drawer) this.close(false);

      this.trigger = trigger || document.activeElement;
      this.active = drawer;
      drawer.classList.add('is-open');
      document.documentElement.classList.add('scroll-lock');
      $$(`[aria-controls="${id}"]`).forEach((el) => el.setAttribute('aria-expanded', 'true'));

      const target = $('[data-autofocus]', drawer) || $(FOCUSABLE, $('.drawer__panel', drawer) || drawer);
      window.setTimeout(() => target && target.focus({ preventScroll: true }), 80);
    },

    close(restoreFocus = true) {
      const drawer = this.active;
      if (!drawer) return;
      drawer.classList.remove('is-open');
      document.documentElement.classList.remove('scroll-lock');
      $$(`[aria-controls="${drawer.id}"]`).forEach((el) => el.setAttribute('aria-expanded', 'false'));
      this.active = null;
      if (restoreFocus && this.trigger && document.contains(this.trigger)) this.trigger.focus({ preventScroll: true });
    },

    trapFocus(event) {
      const panel = $('.drawer__panel', this.active);
      const items = $$(FOCUSABLE, panel).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
  };

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-drawer-open]');
    if (opener) {
      const drawer = document.getElementById(opener.dataset.drawerOpen);
      // The desktop filter sidebar shares drawer markup but is always visible.
      if (drawer && !(drawer.classList.contains('facets-drawer') && desktop.matches)) {
        event.preventDefault();
        Drawer.open(opener.dataset.drawerOpen, opener);
      }
      return;
    }
    if (event.target.closest('[data-drawer-close]') && Drawer.active) {
      event.preventDefault();
      Drawer.close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!Drawer.active) return;
    if (event.key === 'Escape') Drawer.close();
    if (event.key === 'Tab') Drawer.trapFocus(event);
  });

  desktop.addEventListener('change', () => {
    if (Drawer.active && Drawer.active.classList.contains('facets-drawer')) Drawer.close(false);
  });

  /* ------------------------------------------------------------------
   * Header: scroll shadow and desktop dropdowns
   * ------------------------------------------------------------------ */
  const initHeader = (root = document) => {
    const header = $('[data-header]', root);
    if (header && !header.dataset.bound) {
      header.dataset.bound = 'true';
      const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      const setHeight = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
      setHeight();
      window.addEventListener('resize', debounce(setHeight, 150));
    }

    $$('[data-nav-dropdown]', root).forEach((dropdown) => {
      if (dropdown.dataset.bound) return;
      dropdown.dataset.bound = 'true';
      const summary = $('summary', dropdown);
      let closeTimer;

      dropdown.addEventListener('mouseenter', () => {
        if (!canHover.matches) return;
        clearTimeout(closeTimer);
        dropdown.open = true;
      });
      dropdown.addEventListener('mouseleave', () => {
        if (!canHover.matches) return;
        closeTimer = setTimeout(() => (dropdown.open = false), 120);
      });
      summary.addEventListener('click', (event) => {
        // A hover already opened it; keep it open rather than toggling closed.
        if (canHover.matches && dropdown.open && dropdown.matches(':hover')) event.preventDefault();
      });
      dropdown.addEventListener('toggle', () => {
        if (!dropdown.open) return;
        $$('[data-nav-dropdown][open]').forEach((other) => other !== dropdown && (other.open = false));
      });
    });
  };

  document.addEventListener('click', (event) => {
    $$('[data-nav-dropdown][open]').forEach((dropdown) => {
      if (!dropdown.contains(event.target)) dropdown.open = false;
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = $('[data-nav-dropdown][open]');
    if (open) {
      open.open = false;
      $('summary', open).focus();
    }
  });

  /* ------------------------------------------------------------------
   * Announcement bar
   * ------------------------------------------------------------------ */
  const initAnnouncements = (root = document) => {
    $$('[data-announcement]', root).forEach((bar) => {
      if (bar.dataset.bound) return;
      bar.dataset.bound = 'true';
      const items = $$('.announcement__item', bar);
      if (items.length < 2) return;
      let index = 0;
      let timer;

      const show = (next) => {
        items[index].classList.remove('is-active');
        index = (next + items.length) % items.length;
        items[index].classList.add('is-active');
      };
      const start = () => {
        if (reducedMotion.matches) return;
        clearInterval(timer);
        timer = setInterval(() => show(index + 1), Number(bar.dataset.interval) || 5000);
      };
      const stop = () => clearInterval(timer);

      $('[data-announcement-prev]', bar).addEventListener('click', () => {
        show(index - 1);
        start();
      });
      $('[data-announcement-next]', bar).addEventListener('click', () => {
        show(index + 1);
        start();
      });
      bar.addEventListener('mouseenter', stop);
      bar.addEventListener('mouseleave', start);
      bar.addEventListener('focusin', stop);
      bar.addEventListener('focusout', start);
      start();
    });
  };

  /* ------------------------------------------------------------------
   * Predictive search
   * ------------------------------------------------------------------ */
  const initPredictiveSearch = (root = document) => {
    $$('[data-predictive-search]', root).forEach((form) => {
      if (form.dataset.bound || !routes.predictiveSearch) return;
      form.dataset.bound = 'true';
      const input = $('input[name="q"]', form);
      const results = document.getElementById(input.getAttribute('aria-controls'));
      let controller;

      const search = debounce(async () => {
        const term = input.value.trim();
        if (term.length < 2) {
          results.innerHTML = '';
          return;
        }
        if (controller) controller.abort();
        controller = new AbortController();
        const params = new URLSearchParams({
          q: term,
          'resources[type]': 'product,collection,page,article',
          'resources[limit]': '6',
          'resources[options][unavailable_products]': 'last',
          section_id: 'predictive-search',
        });
        try {
          const response = await fetch(`${routes.predictiveSearch}?${params}`, { signal: controller.signal });
          if (!response.ok) throw new Error(response.status);
          const content = $('[data-predictive-content]', parseHTML(await response.text()));
          results.innerHTML = content ? content.outerHTML : '';
        } catch (error) {
          if (error.name !== 'AbortError') results.innerHTML = '';
        }
      }, 250);

      input.addEventListener('input', search);
    });
  };

  /* ------------------------------------------------------------------
   * Cart drawer
   * ------------------------------------------------------------------ */
  const Cart = {
    updateCount(count) {
      $$('[data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.hidden = Number(count) === 0;
      });
    },

    render(sections) {
      const html = sections && sections['cart-drawer'];
      if (!html) return;
      const fresh = $('[data-cart-drawer-inner]', parseHTML(html));
      const current = $('[data-cart-drawer-inner]');
      if (fresh && current) current.replaceWith(fresh);
      if (fresh) this.updateCount(fresh.dataset.cartCountValue);
    },

    async add(form) {
      const button = $('[type="submit"][name="add"]', form);
      const root = form.closest('[data-product-root]') || form;
      const errorEl = $('[data-product-error]', root);
      if (errorEl) errorEl.hidden = true;
      if (button) {
        button.setAttribute('aria-busy', 'true');
        button.disabled = true;
      }

      const body = new FormData(form);
      body.append('sections', 'cart-drawer');
      body.append('sections_url', window.location.pathname);

      try {
        const response = await fetch(`${routes.cartAdd}.js`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body,
        });
        const data = await response.json();
        if (!response.ok || data.status) {
          const message = data.description || data.message || strings.error;
          if (errorEl) {
            errorEl.textContent = message;
            errorEl.hidden = false;
          } else {
            window.alert(message);
          }
          return;
        }
        this.render(data.sections);
        Drawer.open('CartDrawer', button);
        document.dispatchEvent(new CustomEvent('cart:added', { detail: data }));
      } catch (error) {
        form.submit();
      } finally {
        if (button) {
          button.removeAttribute('aria-busy');
          button.disabled = false;
        }
      }
    },

    async change(line, quantity) {
      const inner = $('[data-cart-drawer-inner]');
      if (inner) inner.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(`${routes.cartChange}.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ line, quantity, sections: ['cart-drawer'], sections_url: window.location.pathname }),
        });
        const data = await response.json();
        if (!response.ok || data.status) {
          const errorEl = $('[data-cart-error]');
          if (errorEl) {
            errorEl.textContent = data.description || data.message || strings.error;
            errorEl.hidden = false;
          }
          return;
        }
        this.render(data.sections);
        const panel = $('#CartDrawer .drawer__panel');
        if (panel) $(FOCUSABLE, panel)?.focus({ preventScroll: true });
      } catch (error) {
        window.location.href = routes.cart;
      } finally {
        const current = $('[data-cart-drawer-inner]');
        if (current) current.removeAttribute('aria-busy');
      }
    },
  };

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-product-form]');
    if (!form || theme.cartType !== 'drawer' || !document.getElementById('CartDrawer')) return;
    event.preventDefault();
    Cart.add(form);
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cart-line]');
    if (!button) return;
    event.preventDefault();
    Cart.change(Number(button.dataset.cartLine), Math.max(0, Number(button.dataset.cartQuantity)));
  });

  /* ------------------------------------------------------------------
   * Quantity steppers and the cart page
   * ------------------------------------------------------------------ */
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-qty-step]');
    if (!button) return;
    const input = $('input', button.closest('[data-qty]'));
    if (!input) return;
    const min = Number(input.min || 0);
    const next = Math.max(min, (Number(input.value) || 0) + Number(button.dataset.qtyStep));
    if (next === Number(input.value)) return;
    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const submitCartPage = debounce((form) => {
    const update = $('[data-cart-update]', form);
    if (form.requestSubmit) form.requestSubmit(update);
    else update.click();
  }, 500);

  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-cart-input]')) return;
    submitCartPage(event.target.form);
  });

  /* ------------------------------------------------------------------
   * Product page: variant picker, gallery and lightbox
   * ------------------------------------------------------------------ */
  const initProduct = (root = document) => {
    $$('[data-product-root]', root).forEach((product) => {
      if (product.dataset.bound) return;
      product.dataset.bound = 'true';
      const sectionId = product.dataset.sectionId;
      const picker = $('[data-variant-picker]', product);
      const mediaList = $('[data-media-list]', product);

      if (mediaList) initGallery(product, mediaList);
      if (!picker) return;

      const variants = JSON.parse($('[data-variants-json]', picker).textContent);
      const fieldsets = $$('fieldset', picker);
      let request;

      const selectedOptions = () => fieldsets.map((fieldset) => $('input:checked', fieldset)?.value);

      const markAvailability = (selected) => {
        fieldsets.forEach((fieldset, index) => {
          $$('input', fieldset).forEach((input) => {
            const available = variants.some(
              (variant) =>
                variant.available &&
                variant.options[index] === input.value &&
                selected.slice(0, index).every((value, i) => variant.options[i] === value)
            );
            input.classList.toggle('is-unavailable', !available);
          });
          const label = $('[data-option-selected]', fieldset);
          if (label) label.textContent = selected[index] || '';
        });
      };

      const setButton = (state) => {
        const button = $('[data-add-button]', product);
        const label = $('[data-add-button-label]', product);
        if (!button || !label) return;
        button.disabled = state !== 'available';
        label.textContent = state === 'available' ? strings.addToCart : state === 'sold-out' ? strings.soldOut : strings.unavailable;
      };

      const swap = (doc, selector) => {
        const fresh = $(`#ProductInfo-${sectionId} ${selector}`, doc);
        const current = $(selector, product);
        if (fresh && current) current.replaceWith(fresh);
      };

      picker.addEventListener('change', async () => {
        const selected = selectedOptions();
        markAvailability(selected);
        const variant = variants.find((item) => item.options.every((value, index) => value === selected[index]));

        if (!variant) {
          setButton('unavailable');
          return;
        }

        $$('input[name="id"]', product).forEach((input) => {
          input.value = variant.id;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        setButton(variant.available ? 'available' : 'sold-out');

        if (product.dataset.updateUrl === 'true') {
          window.history.replaceState({}, '', `${product.dataset.productUrl}?variant=${variant.id}`);
        }
        if (variant.media && mediaList) showMedia(mediaList, variant.media);

        if (request) request.abort();
        request = new AbortController();
        try {
          const response = await fetch(`${product.dataset.productUrl}?variant=${variant.id}&section_id=${sectionId}`, {
            signal: request.signal,
          });
          const doc = parseHTML(await response.text());
          ['[data-price]', '[data-inventory]', '.product__pickup'].forEach((selector) => swap(doc, selector));
          const freshButton = $(`#ProductInfo-${sectionId} [data-add-button]`, doc);
          if (freshButton) setButton(freshButton.disabled ? 'sold-out' : 'available');
        } catch (error) {
          /* Price stays as it was; the add-to-cart state is already correct. */
        }
      });

      markAvailability(selectedOptions());
    });
  };

  const showMedia = (list, mediaId) => {
    const item = $(`[data-media-id="${mediaId}"]`, list);
    if (!item) return;
    if (desktop.matches) {
      list.prepend(item);
    } else {
      list.scrollTo({ left: item.offsetLeft - list.offsetLeft, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  };

  const initGallery = (product, list) => {
    const dots = $$('.product__media-dot', product);
    if (dots.length) {
      list.addEventListener(
        'scroll',
        debounce(() => {
          const index = Math.round(Math.abs(list.scrollLeft) / list.clientWidth);
          dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
        }, 60),
        { passive: true }
      );
    }
  };

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-lightbox-open]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.lightboxOpen);
      if (!dialog || typeof dialog.showModal !== 'function') return;
      dialog.showModal();
      document.documentElement.classList.add('scroll-lock');
      const item = $(`[data-lightbox-item="${opener.dataset.lightboxIndex}"]`, dialog);
      if (item) item.scrollIntoView({ block: 'start' });
      return;
    }
    const dialog = event.target.closest('dialog.lightbox');
    if (dialog && (event.target.closest('[data-lightbox-close]') || event.target === dialog)) dialog.close();
  });

  document.addEventListener(
    'close',
    (event) => {
      if (event.target.matches && event.target.matches('dialog.lightbox')) document.documentElement.classList.remove('scroll-lock');
    },
    true
  );

  /* ------------------------------------------------------------------
   * Product cards: weight buttons update the shown price
   * ------------------------------------------------------------------ */
  document.addEventListener('change', (event) => {
    const input = event.target.closest('.card__variants input[name="id"]');
    if (!input) return;
    const target = $('[data-card-price-target]', input.closest('.card'));
    if (!target) return;
    const price = document.createElement('div');
    price.className = 'price';
    const current = document.createElement('span');
    current.className = 'price__current';
    current.textContent = input.dataset.cardPrice;
    price.append(current);
    if (input.dataset.cardCompare) {
      price.classList.add('price--sale');
      const compare = document.createElement('s');
      compare.className = 'price__compare';
      compare.textContent = input.dataset.cardCompare;
      price.append(compare);
    }
    target.replaceChildren(price);
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-text]');
    if (!button || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copyText);
      const label = button.textContent;
      button.textContent = button.dataset.copiedLabel;
      window.setTimeout(() => (button.textContent = label), 2000);
    } catch (error) {
      /* Clipboard blocked; the code stays visible to copy by hand. */
    }
  });

  /* ------------------------------------------------------------------
   * Sliders
   * ------------------------------------------------------------------ */
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-slider-prev], [data-slider-next]');
    if (!button) return;
    const slider = document.getElementById(button.getAttribute('aria-controls'));
    if (!slider) return;
    const step = slider.clientWidth * 0.8 * (isRTL() ? -1 : 1);
    slider.scrollBy({ left: button.hasAttribute('data-slider-next') ? step : -step, behavior: 'smooth' });
  });

  /* ------------------------------------------------------------------
   * Product recommendations
   * ------------------------------------------------------------------ */
  const initRecommendations = (root = document) => {
    $$('[data-recommendations]', root).forEach(async (container) => {
      if (container.dataset.bound || container.children.length) return;
      container.dataset.bound = 'true';
      try {
        const response = await fetch(container.dataset.url);
        const fresh = $('[data-recommendations]', parseHTML(await response.text()));
        if (fresh && fresh.innerHTML.trim()) {
          container.innerHTML = fresh.innerHTML;
          initReveal(container);
        } else {
          container.closest('.section')?.setAttribute('hidden', '');
        }
      } catch (error) {
        container.closest('.section')?.setAttribute('hidden', '');
      }
    });
  };

  /* ------------------------------------------------------------------
   * Collection and search filters
   * ------------------------------------------------------------------ */
  const facetsUrl = (form) => {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (String(value).trim() !== '') params.append(key, value);
    });
    return `${form.action.split('?')[0]}?${params}`;
  };

  const applyFacets = debounce((form) => {
    window.location.href = facetsUrl(form);
  }, 450);

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-facets-form]');
    if (!form) return;
    event.preventDefault();
    window.location.href = facetsUrl(form);
  });

  document.addEventListener('change', (event) => {
    const sort = event.target.closest('[data-sort-select]');
    if (sort) {
      if (sort.form) {
        window.location.href = facetsUrl(sort.form);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set('sort_by', sort.value);
        url.searchParams.delete('page');
        window.location.href = url.toString();
      }
      return;
    }
    const form = event.target.closest('form[data-facets-form]');
    // On mobile, filters wait for the Apply button so several can be chosen at once.
    if (form && desktop.matches) applyFacets(form);
  });

  /* ------------------------------------------------------------------
   * Small helpers: localization, share, confirm, addresses
   * ------------------------------------------------------------------ */
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-localization-select]')) event.target.form.submit();
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-share]');
    if (!button) return;
    const status = $('[data-share-status]', button.parentElement);
    const data = { title: button.dataset.shareTitle, url: button.dataset.shareUrl };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch (error) {
        /* Dismissed by the visitor. */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(data.url);
      if (status) status.textContent = strings.linkCopied;
    }
  });

  document.addEventListener('submit', (event) => {
    const button = event.submitter && event.submitter.closest('[data-confirm]');
    if (button && !window.confirm(button.dataset.confirm)) event.preventDefault();
  });

  const initAddressForms = (root = document) => {
    $$('[data-address-country]', root).forEach((country) => {
      if (country.dataset.bound) return;
      country.dataset.bound = 'true';
      const province = document.getElementById(country.dataset.provinceTarget);
      const wrapper = $(`[data-province-wrapper="${country.dataset.provinceTarget}"]`);
      if (country.dataset.default) country.value = country.dataset.default;

      const update = () => {
        const option = country.options[country.selectedIndex];
        let provinces = [];
        try {
          provinces = JSON.parse((option && option.dataset.provinces) || '[]');
        } catch (error) {
          provinces = [];
        }
        province.replaceChildren(...provinces.map(([value, label]) => new Option(label, value)));
        if (province.dataset.default) province.value = province.dataset.default;
        if (wrapper) wrapper.hidden = provinces.length === 0;
      };

      country.addEventListener('change', () => {
        province.dataset.default = '';
        update();
      });
      update();
    });
  };

  /* ------------------------------------------------------------------
   * Scroll reveal
   * ------------------------------------------------------------------ */
  let observer;
  const initReveal = (root = document) => {
    const items = $$('.reveal:not(.is-visible)', root);
    if (!document.body.classList.contains('has-animations') || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    observer =
      observer ||
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
    items.forEach((item) => observer.observe(item));
  };

  /* ------------------------------------------------------------------
   * Boot, plus theme editor support
   * ------------------------------------------------------------------ */
  const init = (root = document) => {
    initHeader(root);
    initAnnouncements(root);
    initPredictiveSearch(root);
    initProduct(root);
    initRecommendations(root);
    initAddressForms(root);
    initReveal(root);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (event) => init(event.target));
  document.addEventListener('shopify:section:select', (event) => {
    if (event.target.querySelector('#CartDrawer')) Drawer.open('CartDrawer');
  });
  document.addEventListener('shopify:section:deselect', () => {
    if (Drawer.active && Drawer.active.id === 'CartDrawer') Drawer.close(false);
  });
})();
