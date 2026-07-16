import process from 'node:process'

// The suite must be hermetic to the shell that runs it: maintainers piloting a
// consumer project export BOILERPLATE_* overrides (local repo path, source
// version) that would leak into in-process calls and spawned CLIs, making
// tests pass or fail depending on the terminal. Tests that need these
// variables set them explicitly.
for (const name of [
  'BOILERPLATE_REPO',
  'BOILERPLATE_SOURCE_VERSION',
  'BOILERPLATE_SOURCE_COMMIT',
  'BOILERPLATE_INSTALLER_ONBOARD',
]) {
  delete process.env[name]
}
