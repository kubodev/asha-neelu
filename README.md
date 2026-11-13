# Malkapuram Village Atlas

An interactive Stage 1 model of the Malkapuram study area in Andhra Pradesh, built from the 20 supplied screenshots. The measured study boundary covers approximately 3.53 hectares. The view includes the entire marked area and surrounding context. The administrative boundary of the larger village was not supplied.

## Run locally

From the Sociathon folder, run the following command and open http://127.0.0.1:8045 in a WebGL-capable browser.

```sh
python3 -m http.server 8045 --bind 127.0.0.1 --directory village-atlas/dist
```

The application uses local assets and native JavaScript modules. It needs an HTTP server and requires no package installation, API key or build step. For static hosting, publish the contents of `dist`.

## Explore and correct the model

- Drag to orbit, Shift-drag to pan and scroll to zoom. Use the camera selector for the orthographic map, 3D Walkthrough and free-fly.
- Walk on traced roads with WASD or the arrow keys. Hold Shift for faster travel, drag to look or explicitly activate mouse-look. In free-fly, Q and E move vertically. Fit village recovers the opening view.
- Select an individual feature to inspect its source and confidence. Use **Edit feature** to change its name, notes, offset, rotation, scale or approximate height.
- Open **Working configuration** from the overview, About model or Help. Add and move reference markers, edit tour stops, undo corrections, export or import JSON, or restore the baseline. Edits are stored in the current browser. Export the configuration to carry them to another browser. Undo history lasts for the current session.
- The field findings concern the village as a whole. The well, pipeline gaps and power interruptions have no confirmed household-level locations.

## References and geography

[Reference inventory](REFERENCES.md) lists every supplied screenshot, its coverage, orientation, date where known, visible features and uncertainties. [Geography notes](GEOGRAPHY.md) describe image registration, scale and digitisation. The baseline includes 74 roof envelopes, 11 roads and lanes, one reservoir, 114 canopy envelopes, 10 land and bank areas and three map-labelled landmarks. A canopy envelope can represent a group of trees.

The overheads establish visible arrangement. Roof heights, unseen walls, small-scale relief and photo placements are approximate. Buildings under vegetation and indistinct adjoining roofs remain unresolved. The darker water and greenish patch are visible from above. No supplied ground photograph establishes an unobstructed water surface or water quality.

## Update images and add stages

1. Keep original screenshots in the sibling `img/` folder. Optimised reference images and thumbnails live in `dist/assets/photos/` and `dist/assets/references/`. Preserve visible source credits. Add or update entries in `dist/photos.js` with their paths, stable IDs, location confidence, direction, date and evidence notes.
2. Edit permanent geometry in `tools/prepare_geography.py` and regenerate the baseline following GEOGRAPHY.md. Browser corrections use separate overrides. The stable feature IDs and local east/south coordinates link edits, viewpoints and tour stops.
3. Stage definitions in `dist/configuration.js` contain additions, removals and property overrides. The interface activates configured stages and passes applyEdits(configuration, stageId) to scene.setFeatures. Stage 2 combines the river supply blueprint, pond treatment, tank and household distribution, solar electricity and sensor automation. Choose **Start guided tour** to frame each stop automatically. Click **Next** when you are ready to continue. **Village systems** exposes the live demo readings, fault controls and session event log. Equipment ratings, flows, capacities and sensor readings are illustrative. The stageFeatures function composes its changes against the baseline. Retain Stage 1 for recovery. Store revised water colour on the water feature and use its waterAppearance override for referenceMix, clarity, rippleStrength and bankWidth. The baseline material defaults live in dist/water.js.

The renderer, navigation and orientation inset are in the scene modules. The HTML, interface styles and interaction code live in `dist/index.html`, `dist/style.css` and `dist/app.js`.

## Building exteriors and walking collisions

`dist/scene-buildings.js` adds reference-inspired rural façades to the existing roof envelopes: muted plaster, concrete parapets, doors, window grilles, ventilation blocks, corrugated awnings, entrance steps and occasional rooftop tanks. These details are illustrative, not surveyed household attributes. Footprints, configured heights and feature IDs remain unchanged. Entrance faces follow nearby roads; details vary deterministically by building ID. The renderer uses procedural materials with no additional downloads.

`dist/scene-collision.js` shares the entrance-step layout with the renderer. Walking uses approximately 30 cm body clearance, swept movement checks and wall sliding. Navigation obstacles rebuild after feature edits. Existing road-constrained walking and free-fly controls are retained.

Run the geometry and collision regression checks with `node --test tests/buildings.test.mjs` from this directory.

The model's terrain materials now stay active in both aerial and walking views, rather than fading back to the low-resolution source screenshot. High render quality is the default, using at least 2× supersampling where the pixel budget allows (maximum 5120 pixels per side and 12 megapixels). Medium and low quality remain available in Help. The original Source imagery layer is unchanged; new soil detail and field furrows are illustrative materials, not newly surveyed imagery.

The reservoir now has an illustrative dark-metal grill fence around the modeled bank, with a road-side access opening. The fence is included in walkthrough collision geometry.

The current-condition reservoir surface uses an illustrative stagnant-water appearance with opaque silt, algae mats and muddy banks. It represents reported concerns visually and is not a water-quality measurement or verified claim.

Stage 2 is available and adds a single illustrative floating solar-panel array to the reservoir. The array is the only Stage 2 addition; aquatic plants, tanks, pumps and distribution works are not included yet. Its footprint fits inside the traced water outline. Panel size and placement are conceptual pending engineering and reservoir-use review.
