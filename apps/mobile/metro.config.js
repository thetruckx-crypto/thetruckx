const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Intercept react and react-native to enforce single instance from apps/mobile
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, 'node_modules', moduleName),
      platform
    );
  }
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, 'node_modules', moduleName),
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
