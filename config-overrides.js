const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    url: require.resolve('url/'),
    assert: require.resolve('assert/'),
    http: require.resolve('stream-http/'),
    https: require.resolve('https-browserify/'),
    os: require.resolve('os-browserify/'),
    process: require.resolve('process/browser.js'),
  };

  // Разрешаем неполные пути (без расширения) в ESM-модулях
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: { fullySpecified: false },
  });

  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser.js',
    })
  );

  return config;
};
