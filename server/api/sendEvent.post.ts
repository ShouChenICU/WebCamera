export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  console.log(body)

  const id = body.id
  if (!id) {
    throw createError({ statusCode: 400, statusText: 'Bad Request' })
  }

  const es = sseMap.get(id)
  if (es) {
    throw createError({ statusCode: 404, statusText: 'Not found' })
  }

  await es.push(body)

  return 'success'
})
