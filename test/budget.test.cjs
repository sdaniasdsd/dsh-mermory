const test = require('node:test');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');

test('limits cumulative memory results, retaining newest and preserving original events', async () => {
  const { enforceMemoryBudget } = await import(pathToFileURL(path.join(__dirname,'../src/budget.mjs')));
  const calls = ['a','b','c'];
  const events = calls.flatMap((id, i) => [
    {seq:i*2,type:'tool/call',data:{callId:id,name:'mcp__huozhong_memory__recall_research_memory'}},
    {seq:i*2+1,type:'tool/result',data:{message:{source:{callId:id},content:[{type:'tool-result',content:[{type:'text',text:'汉'.repeat(80)}]}]}}},
  ]);
  const session = {events, surface:{nodes:[1,3,5]}, append(type,data,opts){ const seq=this.events.length; this.events.push({seq,type,data}); if(opts?.surfaceOp) this.surface.nodes[this.surface.nodes.indexOf(opts.surfaceOp.start)]=seq; return {seq}; }};
  const old = JSON.stringify(events[1]);
  const result = enforceMemoryBudget(session,{estimateMessage:()=>0},500);
  assert.ok(result.bytes <= 150);
  assert.equal(JSON.stringify(events[1]), old);
  assert.equal(session.events[session.surface.nodes[0]].data.message.content[0].content.length,0);
});

test('keeps unrelated results and the newest fitting memory', async () => {
  const { enforceMemoryBudget } = await import(pathToFileURL(path.join(__dirname,'../src/budget.mjs')));
  const name = 'mcp__huozhong_memory__recall_research_memory';
  const events = [
    {seq:0,type:'tool/call',data:{callId:'a',name}},
    {seq:1,type:'tool/result',data:{message:{source:{callId:'a'},content:[{type:'tool-result',content:[{type:'text',text:'old'.repeat(30)}]}]}}},
    {seq:2,type:'tool/call',data:{callId:'b',name}},
    {seq:3,type:'tool/result',data:{message:{source:{callId:'b'},content:[{type:'tool-result',content:[{type:'text',text:'new'.repeat(20)}]}]}}},
    {seq:4,type:'tool/call',data:{callId:'c',name:'unrelated'}},
    {seq:5,type:'tool/result',data:{message:{source:{callId:'c'},content:[{type:'tool-result',content:[{type:'text',text:'unrelated'}]}]}}},
  ];
  const session = {events, surface:{nodes:[1,3,5]}, append(type,data,opts){const seq=this.events.length; this.events.push({seq,type,data}); if(opts?.surfaceOp) this.surface.nodes[this.surface.nodes.indexOf(opts.surfaceOp.start)]=seq; return {seq};}};
  const budget = enforceMemoryBudget(session,{estimateMessage:()=>1},400);
  assert.ok(budget.bytes <= 120);
  assert.equal(session.surface.nodes[1],3);
  assert.equal(session.surface.nodes[2],5);
  assert.equal(session.events[session.surface.nodes[0]].data.message.content[0].content.length,0);
  assert.equal(enforceMemoryBudget(session,{estimateMessage:()=>1},400).discarded,0);
});

test('pre-step uses the smaller actual model window and continues the request', async () => {
  const { apply } = await import(pathToFileURL(path.join(__dirname,'../src/budget.mjs')));
  let handler;
  const ctx = {tokenMeter:{estimateMessage:()=>0}, on(event, callback){ assert.equal(event,'agent/pre-step'); handler=callback; }};
  apply(ctx,{contextTokens:1000});
  const events = [{seq:0,type:'tool/call',data:{callId:'a',name:'mcp__huozhong_memory__recall_research_memory'}},{seq:1,type:'tool/result',data:{message:{source:{callId:'a'},content:[{type:'tool-result',content:[{type:'text',text:'x'.repeat(100)}]}]}}}];
  const session = {events,surface:{nodes:[1]},requestContext(){return {contextWindow:200}},append(type,data,options){const seq=this.events.length;this.events.push({seq,type,data});if(options?.surfaceOp)this.surface.nodes[0]=seq;return {seq}}};
  const value=await handler({agent:{session},signal:{aborted:false}},async()=> 'continued');
  assert.equal(value,'continued');
  assert.equal(session.events[session.surface.nodes[0]].data.message.content[0].content.length,0);
});

test('works with official newer DSH session snapshot API', async () => {
  const { enforceMemoryBudget } = await import(pathToFileURL(path.join(__dirname,'../src/budget.mjs')));
  const log=[{seq:0,type:'tool/call',data:{callId:'a',name:'mcp__huozhong_memory__recall_research_memory'}},{seq:1,type:'tool/result',data:{message:{source:{callId:'a'},content:[{type:'tool-result',content:[{type:'text',text:'x'.repeat(200)}]}]}}}];
  const session={snapshotEvents(){return [...log]},surface:{nodes:[1]},append(type,data,opts){const seq=log.length;log.push({seq,type,data});if(opts?.surfaceOp)this.surface.nodes[0]=seq;return {seq}}};
  const result=enforceMemoryBudget(session,{estimateMessage:()=>0},100);
  assert.equal(result.discarded,1);
  assert.equal(log[session.surface.nodes[0]].data.message.content[0].content.length,0);
});

test('official DSH flat tool content stays within the cumulative budget', async () => {
 const {enforceMemoryBudget}=await import(pathToFileURL(path.join(__dirname,'../src/budget.mjs')));
 const log=[{seq:0,type:'tool/call',data:{callId:'a',name:'mcp__huozhong_memory__recall_research_memory'}},{seq:1,type:'tool/result',data:{message:{source:{callId:'a'},content:[{type:'text',text:'x'.repeat(250)}]}}}];
 const session={snapshotEvents(){return [...log]},deriveEventMessage(event){return event.data.message},surface:{nodes:[1]},append(type,data,opts){const seq=log.length; log.push({seq,type,data});if(opts?.surfaceOp){assert.equal(opts.surfaceOp.startSeq,1);this.surface.nodes[0]=seq}return {seq}}};
 const result=enforceMemoryBudget(session,{estimateMessage:()=>1},100);
 assert.equal(result.discarded,1);
 assert.deepEqual(log[session.surface.nodes[0]].data.message.content,[]);
});
