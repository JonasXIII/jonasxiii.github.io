// load-header-footer.js - injects the shared header/footer into every page
// and marks the current page in the nav.
window.addEventListener('DOMContentLoaded', () => {
    // Pages live at most one directory deep (/, /about/, /kingdom/, ...), so
    // the path back to the root is one '../' per directory below the root.
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const rootPath = depth > 0 ? '../'.repeat(depth) : './';

    // "/about/index.html" and "/about" both mean the same page.
    const normalize = (path) => path.replace(/index\.html$/, '').replace(/\/?$/, '/');
    const here = normalize(window.location.pathname);

    const load = (containerId, file, tag, className) =>
        fetch(rootPath + file)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then((html) => {
                const container = document.getElementById(containerId);
                if (!container) return;
                const el = document.createElement(tag);
                el.className = className;
                el.innerHTML = html;
                container.replaceWith(el);
            })
            .catch((err) => console.error(`Error loading ${file}:`, err));

    load('header-container', 'header.html', 'header', 'site-header').then(() => {
        document.querySelectorAll('.site-header a[href]').forEach((link) => {
            const href = link.getAttribute('href');
            if (href.startsWith('http') || href.startsWith('/')) return;
            link.setAttribute('href', rootPath + href);
            if (normalize(new URL(link.href).pathname) === here) {
                link.setAttribute('aria-current', 'page');
            }
        });
    });

    load('footer-container', 'footer.html', 'footer', 'site-footer');
});
