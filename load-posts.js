// Load and render blog posts from posts.json
function getPostsRootPath() {
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  return depth > 0 ? '../'.repeat(depth) : './';
}

async function loadPosts() {
  try {
    const rootPath = getPostsRootPath();
    const response = await fetch(rootPath + 'posts.json');
    const posts = await response.json();
    const timeline = document.querySelector('.about-timeline');

    if (!timeline) {
      console.error('Timeline container not found');
      return;
    }

    // Clear existing content
    timeline.innerHTML = '';

    // Render each post
    posts.forEach(post => {
      const article = createPostCard(post, rootPath);
      timeline.appendChild(article);
    });
  } catch (error) {
    console.error('Error loading posts:', error);
  }
}

function createPostCard(post, rootPath) {
  const image = post.image ? rootPath + post.image : '';
  const article = document.createElement('article');
  article.className = `post-card post-${post.layout}`;

  if (post.layout === 'text-only') {
    // Text-only layout
    article.innerHTML = `
      <div class="post-content">
        <h2 class="post-title">${escapeHtml(post.title)}</h2>
        <p class="post-date">${escapeHtml(post.date)}</p>
        <p class="post-text">${escapeHtml(post.text)}</p>
      </div>
    `;
  } else if (post.layout === 'image-left') {
    // Image on left layout
    article.innerHTML = `
      <div class="post-image">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(post.imageAlt)}">
        <p class="image-caption">${escapeHtml(post.caption)}</p>
      </div>
      <div class="post-content">
        <h2 class="post-title">${escapeHtml(post.title)}</h2>
        <p class="post-date">${escapeHtml(post.date)}</p>
        <p class="post-text">${escapeHtml(post.text)}</p>
      </div>
    `;
  } else if (post.layout === 'image-right') {
    // Image on right layout
    article.innerHTML = `
      <div class="post-content">
        <h2 class="post-title">${escapeHtml(post.title)}</h2>
        <p class="post-date">${escapeHtml(post.date)}</p>
        <p class="post-text">${escapeHtml(post.text)}</p>
      </div>
      <div class="post-image">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(post.imageAlt)}">
        <p class="image-caption">${escapeHtml(post.caption)}</p>
      </div>
    `;
  } else if (post.layout === 'full-width') {
    // Full-width layout
    article.innerHTML = `
      <div class="post-image">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(post.imageAlt)}">
        <p class="image-caption">${escapeHtml(post.caption)}</p>
      </div>
      <div class="post-content">
        <h2 class="post-title">${escapeHtml(post.title)}</h2>
        <p class="post-date">${escapeHtml(post.date)}</p>
        <p class="post-text">${escapeHtml(post.text)}</p>
      </div>
    `;
  }

  return article;
}

// Helper function to escape HTML and prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load posts when the page loads
document.addEventListener('DOMContentLoaded', loadPosts);
