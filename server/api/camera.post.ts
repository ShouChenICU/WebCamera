export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // console.log(body)

  const cameraId = body?.cameraId

  if (!cameraId) {
    throw createError({ statusCode: 400, statusText: 'Bad Request' })
  }

  const tmpEs = sseMap.get(cameraId)
  if (tmpEs) {
    await tmpEs.close()
    // throw createError({ statusCode: 400, statusText: 'Connect id already exists' })
  }

  const es = createEventStream(event)
  sseMap.set(cameraId, es)

  es.onClosed(async () => {
    sseMap.delete(cameraId)
    await es.close()
  })

  es.push(JSON.stringify({ type: 'heartbeat' }))

  return es.send()
})
