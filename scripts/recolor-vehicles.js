const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const DEFAULT_INPUT_ROOT = path.join(__dirname, '..', 'vehicles');
const DEFAULT_OUTPUT_ROOT = path.join(__dirname, '..', 'public');
const VIEW_ALIASES = new Map([
  ['vehicle-side', 'vehicle-side'],
  ['side', 'vehicle-side'],
  ['vehicles-front', 'vehicles-front'],
  ['front', 'vehicles-front'],
  ['all', 'all'],
  ['both', 'all']
]);
const ALLOWED_VIEWS = ['vehicle-side', 'vehicles-front'];

function getHelpText() {
  return [
    'Usage: npm run recolor -- --color <hex> [--vehicle <name>] [--view <view>] [--output <path>]',
    '',
    'Views:',
    '  vehicle-side',
    '  vehicles-front',
    '  all',
    '',
    'Examples:',
    '  npm run recolor -- --color 1e90ff',
    '  npm run recolor -- --vehicle adder --color 1e90ff',
    '  npm run recolor -- --view vehicle-side --color ff6600',
    '  PowerShell: use ff6600 or quote the value, for example "#ff6600"'
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${getHelpText()}\n`);
    process.exit(0);
  }

  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for argument --${key}`);
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

function normalizeView(view) {
  if (!view) {
    return 'all';
  }

  const normalized = VIEW_ALIASES.get(view.trim().toLowerCase());

  if (normalized) {
    return normalized;
  }

  throw new Error(`Unsupported view: ${view}. Use side, front, all, vehicle-side or vehicles-front.`);
}

function parseHexColor(value) {
  const normalized = value.trim().replace(/^#/, '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid hex color: ${value}. Use a 6 digit hex value like #ff5500.`);
  }

  return {
    hex: `#${normalized.toLowerCase()}`,
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getInputDirectory(root, view) {
  if (view === 'vehicles-front') {
    return path.join(root, 'vehicles-front', 'vehicles');
  }

  return path.join(root, 'vehicle-side');
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function getVehicleFiles(inputDirectory, vehicleName) {
  const normalizedVehicle = vehicleName ? vehicleName.trim().toLowerCase() : null;

  if (normalizedVehicle) {
    return [path.join(inputDirectory, `${normalizedVehicle}.png`)];
  }

  const entries = await fs.readdir(inputDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => path.join(inputDirectory, entry.name))
    .sort();
}

async function recolorImage(inputFile, outputFile, color) {
  const image = sharp(inputFile).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);

  for (let offset = 0; offset < output.length; offset += info.channels) {
    const alpha = output[offset + 3];

    if (alpha === 0) {
      continue;
    }

    const red = output[offset];
    const green = output[offset + 1];
    const blue = output[offset + 2];
    const brightness = (red + green + blue) / (255 * 3);

    output[offset] = Math.round(color.red * brightness);
    output[offset + 1] = Math.round(color.green * brightness);
    output[offset + 2] = Math.round(color.blue * brightness);
  }

  await sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  }).png().toFile(outputFile);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const color = parseHexColor(args.color || '#ff5500');
  const view = normalizeView(args.view || 'all');
  const inputRoot = path.resolve(args.input || DEFAULT_INPUT_ROOT);
  const outputRoot = path.resolve(args.output || DEFAULT_OUTPUT_ROOT);
  const selectedViews = view === 'all' ? ALLOWED_VIEWS : [view];
  const generatedByView = {};

  for (const currentView of selectedViews) {
    const inputDirectory = getInputDirectory(inputRoot, currentView);
    const outputDirectory = path.join(outputRoot, currentView, color.hex.slice(1));
    const vehicleFiles = await getVehicleFiles(inputDirectory, args.vehicle || null);

    await ensureDirectory(outputDirectory);

    if (vehicleFiles.length === 0) {
      throw new Error(`No PNG files found in ${inputDirectory}`);
    }

    const generated = [];

    for (const inputFile of vehicleFiles) {
      try {
        await fs.access(inputFile);
      } catch {
        throw new Error(`Vehicle image not found: ${inputFile}`);
      }

      const fileName = path.basename(inputFile);
      const outputFile = path.join(outputDirectory, fileName);

      await recolorImage(inputFile, outputFile, color);
      generated.push(outputFile);
    }

    const manifestPath = path.join(outputDirectory, 'manifest.json');
    const manifest = {
      color: color.hex,
      view: currentView,
      generatedAt: new Date().toISOString(),
      files: generated.map((filePath) => ({
        fileName: path.basename(filePath),
        relativePath: path.relative(outputRoot, filePath).replaceAll(path.sep, '/')
      }))
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    generatedByView[currentView] = {
      outputDirectory,
      generatedCount: generated.length
    };
  }

  process.stdout.write(`${JSON.stringify({
    color: color.hex,
    views: generatedByView
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});