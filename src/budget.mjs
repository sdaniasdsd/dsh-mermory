// Budget only the contents of this memory tool's live results; original events remain in the log.
export const name = 'research-memory-budget'
export const inject = ['tokenMeter']
const TOOL = 'mcp__huozhong_memory__recall_research_memory'

export function enforceMemoryBudget(session, meter, contextTokens) {
  if (!Number.isSafeInteger(contextTokens) || contextTokens < 1) throw new Error('memory budget requires a positive context window')
  const events = typeof session.snapshotEvents === 'function' ? session.snapshotEvents() : session.events
  const calls = new Set(events.filter(event => event.type === 'tool/call' && event.data.name === TOOL).map(event => event.data.callId))
  const candidates = session.surface.nodes.map(seq => events[seq]).filter(event => event?.type === 'tool/result' && calls.has(event.data.message.source.callId))
  const budget = Math.floor(contextTokens * 0.3)
  let bytes = 0
  const discard = []
  for (const event of candidates.reverse()) {
    const message = typeof session.deriveEventMessage === 'function' ? session.deriveEventMessage(event) : event.data.message
    const nested = message.content[0]?.type === 'tool-result'
    const blocks = nested ? message.content[0].content : message.content
    const cost = blocks.length ? Buffer.byteLength(JSON.stringify(blocks), 'utf8') : 0
    if (bytes + cost <= budget) bytes += cost
    else discard.push({event,message,nested,blocks})
  }
  for (const {event,message: original,nested,blocks} of discard) {
    if (blocks.length === 0) continue
    const message = {...original, content: nested ? [{...original.content[0], content:[]}] : []}
    const surfaceOp = nested ? {op:'replace',start:event.seq,end:event.seq} : {op:'replace',startSeq:event.seq,endSeq:event.seq}
    session.append('compaction/prune', {shadowedRange:{start:event.seq,end:event.seq}, shadowedSeqs:[event.seq], shadowedTokenCount:meter.estimateMessage(original)})
    session.append('tool/result', {...event.data,message}, {surfaceOp,sourceEventSeqs:[event.seq]})
  }
  return {bytes,budget,discarded:discard.length}
}

export function apply(ctx, config) {
  if (!Number.isSafeInteger(config.contextTokens) || config.contextTokens < 1) throw new Error('memory budget requires DSH_MEMORY_CONTEXT_TOKENS')
  ctx.on('agent/pre-step', async ({agent, signal}, next) => {
    if (!signal.aborted) {
      const actual = agent.session.requestContext()?.contextWindow
      const window = Number.isSafeInteger(actual) && actual > 0 ? Math.min(actual,config.contextTokens) : config.contextTokens
      enforceMemoryBudget(agent.session, ctx.tokenMeter, window)
    }
    return next()
  })
}
