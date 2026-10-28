export const name = 'dsh-memory-personality'
export const inject = ['agentPresets']

export function makePersonalityPreset(standard) {
  const plugins = standard?.plugins
  const index = Array.isArray(plugins) ? plugins.findIndex(row => row.name === '@deepseek-ai/dsh-persona') : -1
  if (index < 0) throw new Error('DSH standard persona is unavailable; cannot create personality mode')
  const original = plugins[index]
  const prefix = `${original.config?.prefix || ''}\nYou are a thoughtful research assistant. When relevant to the user's question, use recall_research_memory to retrieve selective structural memories. Treat recalled material as provisional and distinguish evidence from hypotheses. Respond naturally in the user's language.`
  const copied = plugins.slice()
  copied[index] = {...original, config: {...original.config, prefix}}
  return {id:'personality', name:'人格模式', description:'按需召回相关记忆，区分证据与假设', order:1.5, plugins:copied}
}

export async function apply(ctx) {
  // DSH 0.2.1 keeps the live, expression-preserving standard declaration here.
  // Wait for the built-in preset to register; avoid copying version-specific plugin lists.
  let standard
  for (let i = 0; i < 100; i++) {
    standard = ctx.agentPresets.definitions?.get('standard')?.config
    if (standard) break
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  const dispose = await ctx.agentPresets.register(makePersonalityPreset(standard))
  ctx.effect(() => dispose)
}
