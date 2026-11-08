const {test}=require('node:test'),assert=require('node:assert/strict');
const {cliEnvironment,proxyEnvironment}=require('../electron/cli-environment.cjs');
const text='HTTPEnable : 1\nHTTPProxy : 127.0.0.1\nHTTPPort : 7897\nHTTPSEnable : 1\nHTTPSProxy : ::1\nHTTPSPort : 7897\n';
test('manual system proxies are validated; disabled/PAC/invalid values do not fabricate routes',()=>{assert.deepEqual(proxyEnvironment(text),{HTTP_PROXY:'http://127.0.0.1:7897',HTTPS_PROXY:'http://[::1]:7897'});assert.deepEqual(proxyEnvironment('HTTPEnable : 0\nHTTPProxy : x\nHTTPPort : 80'),{});assert.deepEqual(proxyEnvironment('HTTPEnable : 1\nHTTPProxy : bad/host\nHTTPPort : 999999'),{});});
test('CLI inherits explicit uppercase/lowercase proxy and bypass without system override',async()=>{let reads=0;for(const value of [{https_proxy:'http://explicit:80'},{NO_PROXY:'localhost'}]){const env=await cliEnvironment({HOME:'/tmp',SECRET:'hidden',...value},'darwin',async()=>{reads++;return text});assert.deepEqual(env,{HOME:'/tmp',...value});}assert.equal(reads,0);});
test('CLI system proxy detection is bounded/fallible and Mac only',async()=>{assert.equal((await cliEnvironment({},'darwin',async()=>text)).HTTP_PROXY,'http://127.0.0.1:7897');assert.deepEqual(await cliEnvironment({},'darwin',async()=>{throw Error('timeout')}),{});assert.deepEqual(await cliEnvironment({},'linux',async()=>{throw Error('must not read')}),{});});
test('Windows CLI keeps user profile and OS environment without forwarding unrelated secrets',async()=>{
 const source={Path:'C:\\tools',SystemRoot:'C:\\Windows',USERPROFILE:'C:\\Users\\reader',APPDATA:'C:\\Users\\reader\\AppData\\Roaming',TEMP:'C:\\Temp',SECRET_TOKEN:'hidden'};
 const env=await cliEnvironment(source,'win32');assert.equal(env.USERPROFILE,source.USERPROFILE);assert.equal(env.SystemRoot,source.SystemRoot);assert.equal(env.Path,source.Path);assert.equal(env.SECRET_TOKEN,undefined);
});
