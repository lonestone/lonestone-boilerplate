const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const baseConfig = getDefaultConfig(projectRoot)

const config = withNativeWind(
  {
    ...baseConfig,
    watchFolders: [workspaceRoot],
    resolver: {
      ...baseConfig.resolver,
      nodeModulesPaths: [
        path.resolve(projectRoot, 'node_modules'),
        path.resolve(workspaceRoot, 'node_modules'),
      ],
      disableHierarchicalLookup: true,
    },
  },
  {
    input: path.join(projectRoot, 'global.css'),
  },
)

module.exports = config
