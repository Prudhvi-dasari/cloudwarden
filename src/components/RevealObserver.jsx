import { useEffect } from 'react';

/**
 * Marks every [data-reveal] element with data-in once it scrolls into view.
 * The attribute lives outside React's props, so re-renders keep it.
 */
export default function RevealObserver() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reveal = (el) => el.setAttribute('data-in', '');

    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(reveal);
      return undefined;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    const watch = (root) => {
      if (!(root instanceof Element)) return;
      if (root.matches('[data-reveal]:not([data-in])')) io.observe(root);
      root.querySelectorAll('[data-reveal]:not([data-in])').forEach((el) => io.observe(el));
    };

    watch(document.body);
    const mo = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(watch));
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
