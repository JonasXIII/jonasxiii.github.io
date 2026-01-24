# About Me Page - Blog Post Guide

This guide shows you how to add stories and images to your About Me page.

## How to Add Your Own Content

The page has **4 different post layouts** you can use. Simply copy one of these templates and replace the content with your own!

### 1. Image on Left Layout

```html
<article class="post-card post-image-left">
    <div class="post-image">
        <img src="path/to/your/image.jpg" alt="Description of image">
        <p class="image-caption">Your image caption here</p>
    </div>
    <div class="post-content">
        <h2 class="post-title">Your Story Title</h2>
        <p class="post-date">January 2024</p>
        <p class="post-text">
            Write your story here. You can make it as long or short as you like.
            The image will appear on the left side of the text.
        </p>
    </div>
</article>
```

### 2. Image on Right Layout

```html
<article class="post-card post-image-right">
    <div class="post-content">
        <h2 class="post-title">Your Story Title</h2>
        <p class="post-date">February 2024</p>
        <p class="post-text">
            Your story text here. The image will appear on the right side.
        </p>
    </div>
    <div class="post-image">
        <img src="path/to/your/image.jpg" alt="Description of image">
        <p class="image-caption">Your caption</p>
    </div>
</article>
```

### 3. Full-Width Image with Text Below

```html
<article class="post-card post-full-width">
    <div class="post-image">
        <img src="path/to/your/wide-image.jpg" alt="Description">
        <p class="image-caption">Caption for your wide image</p>
    </div>
    <div class="post-content">
        <h2 class="post-title">Your Story Title</h2>
        <p class="post-date">March 2024</p>
        <p class="post-text">
            Great for landscape photos or important moments. The image takes
            up the full width, with text below.
        </p>
    </div>
</article>
```

### 4. Text Only (No Image)

```html
<article class="post-card post-text-only">
    <div class="post-content">
        <h2 class="post-title">A Reflection</h2>
        <p class="post-date">April 2024</p>
        <p class="post-text">
            Sometimes you just want to share thoughts without a photo.
            This layout is perfect for that!
        </p>
    </div>
</article>
```

## Adding Your Images

### Option 1: Store Images in Your Project
1. Create a folder called `images` in your MySite directory
2. Put your photos in there
3. Reference them like: `src="images/my-photo.jpg"`

### Option 2: Use Online Images
- You can use any image URL from the web
- Example: `src="https://example.com/image.jpg"`

## Tips

- **Alternate layouts** - Use image-left, then image-right, then image-left again for a nice flowing effect
- **Keep images consistent** - Try to use similar aspect ratios (like all 4:3 or all 16:9)
- **Write meaningful captions** - The caption appears overlaid on the bottom of each image
- **Mobile friendly** - On phones, all images automatically move above the text

## Features

- **Hover effects** - Images zoom slightly when you hover
- **Fade-in animation** - Posts fade in as you scroll
- **Shadow effects** - Cards lift up when you hover over them
- **Responsive** - Automatically adjusts for tablets and phones

## Example: Adding a Story About a Trip

```html
<article class="post-card post-image-left">
    <div class="post-image">
        <img src="images/hawaii-beach.jpg" alt="Sunset on the beach in Hawaii">
        <p class="image-caption">Sunset at Waikiki Beach, December 2023</p>
    </div>
    <div class="post-content">
        <h2 class="post-title">My Trip to Hawaii</h2>
        <p class="post-date">December 2023</p>
        <p class="post-text">
            I spent two weeks in Hawaii exploring the islands. This photo was taken
            on my last evening there, watching the sun set over the Pacific Ocean.
            It was one of the most beautiful moments of my life, and I'll never forget
            the sound of the waves and the warm breeze.
        </p>
    </div>
</article>
```

Just copy any of these templates, paste them into your about.html file inside the `<div class="about-timeline">` section, and replace the content with your own!
