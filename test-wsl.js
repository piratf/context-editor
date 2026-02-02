/**
 * Simple WSL path test script for Windows
 * Run with: node test-wsl.js
 */

const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

console.log('=== WSL Path Access Test (Windows) ===\n');

// Get username
const username = os.userInfo().username;

// 1. Check WSL distributions
console.log('1. Checking WSL distributions...');
try {
  const distros = execSync('wsl -l -q', { encoding: 'utf8', timeout: 5000 });
  console.log(`   Found: ${distros.trim()}`);

  if (!distros.trim()) {
    console.log('   ✗ No WSL distributions found');
    process.exit(0);
  }

  const distroList = distros.trim().split('\n');
  const distro = distroList[0];
  console.log(`   Using: ${distro}`);

  // 2. Test different path formats
  const homeBase = `\\\\wsl$\\${distro}\\home\\${username}`;
  const homeBaseNew = `\\\\wsl.localhost\\${distro}\\home\\${username}`;
  const configFile = homeBase + '\\.claude.json';
  const configFileNew = homeBaseNew + '\\.claude.json';

  console.log(`\n2. Testing: ${homeBase}`);
  try {
    const stats = fs.statSync(homeBase);
    console.log(`   ✓ Exists (${stats.isDirectory() ? 'directory' : 'file'})`);

    const files = fs.readdirSync(homeBase);
    console.log(`   ✓ Can read (${files.length} entries)`);
    console.log(`   Files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
  } catch (err) {
    console.log(`   ✗ Failed: ${err.message}`);
  }

  console.log(`\n3. Testing: ${homeBaseNew}`);
  try {
    const stats = fs.statSync(homeBaseNew);
    console.log(`   ✓ Exists (${stats.isDirectory() ? 'directory' : 'file'})`);

    const files = fs.readdirSync(homeBaseNew);
    console.log(`   ✓ Can read (${files.length} entries)`);
  } catch (err) {
    console.log(`   ✗ Failed: ${err.message}`);
  }

  console.log(`\n4. Testing: ${configFile}`);
  try {
    const stats = fs.statSync(configFile);
    console.log(`   ✓ Config file exists (${stats.size} bytes)`);
  } catch (err) {
    console.log(`   ✗ Failed: ${err.message}`);
  }

  console.log(`\n5. Testing: ${configFileNew}`);
  try {
    const stats = fs.statSync(configFileNew);
    console.log(`   ✓ Config file exists (${stats.size} bytes)`);
  } catch (err) {
    console.log(`   ✗ Failed: ${err.message}`);
  }

  // 3. Test wsl command fallback
  console.log(`\n6. Testing wsl command fallback...`);
  const wslPath = `/home/${username}/.claude.json`;
  console.log(`   Using: wsl cat "${wslPath}"`);
  try {
    const output = execSync(`wsl cat "${wslPath}"`, { encoding: 'utf8', timeout: 5000 });
    console.log(`   ✓ wsl cat works (${output.length} bytes)`);
  } catch (err) {
    console.log(`   ✗ Failed: ${err.message}`);
  }

} catch (err) {
  console.log(`   ✗ WSL not available: ${err.message}`);
}

console.log('\n=== Test Complete ===');
