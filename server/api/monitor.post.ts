import { genRandomString } from '~/utils'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // console.log(body)

  const connectId = body?.connectId
  //   const sdp = body?.sdp

  if (!connectId) {
    throw createError({ statusCode: 400, statusText: 'Bad Request' })
  }

  const cameraEs = sseMap.get(connectId)
  if (!cameraEs) {
    throw createError({ statusCode: 404, statusText: 'Camera not exists' })
  }

  const monitorId = genRandomString(16)
  const tmpEs = sseMap.get(monitorId)
  if (tmpEs) {
    throw createError({
      statusCode: 400,
      statusText: 'Monitor id already exists, please try again'
    })
  }

  const es = createEventStream(event)
  sseMap.set(monitorId, es)

  es.onClosed(async () => {
    sseMap.delete(connectId)
    await es.close()
  })

  await cameraEs.push(JSON.stringify({ type: 'monitorId', content: monitorId }))
  //   await cameraEs.push(JSON.stringify({ type: 'sdp', content: sdp }))

  return es.send()
})
