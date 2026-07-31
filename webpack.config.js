const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { version: APP_VERSION } = require('./package.json');

// A short, human-readable stamp of WHEN this bundle was built — shown next to
// the version in DEV builds only (the playtest .bat runs `--mode=development`;
// release packaging runs `--mode=production`). It changes on every rebuild, so
// while testing you can glance at the header/manual and know for certain you're
// looking at the latest changes and not a stale build. Empty on release, so
// shipped builds show a clean version with no timestamp.
const IS_DEV_BUILD = process.argv.join(' ').includes('development');
const BUILD_TIME = new Date().toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const BUILD_LABEL = IS_DEV_BUILD ? `dev build · ${BUILD_TIME}` : '';

// Persistent on-disk cache — after the first build, an unchanged-source
// rebuild (the common case when opening the app via the launcher) drops from
// ~30s to a few seconds. Keyed per config and invalidated automatically when
// this file changes. Cache lives in node_modules/.cache/webpack (regenerable,
// gitignored). Each config below spreads this in.
const persistentCache = {
  type: 'filesystem',
  buildDependencies: { config: [__filename] },
};

/** @type {import('webpack').Configuration} */
const mainConfig = {
  name: 'main',
  target: 'electron-main',
  devtool: 'source-map',
  cache: persistentCache,
  entry: './src/main/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'main.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: { loader: 'ts-loader', options: { compilerOptions: { noEmit: false } } },
      },
      {
        test: /\.sql$/i,
        type: 'asset/source',
      },
    ],
  },
  // sql.js and madden-franchise must stay real node_modules requires — both
  // resolve their own on-disk data files (wasm binary / schema .gz files)
  // using __dirname derived from their own module location. Bundling either
  // would rewrite that location to dist/main and break the lookup.
  externals: {
    'sql.js': 'commonjs sql.js',
    'madden-franchise': 'commonjs madden-franchise',
  },
  node: {
    __dirname: false,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/main/splash/splash.html', to: 'splash/splash.html' },
        { from: 'public/assets/splash/spshscr.png', to: 'splash/splash-image.png' },
      ],
    }),
  ],
};

/** @type {import('webpack').Configuration} */
const preloadConfig = {
  name: 'preload',
  target: 'electron-preload',
  devtool: 'source-map',
  cache: persistentCache,
  entry: './src/main/preload.ts',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'preload.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: { loader: 'ts-loader', options: { compilerOptions: { noEmit: false } } },
      },
    ],
  },
};

/** @type {import('webpack').Configuration} */
const splashPreloadConfig = {
  name: 'splash-preload',
  target: 'electron-preload',
  devtool: 'source-map',
  cache: persistentCache,
  entry: './src/main/splash/splash-preload.ts',
  output: {
    path: path.resolve(__dirname, 'dist/main/splash'),
    filename: 'splash-preload.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: { loader: 'ts-loader', options: { compilerOptions: { noEmit: false } } },
      },
    ],
  },
};

/** @type {import('webpack').Configuration} */
const rendererConfig = {
  name: 'renderer',
  target: 'electron-renderer',
  devtool: 'source-map',
  cache: persistentCache,
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: { loader: 'ts-loader', options: { compilerOptions: { noEmit: false } } },
      },
      {
        test: /\.css$/,
        // css-loader url resolution is off: the only url()s are @font-face
        // sources in globals.css, written as runtime-relative paths
        // ("assets/fonts/...") that resolve against the emitted styles.css in
        // dist/renderer — the fonts themselves arrive there via
        // CopyWebpackPlugin, not the CSS pipeline.
        use: [MiniCssExtractPlugin.loader, { loader: 'css-loader', options: { url: false } }, 'postcss-loader'],
      },
    ],
  },
  plugins: [
    // Bakes the package.json version in at build time so the UI can show it
    // without a runtime IPC round-trip (single source of truth: package.json).
    new webpack.DefinePlugin({
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __BUILD_LABEL__: JSON.stringify(BUILD_LABEL),
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new MiniCssExtractPlugin({ filename: 'styles.css' }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public/assets',
          to: 'assets',
          globOptions: {
            ignore: [
              // Historical guard from the original offline DDS→PNG workflow
              // (no .dds files exist in the tree anymore — the library is WebP
              // as of 2026-07-19). Kept as a harmless safety net in case source
              // textures are ever staged here again mid-conversion.
              '**/*.dds',
              '**/*.psd',
              // Source-side folders with NO runtime reference anywhere in src/
              // (verified by grep for both `assets/<folder>` and `cfbmedia://`).
              // They live in public/assets because that's where the art is kept,
              // but copying them into dist/ put ~42 MB of never-loaded files
              // into every app installer. Excluded from the BUILD only — the
              // files stay in the repo, and the image-data installer reads
              // public/assets directly, so it is unaffected either way.
              //   Stickers      37.5 MB — unused overlay art
              //   GameShots      2.3 MB — a single reference screenshot
              //   Screenshots    1.7 MB — marketing/documentation captures
              //   coaches_added  0.1 MB — input for scripts/convert-added-portraits.js
              //   NFL              ~0 MB — one stray logo
              '**/public/assets/Stickers/**',
              '**/public/assets/GameShots/**',
              '**/public/assets/Screenshots/**',
              '**/public/assets/coaches_added/**',
              '**/public/assets/NFL/**',
            ],
          },
        },
        {
          // The in-app User Manual (opened from the sidebar in an iframe). Same
          // source as the standalone PDF, but here the placeholders resolve to
          // the app's OWN bundled asset files instead of baked-in data URIs —
          // so the shipped manual.html stays tiny (~40KB) and reuses the fonts,
          // logo, and splash the app already carries. Version stamped at build.
          from: 'docs/manual/manual.template.html',
          to: 'manual.html',
          transform(content) {
            return content
              .toString()
              .replace(/__INTER400__/g, 'assets/fonts/inter-latin-400-normal.woff2')
              .replace(/__INTER500__/g, 'assets/fonts/inter-latin-500-normal.woff2')
              .replace(/__INTER600__/g, 'assets/fonts/inter-latin-600-normal.woff2')
              .replace(/__INTER700__/g, 'assets/fonts/inter-latin-700-normal.woff2')
              // The DynastyOS wordmark (light variant — the manual's paper is cream).
              .replace(/__LOGO_MARK__/g, 'assets/Logo/DynastyOS-Wordmark.svg')
              .replace(/__SPLASH__/g, 'assets/splash/spshscr.png')
              .replace(/__VERSION__/g, APP_VERSION)
              .replace(/__BUILD_LABEL__/g, BUILD_LABEL);
          },
        },
      ],
    }),
  ],
};

module.exports = [mainConfig, preloadConfig, splashPreloadConfig, rendererConfig];
