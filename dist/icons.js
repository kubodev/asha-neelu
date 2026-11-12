const paths = {
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18"/>',
  map: '<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15m6-12v15"/>',
  layers: '<path d="m2 8 10-5 10 5-10 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10M7.5 4.5l9 5"/>',
  photo:
    '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 3 3 4-5 6 7"/>',
  notes: '<path d="M6 3h12v18H6zM9 7h6M9 11h6m-6 4h3"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  play: '<path d="m8 4 11 8-11 8z"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M4 12h16m-8-8v16"/>',
  minus: '<path d="M4 12h16"/>',
  fit: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/><circle cx="12" cy="12" r="2"/>',
  full: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  panel:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  water:
    '<path d="M2 9q3 3 6 0 3 3 6 0 3 3 8 0M2 14q3 3 6 0 3 3 6 0 3 3 8 0"/>',
  temple: '<path d="m2 9 10-6 10 6zM5 11v7m5-7v7m4-7v7m5-7v7M3 21h18"/>',
  road: '<path d="m7 3-4 18m14-18 4 18M12 3v4m0 3v4m0 3v4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  walk: '<circle cx="13" cy="4" r="1.6"/><path d="m7 12 3-4 4 1 2 4 3 1m-6-5-2 6 4 6m-4-6-4 6"/>',
  fly: '<path d="m2 10 20-7-7 19-3-9zM12 13l10-10"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  edit: '<path d="m4 16 12-12 4 4L8 20l-5 1z"/>',
  tree: '<path d="m12 2 7 10h-3l5 6H3l5-6H5zM12 18v4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  timeline: '<path d="M4 9h16M7 5v8m5-8v8m5-8v8M4 17h16"/>',
  monitor:
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-5 0h10"/>',
  building: '<path d="m3 11 9-8 9 8M5 10v11h14V10m-9 11v-7h4v7"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  book: '<path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3zM12 6v15"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
export const icon = (name, size = 18) =>
  '<svg aria-hidden="true" width="' +
  size +
  '" height="' +
  size +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
  (paths[name] || paths.map) +
  "</svg>";
