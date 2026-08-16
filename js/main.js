/* ============ Shared behaviour: nav, reveal-on-scroll, terminal type-in ============ */

document.addEventListener('DOMContentLoaded', () => {
  /* Mobile nav toggle */
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.querySelector('.mobile-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      panel.classList.remove('open');
      document.body.style.overflow = '';
    }));
  }

  /* Scroll reveal */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  /* Terminal type-in effect (About hero signature element) */
  const termEl = document.getElementById('terminal-type');
  if (termEl) {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const script = [
      { t: 'prompt', v: '~/vaultofcodes $ ' , inline: true },
      { t: 'cmd', v: 'whoami --mission\n' },
      { t: 'out', v: 'We build the skills a resume can\'t fake.\n\n' },
      { t: 'prompt', v: '~/vaultofcodes $ ', inline: true },
      { t: 'cmd', v: 'ls ./what-we-teach\n' },
      { t: 'key', v: 'web-dev/  ' }, { t: 'key', v: 'data-science/  ' }, { t: 'key', v: 'dsa/  ' }, { t: 'key', v: 'cloud/\n\n' },
      { t: 'prompt', v: '~/vaultofcodes $ ', inline: true },
      { t: 'cmd', v: 'cat students.count\n' },
      { t: 'str', v: '48,200+ and counting\n' },
    ];

    if (prefersReduced) {
      termEl.innerHTML = script.map(s => `<span class="${s.t}">${s.v}</span>`).join('');
      return;
    }

    let i = 0, j = 0;
    let buffer = '';
    function typeNext() {
      if (i >= script.length) {
        termEl.innerHTML = buffer + '<span class="caret"></span>';
        return;
      }
      const seg = script[i];
      if (j === 0) buffer += `<span class="${seg.t}">`;
      if (j < seg.v.length) {
        // batch a few chars at a time for perceived speed on longer lines
        const step = seg.t === 'cmd' ? 1 : seg.v.length; // type commands char-by-char, print rest instantly
        const chunk = seg.v.slice(j, j + step);
        buffer += chunk.replace(/\n/g, '<br>');
        j += step;
        termEl.innerHTML = buffer + '<span class="caret"></span>';
        window.requestAnimationFrame(() => setTimeout(typeNext, seg.t === 'cmd' ? 28 : 4));
        return;
      } else {
        buffer += '</span>';
        i++; j = 0;
        setTimeout(typeNext, seg.t === 'cmd' ? 260 : 60);
      }
    }
    typeNext();
  }
});
