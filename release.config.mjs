/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  branches: [
    { name: 'production' },
    { name: 'staging', prerelease: 'staging' },
    'main',
  ],
}
