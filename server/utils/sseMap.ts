import TTLCache from '@isaacs/ttlcache'
import { toISOStringWithTimezone } from '~/utils/DateUtils'

export const sseMap = new TTLCache<string, any>({
  max: 2048,
  ttl: 60e3,
  dispose: (val, key) => {
    try {
      console.log(toISOStringWithTimezone(new Date()) + ' dispose: ' + key)
      val.close()
    } catch (e) {
      console.warn(e)
    }
  }
})
