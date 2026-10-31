const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
// Read the existing manual macOS proxy only; never change system or CLI settings.
function proxyEnvironment(text) {
  const values = Object.fromEntries([...text.matchAll(/^\s*(\w+)\s*:\s*(.*?)\s*$/gm)].map(m => [m[1], m[2]]));
  const result = {};
  for (const [prefix, key] of [['HTTP', 'HTTP_PROXY'], ['HTTPS', 'HTTPS_PROXY']]) {
    const host = values[prefix + 'Proxy'], port = Number(values[prefix + 'Port']);
    if (values[prefix + 'Enable'] === '1' && /^[a-zA-Z0-9.:[\]-]+$/.test(host || '') && Number.isInteger(port) && port > 0 && port <= 65535)
      result[key] = `http://${host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host}:${port}`;
  }
  return result;
}
async function cliEnvironment(source = process.env, platform = process.platform, readProxy = () => promisify(execFile)('/usr/sbin/scutil', ['--proxy'], {timeout: 1500, maxBuffer: 65536}).then(r => r.stdout)) {
  const env = Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL','CODEX_HOME','HTTPS_PROXY','HTTP_PROXY','ALL_PROXY','NO_PROXY','https_proxy','http_proxy','all_proxy','no_proxy'].filter(k => source[k]).map(k => [k, source[k]]));
  // Explicit proxy environments take precedence as a unit, including NO_PROXY.
  if (platform === 'darwin' && !Object.keys(env).some(k => /proxy$/i.test(k))) {
    try { Object.assign(env, proxyEnvironment(await readProxy())); } catch { /* Existing direct connection remains available. */ }
  }
  return env;
}
module.exports = {cliEnvironment, proxyEnvironment};
