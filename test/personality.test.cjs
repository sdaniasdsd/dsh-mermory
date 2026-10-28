const test = require('node:test');
const assert = require('node:assert/strict');

test('personality preset retains standard capabilities without mutating them', async () => {
  const {makePersonalityPreset} = await import('../src/personality.mjs');
  const standard = {plugins:[{id:'persona',name:'@deepseek-ai/dsh-persona',config:{prefix:'original',other:true}},{id:'tool',name:'example'}]};
  const preset = makePersonalityPreset(standard);
  assert.equal(preset.name, '人格模式');
  assert.equal(preset.id, 'personality');
  assert.equal(preset.plugins[1], standard.plugins[1]);
  assert.equal(standard.plugins[0].config.prefix, 'original');
  assert.match(preset.plugins[0].config.prefix, /recall_research_memory/);
  assert.equal(preset.plugins[0].config.other, true);
});

test('fails clearly if standard mode is unavailable', async () => {
  const {makePersonalityPreset} = await import('../src/personality.mjs');
  assert.throws(() => makePersonalityPreset({plugins:[]}), /standard persona/);
});

test('registers and removes the preset through the DSH registry', async () => {
  const {apply} = await import('../src/personality.mjs');
  let registered, cleanup, disposed = false;
  const ctx = {agentPresets: {definitions: new Map([['standard',{config:{plugins:[{name:'@deepseek-ai/dsh-persona'}]}}]]), async register(value) {registered=value; return () => {disposed=true}}}, effect(fn) {cleanup=fn()}};
  await apply(ctx);
  assert.equal(registered.id, 'personality');
  cleanup();
  assert.equal(disposed, true);
});
