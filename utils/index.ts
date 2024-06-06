export function genRandomString(length: number): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let randomString = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    randomString += charset.charAt(randomIndex)
  }
  return randomString
}

export function postEventSource(url: string, data: any, eventHandler: Function) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then((response) => {
      if (!response.ok) {
        if (response.statusText) {
          throw Error(response.statusText)
        }
        throw new Error('Network response was not ok')
      }
      const contentType = response.headers.get('Content-Type')
      if (!contentType || !contentType.includes('text/event-stream')) {
        throw new Error('Expected text/event-stream content type')
      }
      if (response.body !== null) {
        return response.body.getReader()
      } else {
        throw new Error('Response body is null')
      }
    })
    .then((reader) => {
      const decoder = new TextDecoder()
      let buffer = ''

      async function processText(text: string) {
        buffer += text
        let newlineIndex
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)

          if (line.startsWith('data:')) {
            const eventData = line.slice(5).trim()
            // const parsedData = JSON.parse(eventData)
            await eventHandler(eventData)
          }
        }
      }
      async function read() {
        const { done, value } = await reader.read()
        if (done) {
          // console.log('Stream complete')
          return
        }
        const chunk = decoder.decode(value, { stream: true })
        await processText(chunk)
        return read()
      }
      return read()
    })
}

export function closeRTCPeerConnection(peerConnection: RTCPeerConnection): void {
  if (!peerConnection) {
    console.error('Invalid RTCPeerConnection object')
    return
  }

  // 停止发送的媒体轨道
  peerConnection.getSenders().forEach((sender) => {
    if (sender.track) {
      sender.track.stop()
    }
  })

  // 停止接收的媒体轨道
  peerConnection.getReceivers().forEach((receiver) => {
    if (receiver.track) {
      receiver.track.stop()
    }
  })

  // 关闭所有的数据通道
  if ((peerConnection as any).dataChannels) {
    ;(peerConnection as any).dataChannels.forEach((channel: RTCDataChannel) => {
      channel.close()
    })
  }

  // 移除所有的事件监听器
  peerConnection.onicecandidate = null
  peerConnection.ontrack = null
  peerConnection.ondatachannel = null
  peerConnection.oniceconnectionstatechange = null
  peerConnection.onsignalingstatechange = null
  peerConnection.onicegatheringstatechange = null
  peerConnection.onnegotiationneeded = null

  // 关闭 RTCPeerConnection
  peerConnection.close()
  //   console.log('RTCPeerConnection closed')
}

/**
 * 将字节格式化为人类友好的文本
 *
 * @param bytes 字节数量
 * @param decimals 显示的小数位数
 *
 * @return 格式化后的字符串
 */
export function humanFileSize(bytes: number, decimals = 2) {
  if (!bytes) return '0B'
  var k = 1024
  var dm = decimals || 2
  var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  var i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i]
}

/**
 * 判断浏览器是否支持现代文件操作
 */
export function isModernFileAPIAvailable() {
  const fileHandleSupported = 'FileSystemFileHandle' in window
  const openFilePickerSupported = 'showOpenFilePicker' in window
  const saveFilePickerSupported = 'showSaveFilePicker' in window
  const directoryPickerSupported = 'showDirectoryPicker' in window

  return (
    fileHandleSupported &&
    openFilePickerSupported &&
    saveFilePickerSupported &&
    directoryPickerSupported
  )
}

export function doDownloadFromHref(href: string, filename: string) {
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * 从Blob下载
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function doDownloadFromBlob(blob: Blob | File, filename: string) {
  const objUrl = URL.createObjectURL(blob)
  doDownloadFromHref(objUrl, filename)
  URL.revokeObjectURL(objUrl)
}

export function getRecordMimeTypes() {
  const mimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo'
  ]
  return mimeTypes.filter((t) => MediaRecorder.isTypeSupported(t))
}
