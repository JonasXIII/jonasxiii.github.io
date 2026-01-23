// load-header-footer.js
window.addEventListener('DOMContentLoaded', (event) => {
    // Determine the path to the root directory
    function getRootPath() {
        const path = window.location.pathname;
        const depth = (path.match(/\//g) || []).length - 1;
        return depth > 0 ? '../'.repeat(depth) : './';
    }

    const rootPath = getRootPath();

    // Load header
    fetch(rootPath + 'header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('header-container').innerHTML = data;

            // Fix navigation links to work from subdirectories
            const navLinks = document.querySelectorAll('header nav a');
            navLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('/')) {
                    link.setAttribute('href', rootPath + href);
                }
            });
        })
        .catch(err => console.error("Error loading header: ", err));

    // Load footer
    fetch(rootPath + 'footer.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('footer-container').innerHTML = data;
        })
        .catch(err => console.error("Error loading footer: ", err));
});
