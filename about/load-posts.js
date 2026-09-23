// Renders the journal from posts.json. Posts are newest-first; a year
// marker is inserted whenever the year changes as you scroll down.
async function loadPosts() {
  const timeline = document.querySelector('.about-timeline');
  if (!timeline) return;

  let posts;
  try {
    const response = await fetch('posts.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    posts = await response.json();
  } catch (error) {
    console.error('Error loading posts:', error);
    timeline.replaceChildren(
      message(
        "The journal didn't load.",
        'Something went wrong fetching the posts. A refresh usually sorts it out.'
      )
    );
    return;
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    timeline.replaceChildren(message('Nothing here yet.', 'The first post is still out taking photos.'));
    return;
  }

  const nodes = [];
  let lastYear = null;
  for (const post of posts) {
    const year = yearOf(post.date);
    if (year && year !== lastYear) {
      nodes.push(yearMarker(year));
      lastYear = year;
    }
    nodes.push(createPostCard(post));
  }
  timeline.replaceChildren(...nodes);
}

// "September 2026" -> "2026". Returns null if there's no 4-digit year.
function yearOf(date) {
  const match = /\b(\d{4})\b/.exec(date || '');
  return match ? match[1] : null;
}

function yearMarker(year) {
  const el = document.createElement('h2');
  el.className = 'year-marker';
  el.textContent = year;
  return el;
}

function message(heading, body) {
  const el = document.createElement('p');
  el.className = 'timeline-message';
  el.innerHTML = `<strong></strong><span></span>`;
  el.querySelector('strong').textContent = heading;
  el.querySelector('span').textContent = body;
  return el;
}

function createPostCard(post) {
  const article = document.createElement('article');
  article.className = `post-card post-${post.layout}`;

  const content = document.createElement('div');
  content.className = 'post-content';
  content.append(
    el('h3', 'post-title', post.title),
    el('p', 'post-meta', [post.date, post.location].filter(Boolean).join(' · ')),
    el('p', 'post-text', post.text)
  );

  if (post.layout === 'text-only' || !post.image) {
    article.append(content);
    return article;
  }

  const figure = document.createElement('div');
  figure.className = 'post-image';
  const img = document.createElement('img');
  img.src = post.image;
  img.alt = post.imageAlt || '';
  img.loading = 'lazy';
  figure.append(img);
  if (post.caption) figure.append(el('p', 'image-caption', post.caption));

  // image-right is the only layout where the text comes first in the DOM;
  // the rest are handled by CSS (grid columns / stacking).
  article.append(...(post.layout === 'image-right' ? [content, figure] : [figure, content]));
  return article;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

document.addEventListener('DOMContentLoaded', loadPosts);
