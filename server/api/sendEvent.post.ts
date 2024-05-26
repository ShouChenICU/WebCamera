export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // console.log('event', body)

  const id = body.id
  const type = body.type
  const content = body.content
  if (!id || !type || !content) {
    throw createError({ statusCode: 400, statusText: 'Bad Request' })
  }

  const es = sseMap.get(id)
  if (!es) {
    throw createError({ statusCode: 404, statusText: 'Not found' })
  }

  await es.push(JSON.stringify({ type: type, content: content }))

  return 'success'
})
