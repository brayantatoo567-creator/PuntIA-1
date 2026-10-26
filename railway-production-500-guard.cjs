'use strict';

// Fail-fast compatibility patch for the legacy Railway tarball.
// This script must run after the legacy .tgz is extracted and before npm install.
const fs = require('node:fs');
const path = require('node:path');

const uuid = String.raw`/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`;
const runtimePath = path.join(process.cwd(), 'src/infrastructure/http/runtime.js');
const projectsPath = path.join(process.cwd(), 'src/routes/projects.js');

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error('Production patch: required file missing: ' + file);
  return fs.readFileSync(file, 'utf8');
}
function writeIfChanged(file, before, after) {
  if (before !== after) fs.writeFileSync(file, after, 'utf8');
}
function patchRuntime() {
  const before = readRequired(runtimePath);
  if (/isCloudUuid|CLOUD_UUID_GUARD/.test(before)) {
    console.log('PRODUCTION_500_GUARD: usage guard already present');
    return;
  }
  const anchor = /deps\.cloudUsageSnapshot\s*=\s*async\s*\(user\)\s*=>\s*\{/;
  if (!anchor.test(before)) throw new Error('Production patch: cloud usage snapshot anchor not found; refusing unsafe deploy');
  const guard = [
    "deps.cloudUsageSnapshot = async (user) => {",
    "      const ownerId = String(user?.id || '');",
    "      const isCloudUuid = " + uuid + ".test(ownerId);",
    "      if (!isCloudUuid) return { period: usagePeriod(), plan: 'free', used: { pattern: 0, chat: 0, image: 0, vision: 0, pdf: 0 }, limits: FREE_LIMITS, subscription: null };"
  ].join(' ');
  const after = before.replace(anchor, guard);
  if (after === before) throw new Error('Production patch: failed to add anonymous usage guard');
  writeIfChanged(runtimePath, before, after);
  console.log('PRODUCTION_500_GUARD: usage guard inserted');
}
function patchProjects() {
  const before = readRequired(projectsPath);
  if (/requireCloudOwner|CLOUD_PROJECT_OWNER_UUID_GUARD/.test(before)) {
    console.log('PRODUCTION_500_GUARD: project owner guard already present');
    return;
  }
  const anchor = /const\s*\{\s*projects,\s*jobs,\s*usage,\s*pattern\s*\}\s*=\s*services\s*;/;
  if (!anchor.test(before)) throw new Error('Production patch: project controller anchor not found; refusing unsafe deploy');
  const guard = [
    'const { projects, jobs, usage, pattern } = services;',
    "  const isProjectCloudPath = /^\\/api\\/(?:projects|jobs)(?:\\/|$)/.test(p);",
    "  const currentOwner = typeof currentUser === 'function' ? currentUser(req) : null;",
    "  const currentOwnerId = String(currentOwner?.id || '');",
    '  if (deps.cloud?.projectRepo && isProjectCloudPath && !' + uuid + '.test(currentOwnerId)) {',
    "    jsonError(res, 401, 'Inicia sesión para guardar y sincronizar proyectos en la nube.', 'AUTH_REQUIRED');",
    '    return true;',
    '  }'
  ].join('\n');
  const after = before.replace(anchor, guard);
  if (after === before) throw new Error('Production patch: failed to add project owner guard');
  writeIfChanged(projectsPath, before, after);
  console.log('PRODUCTION_500_GUARD: project owner guard inserted');
}
patchRuntime();
patchProjects();
require('node:child_process').execFileSync(process.execPath, ['--check', runtimePath], { stdio: 'inherit' });
require('node:child_process').execFileSync(process.execPath, ['--check', projectsPath], { stdio: 'inherit' });
const runtime = readRequired(runtimePath);
const projects = readRequired(projectsPath);
if (!/isCloudUuid/.test(runtime) && !/cloud usage snapshot already present/.test(runtime)) {
  throw new Error('Production patch: runtime UUID guard not verifiable');
}
if (!/requireCloudOwner|CLOUD_PROJECT_OWNER_UUID_GUARD|isProjectCloudPath/.test(projects)) {
  throw new Error('Production patch: project UUID guard not verifiable');
}
console.log('PRODUCTION_500_GUARD: PASS');
