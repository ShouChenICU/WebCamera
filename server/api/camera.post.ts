export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // console.log(body)

  const connectId = body?.connectId

  if (!connectId) {
    throw createError({ statusCode: 400, statusText: 'Bad Request' })
  }

  const tmpEs = sseMap.get(connectId)
  if (tmpEs) {
    throw createError({ statusCode: 400, statusText: 'Connect id already exists' })
  }

  const es = createEventStream(event)
  sseMap.set(connectId, es)

  es.onClosed(async () => {
    sseMap.delete(connectId)
    await es.close()
  })

  return es.send()
})
