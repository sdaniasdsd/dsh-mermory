const crypto = require('crypto');

// Adapted from Lethe lethe/decay.py, commit d2246f3; see third-party/lethe-LICENSE.
function decayScore(importance, accessCount, elapsedDays, halfLifeDays = 7) {
  return importance * (1 + Math.min(0.1 * Math.max(0, accessCount), 1)) *
    Math.exp(-Math.log(2) * Math.max(0, elapsedDays) / halfLifeDays);
}

function terms(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]+/g) || [];
  return new Set(words.flatMap(word => /[\u3400-\u9fff]/.test(word) && word.length > 2
    ? Array.from({length: word.length - 1}, (_, i) => word.slice(i, i + 2)) : [word]));
}

function indexPackage(manifest, sourcePath) {
  if (!manifest?.run?.run_id || !sourcePath) throw new Error('研究包缺少 run_id 或来源路径');
  const types = [['failures','failure_id'], ['decisions','adjudication_id'], ['reports','report_id'], ['calibrations','calibration_id'], ['evidence','evidence_id']];
  const items = [];
  for (const [type, idKey] of types) for (const record of manifest[type] || []) {
    if (!record[idKey]) continue;
    const content = [record.title, record.original_statement, record.failure_mode, record.corrected_statement, record.conclusion, record.rationale, record.correction, record.claim, record.description, record.summary, record.excerpt, record.author_claim].filter(v => typeof v === 'string' && v.trim()).join('；');
    if (!content) continue;
    const source = {manifest: sourcePath, run_id: manifest.run.run_id, type, record_id: record[idKey]};
    const id = crypto.createHash('sha256').update(JSON.stringify({source, content})).digest('hex');
    items.push({id, content, source, status: record.status || null, evidence_level: record.evidence_level || null, trust: record.trust || null, evidence_refs: record.evidence_refs || [], created_at: record.created_at || record.retrieved_at || manifest.exported_at || null, access_count: 0});
  }
  return items;
}

function recallMemory(items, options = {}) {
  const {question, contextTokens, usedTokens = 0, outputTokens = 0, now = new Date().toISOString()} = options;
  if (!question || !Number.isSafeInteger(contextTokens) || contextTokens <= 0 || !Number.isSafeInteger(usedTokens) || usedTokens < 0 || !Number.isSafeInteger(outputTokens) || outputTokens < 0) throw new Error('必须提供问题、有效上下文窗口和非负预算');
  const date = Date.parse(now);
  if (!Number.isFinite(date)) throw new Error('无效时间');
  const budget = Math.max(0, Math.min(Math.floor(contextTokens * 0.3), contextTokens - usedTokens - outputTokens));
  const query = terms(question);
  const ranked = items.map(item => {
    const tokens = terms(item.content);
    const overlap = [...query].filter(term => tokens.has(term)).length;
    const timestamp = Date.parse(item.last_accessed_at || item.created_at || now);
    const age = Number.isFinite(timestamp) ? Math.max(0, (date - timestamp) / 86400000) : 0;
    return {item, overlap, score: overlap * (0.5 + decayScore(0.5, item.access_count || 0, age, 30))};
  }).filter(row => row.overlap > 0).sort((a,b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  // UTF-8 byte count is a conservative heuristic, not a model tokenizer.
  const links = [];
  for (const row of ranked) {
    const link = {...row.item, relevance_score: row.score};
    if (Buffer.byteLength(JSON.stringify([...links, link]), 'utf8') <= budget) links.push(link);
  }
  return {budget_tokens: budget, estimated_tokens: links.length ? Buffer.byteLength(JSON.stringify(links), 'utf8') : 0, estimation: 'utf8-byte heuristic; verify with model tokenizer', links};
}

module.exports = {decayScore, indexPackage, recallMemory};
