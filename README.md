# Vehicle image recolor

This project recolors the existing vehicle PNG files and writes them into GitHub-friendly folders.

Only two views are supported:

- `vehicle-side`
- `vehicles-front`

Each color gets its own folder inside those two view folders.

## Requirements

Node.js 20+

## Setup

```bash
npm install
```

## Usage

Generate both views for one color:

```bash
npm run recolor -- --color 1e90ff
```

Generate one vehicle in both views:

```bash
npm run recolor -- --vehicle adder --color 1e90ff
```

Generate a single view:

```bash
npm run recolor -- --view vehicle-side --color ff6600
```

In PowerShell, a leading `#` starts a comment, so use `ff6600` or quote the value like `"#ff6600"`.

Available views:

- `vehicle-side`
- `vehicles-front`
- `all`

CLI help:

```bash
npm run recolor -- --help
```

## Output

```text
public/
  vehicle-side/
    <color-hash>/
      *.png
      manifest.json
  vehicles-front/
    <color-hash>/
      *.png
      manifest.json
```

Example:

```text
public/vehicle-side/1e90ff/adder.png
public/vehicles-front/1e90ff/adder.png
```

## GitHub

Commit and push the `public` folder, then use the image URLs directly from GitHub.

Raw GitHub example:

```text
https://raw.githubusercontent.com/illusionrpofficial-wq/<REPO>/<BRANCH>/vehicle_pictures/public/vehicle-side/1e90ff/adder.png
```

jsDelivr example:

```text
https://cdn.jsdelivr.net/gh/illusionrpofficial-wq/<REPO>@<BRANCH>/vehicle_pictures/public/vehicle-side/1e90ff/adder.png
```

If this project is at the repo root, you can remove `vehicle_pictures/` from the URL.

## Contact

- Name: `illusionrpofficial-wq`
- Email: `illusion.rp.official@gmail.com`