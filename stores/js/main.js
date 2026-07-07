// main.js - Chain Store Map. Real US locations for 10 chains, sourced from
// OpenStreetMap (see ../../scripts/fetch_store_locations.py), rendered with
// MapLibre GL's built-in clustering (dots merge into numbered bubbles on
// zoom-out, same behavior as a typical corporate store locator).
//
// maplibregl is loaded as a classic global script in index.html (MapLibre's
// own tested UMD build) rather than imported here - MapLibre uses a Web
// Worker internally for tile/glyph parsing, and a jsDelivr "+esm" auto-wrap
// of that broke the worker bundle in testing (obscure "Unimplemented type"
// parse errors). The official UMD build sidesteps that entirely.
const maplibregl = window.maplibregl;

// Color assignment follows the dataviz skill's 8-slot validated categorical
// palette. Two chains (Burger King, Red Robin) reuse a hue from earlier in
// the list rather than inventing a 9th/10th hue - they're told apart by a
// distinct heavy dark outline instead (a secondary encoding), and every
// chain's name is always visible as text in the toggle list regardless.
const CHAINS = [
  { slug: 'walmart', name: 'Walmart', color: '#2a78d6' },
  { slug: 'target', name: 'Target', color: '#e34948' },
  { slug: 'mcdonalds', name: "McDonald's", color: '#eda100' },
  { slug: 'aldi', name: 'Aldi', color: '#eb6834' },
  { slug: 'trader-joes', name: "Trader Joe's", color: '#008300' },
  { slug: 'kroger', name: 'Kroger', color: '#4a3aa7' },
  { slug: 'safeway', name: 'Safeway', color: '#1baf7a' },
  { slug: 'jimmy-johns', name: "Jimmy John's", color: '#e87ba4' },
  { slug: 'burger-king', name: 'Burger King', color: '#4a3aa7', reused: true },
  { slug: 'red-robin', name: 'Red Robin', color: '#e87ba4', reused: true },
];

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        ],
        tileSize: 256,
        attribution:
          '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap', minzoom: 0, maxzoom: 20 }],
    // Font glyphs for the cluster count labels. fonts.openmaptiles.org (the
    // commonly-referenced free glyph service) now serves an HTML landing
    // page instead of real glyph PBFs - discovered via testing, since it
    // still returns HTTP 200 (just the wrong content) rather than a clean
    // error. MapLibre's own demo-tiles glyph server is confirmed working.
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },
  center: [-98.5, 39.8], // roughly the center of the contiguous US
  zoom: 3.4,
  minZoom: 2,
  maxZoom: 16,
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.on('error', (e) => console.error('MAP ERROR:', e.error && e.error.message, e.error && e.error.stack));

function sourceId(slug) {
  return `${slug}-src`;
}
function clusterLayerId(slug) {
  return `${slug}-clusters`;
}
function countLayerId(slug) {
  return `${slug}-count`;
}
function pointLayerId(slug) {
  return `${slug}-point`;
}

async function loadChainData(chain) {
  try {
    const res = await fetch(`data/${chain.slug}.json`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function toGeoJson(records) {
  return {
    type: 'FeatureCollection',
    features: records.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: { name: r.name, address: r.address, city: r.city, state: r.state },
    })),
  };
}

function addChainLayers(chain, geojson) {
  const strokeColor = chain.reused ? '#1a1a1a' : '#ffffff';
  const strokeWidth = chain.reused ? 2.5 : 1.5;

  map.addSource(sourceId(chain.slug), {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 13,
  });

  map.addLayer({
    id: clusterLayerId(chain.slug),
    type: 'circle',
    source: sourceId(chain.slug),
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': chain.color,
      'circle-opacity': 0.85,
      'circle-stroke-color': strokeColor,
      'circle-stroke-width': strokeWidth,
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24, 200, 32],
    },
  });

  map.addLayer({
    id: countLayerId(chain.slug),
    type: 'symbol',
    source: sourceId(chain.slug),
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
    },
    paint: { 'text-color': '#ffffff' },
  });

  map.addLayer({
    id: pointLayerId(chain.slug),
    type: 'circle',
    source: sourceId(chain.slug),
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': chain.color,
      'circle-radius': 6,
      'circle-stroke-color': strokeColor,
      'circle-stroke-width': strokeWidth,
    },
  });

  // Click a cluster bubble -> zoom in until it breaks apart.
  map.on('click', clusterLayerId(chain.slug), async (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId(chain.slug)] });
    const clusterId = features[0].properties.cluster_id;
    const source = map.getSource(sourceId(chain.slug));
    const zoom = await source.getClusterExpansionZoom(clusterId);
    map.easeTo({ center: features[0].geometry.coordinates, zoom });
  });

  // Click an individual store -> popup with its name/address.
  map.on('click', pointLayerId(chain.slug), (e) => {
    const feature = e.features[0];
    const { name, address, city, state } = feature.properties;
    const line2 = [address, [city, state].filter(Boolean).join(', ')].filter(Boolean).join(', ');
    new maplibregl.Popup()
      .setLngLat(feature.geometry.coordinates)
      .setHTML(`<div class="stores-popup"><strong>${escapeHtml(name)}</strong>${escapeHtml(line2)}</div>`)
      .addTo(map);
  });

  for (const layerId of [clusterLayerId(chain.slug), pointLayerId(chain.slug)]) {
    map.on('mouseenter', layerId, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layerId, () => (map.getCanvas().style.cursor = ''));
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function setChainVisible(slug, visible) {
  const value = visible ? 'visible' : 'none';
  for (const layerId of [clusterLayerId(slug), countLayerId(slug), pointLayerId(slug)]) {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', value);
  }
}

function buildToggleList(chainsWithCounts) {
  const container = document.getElementById('chain-toggle-list');
  container.innerHTML = '';
  for (const chain of chainsWithCounts) {
    const hasData = chain.count > 0;
    const row = document.createElement('label');
    row.className = 'chain-toggle-row' + (hasData ? '' : ' no-data');
    row.innerHTML = `
      <input type="checkbox" data-slug="${chain.slug}" ${hasData ? 'checked' : 'disabled'}>
      <span class="chain-swatch" style="background:${chain.color}"></span>
      <span class="chain-name">${chain.name}</span>
      <span class="chain-count">${hasData ? chain.count.toLocaleString() : 'no data'}</span>
    `;
    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', () => setChainVisible(chain.slug, checkbox.checked));
    container.appendChild(row);
  }
}

function wireBulkButtons() {
  document.getElementById('select-all-btn').addEventListener('click', () => {
    document.querySelectorAll('#chain-toggle-list input[type="checkbox"]:not(:disabled)').forEach((cb) => {
      cb.checked = true;
      setChainVisible(cb.dataset.slug, true);
    });
  });
  document.getElementById('select-none-btn').addEventListener('click', () => {
    document.querySelectorAll('#chain-toggle-list input[type="checkbox"]:not(:disabled)').forEach((cb) => {
      cb.checked = false;
      setChainVisible(cb.dataset.slug, false);
    });
  });
}

map.on('load', async () => {
  const chainsWithCounts = [];
  for (const chain of CHAINS) {
    const records = await loadChainData(chain);
    addChainLayers(chain, toGeoJson(records));
    chainsWithCounts.push({ ...chain, count: records.length });
  }
  buildToggleList(chainsWithCounts);
  wireBulkButtons();
});
