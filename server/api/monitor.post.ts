export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // console.log(body)

  const monitorId = body?.monitorId
  //   const sdp = body?.sdp

  if (!monitorId) {
    throw createError({ statusCode: 400, statusText: 'Bad Request' })
  }

  const es = createEventStream(event)
  sseMap.set(monitorId, es)

  es.onClosed(async () => {
    sseMap.delete(monitorId)
    await es.close()
  })

  es.push(JSON.stringify({ type: 'heartbeat' }))

  return es.send()
})
