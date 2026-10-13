/* Small, dependency-free motion layer. Native scrolling always stays in control. */
(() => {
  'use strict';
  const ease = 'cubic-bezier(.16,1,.3,1)';
  let current;

  function create({ enabled, intro }) {
    const root = document.documentElement;
    const hero = document.querySelector('.hero');
    const portrait = document.querySelector('.portrait-composition');
    const header = document.querySelector('.header');
    const process = document.querySelector('#process');
    const contact = document.querySelector('#contact');
    const jobs = [...document.querySelectorAll('.job')];
    const controller = new AbortController();
    const animations = new Set();
    const listAnimations = new Map();
    const revealElements = [];
    const pointerElements = [];
    const decorations = [], textRestorers = [];
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0, pointerFrame = 0, visible = !document.hidden, disposed = false;
    let observer, heroObserver, sectionObserver, stageObserver, introTimer;
    let activePointer, pointerEvent, heroVisible = false, processVisible = false, contactVisible = false;

    function listen(target, event, callback, options = {}) {
      target.addEventListener(event, callback, { ...options, signal: controller.signal });
    }
    function animate(element, frames, options = {}) {
      if (!enabled || !element || disposed) return;
      const animation = element.animate(frames, { duration: 800, easing: ease, ...options });
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
      return animation;
    }
    function settle() {
      animations.forEach(animation => {
        try { animation.finish(); } catch { animation.cancel(); }
      });
      animations.clear();
    }
    function resetPointer(element) {
      if (!element) return;
      element.classList.remove('pointer-active');
      ['--magnet-x', '--magnet-y', '--tilt-x', '--tilt-y'].forEach(name => element.style.removeProperty(name));
    }
    function ambient() {
      hero.classList.toggle('hero-in-view', enabled && visible && heroVisible);
      process.classList.toggle('section-in-view', enabled && visible && processVisible);
      contact.classList.toggle('section-in-view', enabled && visible && contactVisible);
    }

    // Decorative geometry follows the systems/data motif; it never carries content.
    const field = document.createElement('div');
    field.className = 'motion-field';
    field.setAttribute('aria-hidden', 'true');
    field.innerHTML = `<span class="motion-orb"></span><span class="motion-orb"></span>
      <svg class="motion-grid" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs><pattern id="motion-grid-pattern" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56"/></pattern></defs>
        <rect width="1200" height="760" fill="url(#motion-grid-pattern)"/>
        <path d="M620 96H920V236H1140M560 630H840V498H1130M800 36V112H1080V400"/>
        <path class="flow-trace" d="M620 96H920V236H1140" pathLength="100"/>
        <path class="flow-trace" d="M560 630H840V498H1130" pathLength="100"/>
        <circle class="flow-node" cx="920" cy="236" r="4"/><circle class="flow-node" cx="840" cy="498" r="4"/>
      </svg>`;
    hero.prepend(field);
    hero.classList.add('motion-hero');

    // A richer motion composition built from the same résumé content.
    const heading = hero.querySelector('h1');
    const firstName = heading.firstChild.textContent;
    const lastName = heading.querySelector('span').textContent;
    textRestorers.push([heading, heading.innerHTML, heading.getAttribute('aria-label')]);
    heading.setAttribute('aria-label', `${firstName} ${lastName}`);
    let characterIndex = 0;
    function letters(text, className) {
      const line = document.createElement('span');
      line.className = className;
      line.setAttribute('aria-hidden', 'true');
      Array.from(text).forEach(character => {
        const letter = document.createElement('span');
        letter.className = 'motion-char';
        letter.style.setProperty('--char-index', characterIndex++);
        letter.textContent = character === ' ' ? '\u00a0' : character;
        line.append(letter);
      });
      return line;
    }
    heading.replaceChildren(letters(firstName, 'motion-first-name'), document.createElement('br'), letters(lastName, 'motion-last-name'));
    if (intro && enabled) {
      hero.classList.add('motion-intro');
      introTimer = setTimeout(() => hero.classList.remove('motion-intro'), 2200);
    }
    document.querySelectorAll('main .section h2').forEach(title => {
      const text = title.textContent;
      textRestorers.push([title, title.innerHTML, title.getAttribute('aria-label')]);
      title.setAttribute('aria-label', text);
      title.classList.add('motion-heading');
      title.replaceChildren();
      text.split(/(\s+)/).forEach((word, index) => {
        if (/^\s+$/.test(word)) { title.append(document.createTextNode(word)); return; }
        const span = document.createElement('span');
        span.className = 'motion-word';
        span.setAttribute('aria-hidden', 'true');
        span.style.setProperty('--word-index', Math.min(index / 2, 8));
        span.textContent = word;
        title.append(span);
      });
    });

    const orbit = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    orbit.setAttribute('class', 'portrait-orbit');
    orbit.setAttribute('viewBox', '0 0 500 600');
    orbit.setAttribute('aria-hidden', 'true');
    orbit.innerHTML = `<g class="orbit-ring ring-a"><circle cx="250" cy="300" r="238"/><path d="M250 62a238 238 0 0 1 238 238"/><circle class="orbit-satellite" cx="250" cy="62" r="5"/></g>
      <g class="orbit-ring ring-b"><circle cx="250" cy="300" r="218"/><path d="M32 300a218 218 0 0 1 218-218"/><circle class="orbit-satellite" cx="250" cy="518" r="4"/></g>
      <g class="orbit-ring ring-c"><circle cx="250" cy="300" r="254"/><circle class="orbit-satellite" cx="504" cy="300" r="3"/></g>`;
    portrait.prepend(orbit);
    decorations.push(orbit);
    const tags = document.createElement('div');
    tags.className = 'portrait-tags';
    tags.setAttribute('aria-hidden', 'true');
    ['SQL', 'API', 'DATA'].forEach(text => {
      const tag = document.createElement('span');
      tag.className = 'orbit-tag';
      tag.textContent = text;
      tags.append(tag);
    });
    portrait.append(tags);
    decorations.push(tags);

    const ribbon = document.createElement('div');
    ribbon.className = 'motion-ribbon';
    ribbon.setAttribute('aria-hidden', 'true');
    const phrases = hero.querySelector('.hero-tagline').textContent.split('·').map(word => word.trim()).filter(Boolean);
    [phrases, ['SQL', 'REST API', 'Python', 'Bash']].forEach(items => {
      const lane = document.createElement('div');
      lane.className = 'ribbon-lane';
      const track = document.createElement('div');
      track.className = 'ribbon-track';
      const group = document.createElement('div');
      group.className = 'ribbon-group';
      // Each half fills wide monitors too, preserving a seamless loop.
      for (let repeat = 0; repeat < 3; repeat++) items.forEach(text => {
        const word = document.createElement('span');
        word.textContent = text;
        const symbol = document.createElement('i');
        symbol.textContent = '↗';
        group.append(word, symbol);
      });
      track.append(group, group.cloneNode(true));
      lane.append(track);
      ribbon.append(lane);
    });
    hero.append(ribbon);
    decorations.push(ribbon);
    document.querySelectorAll('.section-top').forEach(top => {
      const line = document.createElement('span');
      line.className = 'section-line';
      line.setAttribute('aria-hidden', 'true');
      top.append(line);
      decorations.push(line);
    });

    const diagram = document.createElement('div');
    diagram.className = 'stage-visual';
    diagram.setAttribute('aria-hidden', 'true');
    diagram.innerHTML = `<svg class="stage-diagram" viewBox="0 0 620 116" fill="none">
      <path class="diagram-track" d="M48 58H568"/>
      <path class="diagram-signal" d="M48 58H568" pathLength="100"/>
      <path class="diagram-flow" d="M48 58H568" pathLength="100"/>
      ${[48,178,308,438,568].map((x, index) => `<g class="diagram-node" transform="translate(${x} 58)"><circle r="21"/><text text-anchor="middle" dominant-baseline="central">0${index + 1}</text></g>`).join('')}
      </svg>`;
    process.querySelector('#stage-panel').after(diagram);
    decorations.push(diagram);
    const steps = process.querySelector('.process-steps');
    function syncDiagram() {
      const selected = steps.querySelector('[aria-selected=true]');
      const active = Number(selected?.dataset.stage || 0);
      diagram.style.setProperty('--diagram-progress', active / 4);
      diagram.querySelectorAll('.diagram-node').forEach((node, index) => {
        node.classList.toggle('active', index === active);
        node.classList.toggle('past', index < active);
      });
    }
    syncDiagram();
    stageObserver = new MutationObserver(syncDiagram);
    stageObserver.observe(steps, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });

    const revealGroups = [
      '.section-top', '.section > h2, .section > .shell > h2, .profile-layout > h2',
      '.profile-layout .lead', '.scope-stat', '.job', '.skill-card',
      '.process-steps, .stage-panel, .stage-visual', '.education-grid > article',
      '.learning-tools, .course-count', '.course', '.extras-grid > article',
      '.contact-layout > div', '.utility-actions, footer'
    ];
    revealGroups.forEach(selector => {
      document.querySelectorAll(selector).forEach((element, index) => {
        if (element.classList.contains('motion-reveal')) return;
        element.classList.add('motion-reveal');
        const grouped = element.matches('.skill-card, .scope-stat, .education-grid > article, .extras-grid > article, .contact-layout > div');
        element.style.setProperty('--reveal-delay', `${grouped ? index % 3 * 85 : 0}ms`);
        revealElements.push(element);
      });
    });
    root.classList.add('motion-ready');
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
      revealElements.forEach(element => {
        if (!enabled || element.getBoundingClientRect().top < innerHeight - 24) element.classList.add('is-visible');
        else observer.observe(element);
      });
      heroObserver = new IntersectionObserver(entries => {
        heroVisible = entries[0].isIntersecting;
        ambient();
      });
      heroObserver.observe(hero);
      sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.target === process) processVisible = entry.isIntersecting;
          if (entry.target === contact) contactVisible = entry.isIntersecting;
        });
        ambient();
      });
      sectionObserver.observe(process);
      sectionObserver.observe(contact);
    } else {
      revealElements.forEach(element => element.classList.add('is-visible'));
    }

    // Keyboard navigation never lands on hidden or transitioning content.
    listen(document, 'focusin', event => {
      const reveal = event.target.closest('.motion-reveal');
      if (reveal) {
        reveal.classList.add('is-visible');
        reveal.style.setProperty('--reveal-delay', '0ms');
        observer?.unobserve(reveal);
      }
    });

    if (intro && enabled) {
      const sequence = [
        ['.hero-top', 0], ['.hero-role-label', 70],
        ['.hero-role', 230], ['.hero-tagline', 290], ['.hero-intro', 350],
        ['.hero-actions', 410], ['.hero-copy .work-facts', 480], ['.hero-bottom', 530]
      ];
      sequence.forEach(([selector, delay]) => animate(document.querySelector(selector), [
        { opacity: 0, transform: 'translateY(26px)', filter: 'blur(5px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
      ], { delay, duration: selector === '.hero h1' ? 1100 : 900, fill: 'backwards' }));
      animate(portrait, [
        { opacity: 0, transform: 'translateY(38px) scale(.965)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ], { delay: 210, duration: 1300, fill: 'backwards' });
    }
    hero.classList.add('intro-complete');

    // One frame per pointer event batch, no perpetual JavaScript animation loop.
    function drawPointer() {
      pointerFrame = 0;
      if (!activePointer || !enabled || !finePointer.matches) return;
      const element = activePointer;
      const rect = element.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (pointerEvent.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (pointerEvent.clientY - rect.top) / rect.height));
      element.style.setProperty('--pointer-x', `${x * 100}%`);
      element.style.setProperty('--pointer-y', `${y * 100}%`);
      element.classList.add('pointer-active');
      if (element === portrait) {
        element.style.setProperty('--tilt-x', `${(0.5 - y) * 5}deg`);
        element.style.setProperty('--tilt-y', `${(x - 0.5) * 6}deg`);
      } else if (element.matches('.button')) {
        element.style.setProperty('--magnet-x', `${(x - 0.5) * 6}px`);
        element.style.setProperty('--magnet-y', `${(y - 0.5) * 5}px`);
      }
    }
    document.querySelectorAll('.portrait-composition, .skill-card, .university, .project, .hack, .languages, .button').forEach(element => {
      pointerElements.push(element);
      listen(element, 'pointermove', event => {
        if (!enabled || !finePointer.matches || event.pointerType === 'touch') return;
        if (activePointer !== element) resetPointer(activePointer);
        activePointer = element;
        pointerEvent = event;
        if (!pointerFrame) pointerFrame = requestAnimationFrame(drawPointer);
      }, { passive: true });
      listen(element, 'pointerleave', () => {
        resetPointer(element);
        if (activePointer === element) activePointer = null;
      });
    });
    listen(finePointer, 'change', () => pointerElements.forEach(resetPointer));

    function drawScroll() {
      frame = 0;
      if (disposed) return;
      const heroRect = hero.getBoundingClientRect();
      const jobRects = jobs.map(job => job.getBoundingClientRect());
      header.classList.toggle('is-scrolled', scrollY > 24);
      portrait.style.setProperty('--parallax-y', enabled && finePointer.matches && heroVisible ? `${Math.min(20, Math.max(0, -heroRect.top * 0.045))}px` : '0px');
      jobRects.forEach((rect, index) => {
        jobs[index].classList.toggle('is-passed', rect.top < innerHeight * 0.65);
        jobs[index].classList.toggle('is-active', rect.top < innerHeight * 0.65 && rect.bottom > innerHeight * 0.3);
      });
    }
    function update() { if (!frame && visible) frame = requestAnimationFrame(drawScroll); }
    listen(window, 'scroll', update, { passive: true });
    listen(window, 'resize', update, { passive: true });
    listen(document, 'visibilitychange', () => {
      visible = !document.hidden;
      ambient();
      if (visible) update();
    });
    drawScroll();

    return {
      animate,
      setEnabled(value) {
        enabled = value;
        if (!enabled) {
          settle();
          hero.classList.remove('motion-intro');
          revealElements.forEach(element => element.classList.add('is-visible'));
          pointerElements.forEach(resetPointer);
          portrait.style.setProperty('--parallax-y', '0px');
        }
        ambient();
        update();
      },
      list(rows, before) {
        rows.forEach(element => { listAnimations.get(element)?.cancel(); listAnimations.delete(element); });
        rows.forEach((element, index) => {
          if (element.hidden) return;
          element.classList.add('is-visible');
          const old = before.get(element);
          const top = element.getBoundingClientRect().top;
          const animation = animate(element, old === undefined ? [
            { opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }
          ] : [
            { transform: `translateY(${Math.max(-160, Math.min(160, old - top))}px)` }, { transform: 'translateY(0)' }
          ], { duration: 420, delay: old === undefined ? Math.min(index, 4) * 35 : 0 });
          if (animation) {
            listAnimations.set(element, animation);
            animation.finished.then(() => { if (listAnimations.get(element) === animation) listAnimations.delete(element); }, () => {});
          }
        });
      },
      dispose() {
        disposed = true;
        controller.abort();
        observer?.disconnect();
        heroObserver?.disconnect();
        sectionObserver?.disconnect();
        stageObserver?.disconnect();
        clearTimeout(introTimer);
        cancelAnimationFrame(frame);
        cancelAnimationFrame(pointerFrame);
        animations.forEach(animation => animation.cancel());
        animations.clear();
        field.remove();
        decorations.forEach(element => element.remove());
        textRestorers.forEach(([element, html, label]) => {
          element.innerHTML = html;
          element.classList.remove('motion-heading');
          if (label === null) element.removeAttribute('aria-label');
          else element.setAttribute('aria-label', label);
        });
        hero.classList.remove('motion-intro');
      }
    };
  }

  window.ResumeMotion = {
    mount(options) { current?.dispose(); current = create(options); },
    dispose() { current?.dispose(); current = null; },
    setEnabled(value) { current?.setEnabled(value); },
    animate(...args) { return current?.animate(...args); },
    list(...args) { current?.list(...args); }
  };
})();
