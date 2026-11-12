# Baseline geography

The measured outline in the two 9:55 screenshots identifies a 35,317.76 m² study area around the Malkapuram reservoir. The images cover part of the settlement. No administrative village boundary was supplied. The rectangular model includes this entire outline and a margin of nearby buildings and plots.

## Coordinates and scale

The satellite screenshot at 9:55:38 PM is the registration frame. Resize it proportionally to 1300 pixels wide. The model covers x = 310…1070 and y = 75…654.88 in that view. Convert a pixel to local coordinates with x = (pixelX − 690)/0.76 and z = (pixelY − 364.94)/0.76. Positive x points right, positive z points down and image-up is assumed north. Local units are approximately 0.321485 m, estimated by matching the traced study polygon area to the screenshot's displayed area. Rounding, tracing uncertainty and screenshot projection limit precision. The images contain no surveyed heights.

The overhead at 9:53:31 PM and the unlabelled 7:49:13 PM overhead were aligned by comparing image edges. The closer unlabelled image supplies most of the roofs and eastern bank. Where overlays cover a source, the mosaic uses the clearest aligned view available. Map labels, measurement lines and seams remain visible in parts of the optional reference layer.

## Model content

The baseline contains 74 individually traced roof envelopes, 11 road polylines, 10 land and bank polygons, 114 approximate canopy envelopes and one irregular reservoir. Three supplied map labels identify Malkapuram pillar (Shaiva matha), Jai Surya Hostel and Emmanuel Church. Their pins locate labelled places approximately. The data does not identify their specific entrance or building footprint. Small outbuildings under foliage or obscured by labels and joined roof boundaries may remain unresolved.

The fields and tree belt to the west, the irregular pond, the bank road and the southern street grid establish the main spatial relationships. The working ground texture retains observed field rows, road shoulders, exposed-soil texture and canopy variation. A local interpolation mask removes traced roof images and prominent baked map graphics. Colours and local contrast have been adjusted for legibility. The source imagery layer keeps the original screenshot colours and visible map overlays. Roof edges, tree positions and road surfaces are visually interpreted. Building heights, foliage forms, unseen walls and the profile of the banks are approximate. The street photographs show dry dusty shoulders, open drains and varied road finishes at specific viewpoints. Their locations do not establish a continuous drainage network or bank elevation. A greenish northwest patch and darker water are visible from above. The cause of this contrast and water quality are unknown.

## Revising the source

To revise a permanent footprint, edit the corresponding roof polygon in tools/prepare_geography.py. Polygon coordinates in the digitisation lists use a 1200-pixel-wide version of the registered mosaic, with the origin at its upper-left. Preserve existing array order and append new features so stable feature IDs remain consistent. The source timestamp lookup keeps each original overhead in a fixed registration slot when new photos are added. Match replacements to those originals or update TIMES and its registration values for a new frame.

Run the script with Python, Pillow and NumPy installed. It regenerates dist/geography.js, dist/assets/ground.jpg and dist/assets/satellite.jpg. Server-side generation, a live map service and these Python dependencies are unnecessary to run the application.

The supplied screenshots display Google Maps imagery. Visible satellite attribution includes Airbus and Maxar Technologies. Full screenshot references preserve their attribution strips.
