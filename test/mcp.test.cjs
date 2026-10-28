const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

test('MCP advertises and invokes bounded selective research recall', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'research-mcp-'));
  const manifest = path.join(dir, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify({run:{run_id:'old'},failures:[{failure_id:'f1',failure_mode:'ADC 采样抖动',status:'confirmed'}]}));
  const child = spawn(process.execPath, [path.join(__dirname,'../src/mcp.cjs')], {env:{...process.env,DSH_MEMORY_MANIFESTS:manifest,DSH_MEMORY_CONTEXT_TOKENS:'4096'}});
  let stdout=''; let stderr='';
  child.stdout.on('data', chunk => stdout += chunk);
  child.stderr.on('data', chunk => stderr += chunk);
  child.stdin.end([JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}}),JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'}),JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'recall_research_memory',arguments:{query:'ADC 采样抖动'}}})].join('\n')+'\n');
  const code = await new Promise(resolve => child.on('close',resolve));
  assert.equal(code,0,stderr);
  const responses = stdout.trim().split('\n').map(JSON.parse);
  assert.equal(responses[1].result.tools[0].name,'recall_research_memory');
  const result = JSON.parse(responses[2].result.content[0].text);
  assert.equal(result.links[0].source.record_id,'f1');
  assert.ok(result.estimated_tokens <= result.budget_tokens);
});

test('MCP preserves weighted structural recall and links without a study package', async () => {
  const env = {...process.env, DSH_MEMORY_MANIFESTS:'', DSH_MEMORY_CONTEXT_TOKENS:'8192'};
  const child = spawn(process.execPath, [path.join(__dirname,'../src/mcp.cjs')], {env});
  let stdout=''; let stderr='';
  child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
  child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'recall_research_memory',arguments:{query:'闭环反馈延迟振荡'}}})+'\n');
  const code = await new Promise(resolve => child.on('close',resolve));
  assert.equal(code,0,stderr);
  const result = JSON.parse(stdout.trim()).result;
  assert.notEqual(result.isError,true, JSON.stringify(result));
  const payload = JSON.parse(result.content[0].text);
  const match = payload.structural_memory.matches.find(item => item.primitive === 'primitive/coach-watching-and-correcting');
  assert.equal(match.score,1);
  assert.ok(match.same_fields.includes('critical_region'));
  assert.ok(match.inherited_truncations.includes('truncation/instant-observation'));
  assert.equal(payload.structural_memory.status_flags.is_ground_truth,false);
  assert.ok(Buffer.byteLength(result.content[0].text,'utf8') <= payload.budget_tokens);
});

test('structural links and package evidence share a single budget', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'research-mixed-'));
  const manifest = path.join(dir, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify({run:{run_id:'old'},failures:[{failure_id:'f1',failure_mode:'闭环反馈延迟振荡',status:'confirmed'}]}));
  const child=spawn(process.execPath,[path.join(__dirname,'../src/mcp.cjs')],{env:{...process.env,DSH_MEMORY_MANIFESTS:manifest,DSH_MEMORY_CONTEXT_TOKENS:'8192'}});
  let stdout=''; child.stdout.on('data', data=>stdout+=data);
  child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'recall_research_memory',arguments:{query:'闭环反馈延迟振荡'}}})+'\n');
  assert.equal(await new Promise(resolve=>child.on('close',resolve)),0);
  const response=JSON.parse(stdout.trim()).result;
  const payload=JSON.parse(response.content[0].text);
  assert.ok(payload.structural_memory.matches.some(match=>match.primitive==='primitive/coach-watching-and-correcting'));
  assert.ok(payload.links.some(link=>link.source.record_id==='f1'));
  assert.equal(payload.estimated_tokens,Buffer.byteLength(response.content[0].text,'utf8'));
  assert.ok(payload.estimated_tokens <= payload.budget_tokens);
});

test('MCP retains weighted ranking and original primitive-to-claim links', async () => {
  const child=spawn(process.execPath,[path.join(__dirname,'../src/mcp.cjs')],{env:{...process.env,DSH_MEMORY_MANIFESTS:'',DSH_MEMORY_CONTEXT_TOKENS:'16384'}});
  let stdout='';child.stdout.on('data',data=>stdout+=data);
  child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'recall_research_memory',arguments:{query:'闭环反馈延迟振荡预充'}}})+'\n');
  assert.equal(await new Promise(resolve=>child.on('close',resolve)),0);
  const result=JSON.parse(stdout.trim()).result;
  const matches=JSON.parse(result.content[0].text).structural_memory.matches;
  assert.equal(matches[0].primitive,'primitive/bucket-with-inflow-outflow');
  assert.equal(matches[0].score,0.7273);
  assert.ok(matches[0].relates_claims.includes('claim/bigger-bucket-has-floor'));
  assert.ok(matches[0].inherited_truncations.includes('truncation/single-branch'));
  assert.equal(matches[1].score,0.6364);
});

test('English control-system questions retain structural signature matching', async () => {
 const child=spawn(process.execPath,[path.join(__dirname,'../src/mcp.cjs')],{env:{...process.env,DSH_MEMORY_MANIFESTS:'',DSH_MEMORY_CONTEXT_TOKENS:'8192'}});
 let stdout='';child.stdout.on('data',data=>stdout+=data);
 child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'recall_research_memory',arguments:{query:'feedback delay oscillation control system structural relationship assumptions'}}})+'\n');
 assert.equal(await new Promise(resolve=>child.on('close',resolve)),0);
 const result=JSON.parse(JSON.parse(stdout.trim()).result.content[0].text);
 assert.equal(result.structural_memory.query_signature.critical_region,'at-loop-limit');
 assert.ok(result.structural_memory.matches.some(match=>match.primitive==='primitive/coach-watching-and-correcting'));
});
