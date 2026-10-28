// Portable implementation of planetary-knowledge-base/build/recall.py and signature_match.py.
const primitives = require('../data/primitive.json');
const truncations = require('../data/truncation.json');
const claims = require('../data/claim.json');
const weights = {source_controllability:1, output_requirement:1.5, flow_direction:1, storage_medium:1, feedback_available:0.5, failure_cost:1.5, critical_region:2};
const aliases = {'at-startup':'at-empty-state','at-start':'at-empty-state','at-max-effort':'at-drive-limit','at-high-ratio':'at-drive-limit','near-balance':'at-balance-point','high-gain-or-long-delay':'at-loop-limit'};
function signature(question) {
  const q=question.toLowerCase(), has=(...words)=>words.some(word=>q.includes(word));
  const s={};
  if(has('启动','上电','预充','空桶','冷启动','初始化')) s.critical_region='at-empty-state';
  else if(has('平衡','均流','并联','反灌','两源')) s.critical_region='at-balance-point';
  else if(has('延迟','增益','振荡','稳定','环路','delay','oscillation','stability','loop gain')) s.critical_region='at-loop-limit';
  else if(has('饱和','限流','大倍率','高占空','用力过猛','堵转')) s.critical_region='at-drive-limit';
  const output=[['smooth',['滤波','平滑','纹波','尖峰']],['track-reference',['跟踪','参考','闭环']],['reach-target-safely',['安全到达','预充','软启动']],['exceed-source-level',['升压','高于输入','超过输入']],['share-load',['均流','分担','共享负载']],['on-demand',['按需','取用','输出多少']]];
  for(const [value,terms] of output) if(has(...terms)){s.output_requirement=value;break}
  if(has('双向','反灌','回馈','再生')) s.flow_direction='bidirectional-risk'; else if(has('单向','整流','只允许正向')) s.flow_direction='unidirectional';
  if(has('电容','水箱','储能','母线')) s.storage_medium='potential'; else if(has('电感','惯量','飞轮')) s.storage_medium='kinetic';
  if(has('反馈','采样','闭环','控制器','feedback','closed-loop')) s.feedback_available=true; else if(has('开环','无反馈')) s.feedback_available=false;
  if(has('损坏','击穿','危险','安全事故')) s.failure_cost=has('事故','人身')?'safety':'hardware-damage'; else if(has('振荡','误差','恢复','oscillation','recovery')) s.failure_cost='recoverable';
  return s;
}
function recallStructure(question, top=5, minimum=0.5) {
  const query=signature(question), matches=[];
  for(const node of primitives){
    let total=0,hit=0; const same_fields=[],diff_fields=[];
    for(const [key,weight] of Object.entries(weights)){
      let a=query[key],b=node.signature?.[key];
      if(a==null||b==null) continue;
      if(key==='critical_region'){a=aliases[a]||a;b=aliases[b]||b}
      total+=weight;
      if(a===b){hit+=weight;same_fields.push(key)} else diff_fields.push(`${key}: ${typeof a==='boolean'?(a?'True':'False'):a} vs ${typeof b==='boolean'?(b?'True':'False'):b}`);
    }
    const score=total?hit/total:0; if(score<minimum)continue;
    const linked=truncations.filter(t=>(t.applies_to||[]).includes(node.id)).map(t=>t.id);
    const related=claims.filter(c=>(c.applies_to||[]).includes(node.id)||(c.repairs_truncation||[]).some(id=>linked.includes(id))).map(c=>c.id);
    matches.push({primitive:node.id,name:node.name,score:Math.round(score*10000)/10000,same_fields,diff_fields,de_domained:(node.de_domained||'').trim(),inherited_truncations:linked,relates_claims:related});
  }
  matches.sort((a,b)=>b.score-a.score||a.primitive.localeCompare(b.primitive));
  return {query_signature:query,matches:matches.slice(0,top),status_flags:{is_ground_truth:false,note:'命中为待复核先验，不能直接作为已验证结论。'}};
}
module.exports={signature,recallStructure};
