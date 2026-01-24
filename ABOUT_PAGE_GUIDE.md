# About Me Page - Blog Post Guide

This guide shows you how to add stories and images to your About Me page.

## How to Add Your Own Content

The page has **4 different post layouts** you can use. All posts are managed through the `posts.json` file - no HTML editing required!

### Quick Start: Edit posts.json

Simply open `posts.json` and add your story as a new object in the array. The page will automatically load and display your posts.

## Post Layouts

### 1. Image on Left Layout

Add this to your `posts.json` array:

```json
{
  "layout": "image-left",
  "title": "Your Story Title",
  "date": "January 2024",
  "image": "path/to/your/image.jpg",
  "imageAlt": "Description of image",
  "caption": "Your image caption here",
  "text": "Write your story here. You can make it as long or short as you like. The image will appear on the left side of the text."
}
```

### 2. Image on Right Layout

```json
{
  "layout": "image-right",
  "title": "Your Story Title",
  "date": "February 2024",
  "image": "path/to/your/image.jpg",
  "imageAlt": "Description of image",
  "caption": "Your caption",
  "text": "Your story text here. The image will appear on the right side."
}
```

### 3. Full-Width Image with Text Below

```json
{
  "layout": "full-width",
  "title": "Your Story Title",
  "date": "March 2024",
  "image": "path/to/your/wide-image.jpg",
  "imageAlt": "Description",
  "caption": "Caption for your wide image",
  "text": "Great for landscape photos or important moments. The image takes up the full width, with text below."
}
```

### 4. Text Only (No Image)

```json
{
  "layout": "text-only",
  "title": "A Reflection",
  "date": "April 2024",
  "text": "Sometimes you just want to share thoughts without a photo. This layout is perfect for that!"
}
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

Open `posts.json` and add this object to the array:

```json
{
  "layout": "image-left",
  "title": "My Trip to Hawaii",
  "date": "December 2023",
  "image": "images/hawaii-beach.jpg",
  "imageAlt": "Sunset on the beach in Hawaii",
  "caption": "Sunset at Waikiki Beach, December 2023",
  "text": "I spent two weeks in Hawaii exploring the islands. This photo was taken on my last evening there, watching the sun set over the Pacific Ocean. It was one of the most beautiful moments of my life, and I'll never forget the sound of the waves and the warm breeze."
}
```

Your complete `posts.json` file should look like this:

```json
[
  {
    "layout": "image-left",
    "title": "My Trip to Hawaii",
    "date": "December 2023",
    "image": "images/hawaii-beach.jpg",
    "imageAlt": "Sunset on the beach in Hawaii",
    "caption": "Sunset at Waikiki Beach, December 2023",
    "text": "I spent two weeks in Hawaii exploring the islands..."
  },
  {
    "layout": "image-right",
    "title": "Another Story",
    "date": "January 2024",
    "image": "images/another-photo.jpg",
    "imageAlt": "Description",
    "caption": "Caption text",
    "text": "Your next story here..."
  }
]
```

Just add or remove objects from the array, and the page will automatically update!
