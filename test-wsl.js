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

  const distro = distros.trim().split('\n')[0];
  console.log(`   Using: ${distro}`);

  // 2. Test different path formats
  const testPaths = [
    `\\\\wsl$\\${distro}\\home\\${username}`,
    `\\\\wsl.localhost\\${distro}\\home\\${username}`,
    `\\\\wsl$\\${distro}\\home\\${username}\\.claude.json`,
    `\\\\wsl.localhost\\${distro}\\home\\${username}\\.claude.json`,
  ];

  testPaths.forEach((testPath, i) => {
    console.log(`\n2.${i + 1}. Testing: ${testPath}`);

    try {
      const stats = fs.statSync(testPath);
      console.log(`   ✓ Exists (${stats.isDirectory() ? 'directory' : 'file'})`);

      if (stats.isDirectory()) {
        const files = fs.readdirSync(testPath);
        console.log(`   ✓ Can read (${files.length} entries)`);
        console.log(`   Files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
      }
    } catch (err) {
      console.log(`   ✗ Failed: ${err.message}`);
    }
  });

  // 3. Test wsl command fallback
  console.log(`\n3. Testing wsl command fallback...`);
  const wslPath = `/home/${username}/.claude.json`;
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
