// load-header-footer.js
window.addEventListener('DOMContentLoaded', (event) => {
    // Load header
    fetch('./header.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('header-container').innerHTML = data;
        })
        .catch(err => console.error("Error loading header: ", err));

    // Load footer
    fetch('./footer.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('footer-container').innerHTML = data;
        })
        .catch(err => console.error("Error loading footer: ", err));
});
