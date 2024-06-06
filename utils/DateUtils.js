/**
 * 格式化日期
 * @param {Date} date 日期
 * @param {string} format 格式化字符串
 * @returns 格式化的日期
 */
export function formatDateTime(date, format) {
  const re = /(y+)/
  if (re.test(format)) {
    const t = re.exec(format)[1]
    format = format.replace(t, (date.getFullYear() + '').substring(4 - t.length))
  }

  const o = {
    'M+': date.getMonth() + 1, // 月份
    'd+': date.getDate(), // 日
    'H+': date.getHours(), // 小时
    'm+': date.getMinutes(), // 分
    's+': date.getSeconds(), // 秒
    'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
    S: date.getMilliseconds() // 毫秒
  }
  for (let k in o) {
    const regx = new RegExp('(' + k + ')')
    if (regx.test(format)) {
      const t = regx.exec(format)[1]
      format = format.replace(t, t.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length))
    }
  }
  return format
}

/**
 * 将毫秒数格式化为 HH:mm:ss
 * @param {number} milliseconds
 * @returns
 */
export function formatTime(milliseconds) {
  // 计算小时数
  const hours = Math.floor(milliseconds / (1000 * 60 * 60))
  // 计算剩余的分钟数
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
  // 计算剩余的秒数
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000)

  // 格式化分钟和秒数为两位数
  const formattedMinutes = minutes.toString().padStart(2, '0')
  const formattedSeconds = seconds.toString().padStart(2, '0')

  return `${hours}:${formattedMinutes}:${formattedSeconds}`
}

export function currentTime(format) {
  if (format === undefined) {
    format = 'yyyy/MM/dd HH:mm:ss'
  }
  return formatDateTime(new Date(), format)
}

/**
 * 给定日期返回距今的时间偏移，超过7天返回正常日期格式化字符串
 * @param {Date} date 日期
 * @param {function} t i18n函数
 * @returns 格式化字符串
 */
export function timeAgo(date, t) {
  if (!date) {
    return ''
  }
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const now = new Date()
  const diffMs = Math.abs(now - date)
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay <= 7) {
    if (diffDay === 0) {
      if (diffHour === 0) {
        if (diffMin === 0) {
          return t('label.secondsAgo', { n: diffSec })
        } else {
          return t('label.minutesAgo', { n: diffMin })
        }
      } else {
        return t('label.hoursAgo', { n: diffHour })
      }
    } else {
      return t('label.daysAgo', { n: diffDay })
    }
  } else {
    return formatDateTime(date, 'yyyy/MM/dd')
  }
}

export function timeRecent(date) {
  if (!date) {
    return ''
  }
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const now = new Date()
  const diffMs = Math.abs(now - date)
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay <= 1) {
    return formatDateTime(date, 'HH:mm:ss')
  } else {
    return formatDateTime(date, 'yyyy/MM/dd HH:mm:ss')
  }
}

export function toISOStringWithTimezone(date) {
  function pad(number) {
    if (number < 10) {
      return '0' + number
    }
    return number
  }

  var offset = date.getTimezoneOffset()
  var offsetHours = Math.abs(offset / 60)
  var offsetMinutes = Math.abs(offset % 60)
  var timezoneOffset = (offset >= 0 ? '-' : '+') + pad(offsetHours) + ':' + pad(offsetMinutes)

  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    '.' +
    date.getMilliseconds() +
    timezoneOffset
  )
}
