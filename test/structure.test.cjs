const test = require('node:test');
const assert = require('node:assert/strict');
const { recallStructure } = require('../src/structure.cjs');
test('keeps weighted ranking and original structural links', () => {
  const result = recallStructure('闭环反馈延迟振荡预充');
  assert.equal(result.matches[0].primitive, 'primitive/bucket-with-inflow-outflow');
  assert.equal(result.matches[0].score, 0.7273);
  assert.ok(result.matches[0].inherited_truncations.includes('truncation/single-branch'));
  assert.ok(result.matches[0].relates_claims.includes('claim/bigger-bucket-has-floor'));
  assert.equal(result.status_flags.is_ground_truth, false);
});
test('English feedback delay retrieves the control loop', () => {
 const result=recallStructure('feedback delay oscillation control system');
 assert.equal(result.matches[0].primitive,'primitive/coach-watching-and-correcting');
 assert.equal(result.matches[0].score,1);
});
