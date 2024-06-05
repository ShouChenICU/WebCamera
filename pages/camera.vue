<script setup lang="ts">
import { RTCNode } from '#imports'
import { SSE } from 'sse.js'

const { t } = useI18n()
const navHeight = useNavHeight()
const videoElm = ref()

// 当前媒体流
const curStream = ref<MediaStream>()

// 当前音视频设备
const curVideoDevInfo = ref({ id: undefined, label: undefined })
const curAudioDevInfo = ref({ id: undefined, label: undefined })

// 可选音视频设备
const videoDevList = ref<Array<any>>([])
const audioDevList = ref<Array<any>>([])

const isOpenAudio = ref(true)

// 是否开启自动重联
const isAutoReconnect = ref(false)

// 日志信息
const logInfo = ref<any>({
  state: 'disconnected',
  logs: [],
  bytesReceived: 0,
  bytesSent: 0,
  local: {
    address: '',
    port: '',
    protocol: '',
    candidateType: ''
  },
  remote: {
    address: '',
    port: '',
    protocol: '',
    candidateType: ''
  }
})

const cameraId = ref()
const monitorId = ref('')
const isShowConnectId = ref(false)
const isConnecting = ref(false)

// 连接信令服务器的EventSource
const sse = shallowRef<SSE>()

// RTC封装
const rtcNode = shallowRef<RTCNode>()

let stateJobId: any
let watchDogJonId: any

useSeoMeta({
  title: t('btn.camera')
})

/**
 * 摄像头自动尝试重连
 */
function tryReconnnect() {
  setTimeout(() => {
    if (!isAutoReconnect.value || isConnecting.value || rtcNode.value?.isConnected()) {
      return
    }
    doConnect()
  }, 3000)
}

/**
 * 断开连接并清理资源
 */
function disconnect() {
  clearInterval(stateJobId)
  clearInterval(watchDogJonId)
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Disconnect'
  })
  monitorId.value = ''
  isConnecting.value = false
  logInfo.value.state = 'disconnected'
  rtcNode.value?.dispose()
  sse.value?.close()
  refreshStream()
  tryReconnnect()
}

/**
 * 连接信令服务器
 */
function connectSignServer() {
  if (!sse.value || sse.value.readyState !== 1) {
    // 如果SSE不存在或者状态不是连接，则初始化
    // 注意这里 SSE.OPEN 取不到值，使用数字1
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'info',
      content: 'Connecting sign server'
    })
    sse.value = new SSE('/api/camera', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ cameraId: cameraId.value }),
      start: false
    })
    sse.value.onopen = () => {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Sign server connected'
      })
    }

    sse.value.onerror = (e) => {
      console.warn(e)
    }
    sse.value.onreadystatechange = (e) => {
      if (sse.value?.readyState === 2) {
        logInfo.value.logs.push({
          time: toISOStringWithTimezone(new Date()),
          type: 'warn',
          content: 'Sign server disconnected'
        })
        setTimeout(() => {
          if (rtcNode.value?.isConnected() || isConnecting.value) {
            connectSignServer()
          }
        }, 500)
      }
    }
  }

  sse.value.onmessage = (e) => {
    // console.log(e)

    const obj = JSON.parse(e.data)
    if (obj?.type === 'sdp') {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Receive SDP type: ' + obj.content?.type
      })
      rtcNode.value?.setRemoteSDP(obj.content)
    } else if (obj?.type === 'candidate') {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Receive candidate: ' + JSON.stringify(obj.content)
      })
      rtcNode.value?.addICECandidate(obj.content)
    } else if (obj.type === 'monitorId') {
      if (isConnecting.value && !rtcNode.value?.isConnected()) {
        monitorId.value = obj.content
        if (curStream.value) {
          rtcNode.value?.updateStream(curStream.value)

          // 超时检测
          watchDogJonId = setTimeout(() => {
            if (isConnecting.value) {
              logInfo.value.logs.push({
                time: toISOStringWithTimezone(new Date()),
                type: 'error',
                content: 'Connect timeout'
              })
              disconnect()
            }
          }, 20e3)
        }
      }
    }
  }
  sse.value?.stream()
}

/**
 * 开始连接
 */
function doConnect() {
  if (isConnecting.value || !cameraId.value.trim()) {
    return
  }
  localStorage.setItem('cameraId', cameraId.value)
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Do connecting...'
  })
  isConnecting.value = true
  monitorId.value = ''
  logInfo.value.state = 'connecting'

  rtcNode.value?.dispose()
  // refreshStream()
  rtcNode.value = new RTCNode(pubIceServers)
  rtcNode.value.onConnected = () => {
    isConnecting.value = false
    logInfo.value.state = 'connected'
    stateJobId = setInterval(async () => {
      const info = await rtcNode.value?.getInfo()
      logInfo.value.bytesSent = info?.bytesSent
      logInfo.value.bytesReceived = info?.bytesReceived
      logInfo.value.local = info?.local
      logInfo.value.remote = info?.remote
    }, 1000)
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'info',
      content: 'Connected'
    })
  }
  rtcNode.value.onDispose = disconnect
  rtcNode.value.onError = (e) => {
    console.warn(e)
  }
  rtcNode.value.onSDP = (sdp) => {
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'info',
      content: 'Send SDP, type: ' + sdp.type
    })
    $fetch('/api/sendEvent', {
      method: 'post',
      body: { id: monitorId.value, type: 'sdp', content: sdp }
    })
  }
  rtcNode.value.onICECandidate = (candidate) => {
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'info',
      content: 'Send candidate: ' + JSON.stringify(candidate)
    })
    $fetch('/api/sendEvent', {
      method: 'post',
      body: { id: monitorId.value, type: 'candidate', content: candidate }
    })
  }

  connectSignServer()
}

/**
 * 关闭当前媒体流
 */
function closeStream() {
  if (curStream.value) {
    curStream.value.getTracks().forEach((t) => t.stop())
    curStream.value = undefined
  }
}

/**
 * 刷新媒体流
 */
async function refreshStream() {
  closeStream()
  try {
    curStream.value = await navigator?.mediaDevices?.getUserMedia({
      video: { deviceId: curVideoDevInfo.value.id },
      audio: isOpenAudio.value ? { deviceId: curAudioDevInfo.value.id } : false
    })
    if (!curStream.value) {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'error',
        content: 'Audio and video are not authorized!'
      })
      return false
    }

    if (curVideoDevInfo.value?.id) {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Video dev: ' + curVideoDevInfo.value?.id + ' - ' + curVideoDevInfo.value?.label
      })
      localStorage.setItem('videoDev', JSON.stringify(curVideoDevInfo.value))
    }
    if (curAudioDevInfo.value?.id && isOpenAudio.value) {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Audio dev: ' + curAudioDevInfo.value?.id + ' - ' + curAudioDevInfo.value?.label
      })
      localStorage.setItem('audioDev', JSON.stringify(curAudioDevInfo.value))
    }
    videoElm.value.srcObject = curStream.value
  } catch (e) {
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'error',
      content: 'Audio and video are not authorized!'
    })
    return false
  }

  if (rtcNode.value?.isConnected()) {
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'info',
      content: 'Update stream'
    })
    rtcNode.value?.updateStream(curStream.value)
  }

  return true
}

onMounted(async () => {
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Camera'
  })

  // 尝试使用上次选择的设备
  let tmpDev = localStorage.getItem('videoDev')
  if (tmpDev) {
    curVideoDevInfo.value = JSON.parse(tmpDev)
  }
  tmpDev = localStorage.getItem('audioDev')
  if (tmpDev) {
    curAudioDevInfo.value = JSON.parse(tmpDev)
  }

  // 更新媒体流
  if (!(await refreshStream())) {
    return
  }

  // 枚举媒体设备
  const devs = await navigator?.mediaDevices?.enumerateDevices()
  const devInfoMap: any = {}
  for (const dev of devs) {
    const devInfo = { id: dev.deviceId, label: dev.label }
    devInfoMap[dev.deviceId] = devInfo
    if (dev.kind === 'videoinput') {
      videoDevList.value.push(devInfo)
    } else if (dev.kind === 'audioinput') {
      audioDevList.value.push(devInfo)
    }
  }
  const videoTracks = curStream.value?.getVideoTracks()
  //   console.log(videoTracks)
  if (videoTracks && videoTracks.length > 0) {
    const vt = videoTracks[0]
    const setting = vt.getSettings()
    curVideoDevInfo.value = devInfoMap[setting.deviceId + '']
  }
  const audioTracks = curStream.value?.getAudioTracks()
  if (audioTracks && audioTracks.length > 0) {
    const at = audioTracks[0]
    const setting = at.getSettings()
    curAudioDevInfo.value = devInfoMap[setting.deviceId + '']
  }
  localStorage.setItem('videoDev', JSON.stringify(curVideoDevInfo.value))
  localStorage.setItem('audioDev', JSON.stringify(curAudioDevInfo.value))

  watch(curAudioDevInfo, refreshStream)
  watch(curVideoDevInfo, refreshStream)
  watch(isOpenAudio, refreshStream)

  // 获取上次使用的连接ID
  cameraId.value = localStorage.getItem('cameraId')
  if (!cameraId.value) {
    cameraId.value = genRandomString(16)
    localStorage.setItem('cameraId', cameraId.value)
  }

  const tmpIsAutoReconnect = localStorage.getItem('isAutoReconnect')
  if (tmpIsAutoReconnect === 'true') {
    isAutoReconnect.value = true
    tryReconnnect()
  } else {
    isAutoReconnect.value = false
  }
  watch(isAutoReconnect, (val) => {
    localStorage.setItem('isAutoReconnect', val + '')
    if (val) {
      tryReconnnect()
    }
  })
})

onUnmounted(() => {
  rtcNode.value?.dispose()
  sse.value?.close()
  closeStream()
})
</script>

<template>
  <div class="bg-neutral-50 dark:bg-black" :style="{ 'padding-top': navHeight + 'px' }">
    <div class="overflow-y-auto md:flex md:flex-row p-4">
      <div class="md:flex-1 md:p-4 space-y-4">
        <UFormGroup :label="$t('label.videoDev')">
          <USelectMenu :options="videoDevList" v-model="curVideoDevInfo" :disabled="isConnecting" />
        </UFormGroup>
        <UFormGroup :label="$t('label.audioDev')">
          <USelectMenu
            :options="audioDevList"
            v-model="curAudioDevInfo"
            :disabled="!isOpenAudio || isConnecting"
          />
        </UFormGroup>
        <div class="flex flex-row items-center justify-end gap-4 text-sm">
          <label class="contents">
            <span>{{ $t('btn.openAudio') }}</span>
            <UToggle v-model="isOpenAudio" :disabled="isConnecting" />
          </label>
        </div>

        <UFormGroup :label="$t('label.connectionID')">
          <UInput
            :type="isShowConnectId ? 'text' : 'password'"
            v-model="cameraId"
            :disabled="isConnecting"
            :ui="{ icon: { trailing: { pointer: '' } } }"
          >
            <template #trailing>
              <UButton
                @click="isShowConnectId = !isShowConnectId"
                variant="ghost"
                color="gray"
                square
                ><template #leading
                  ><Icon
                    :name="
                      isShowConnectId ? 'solar:eye-linear' : 'solar:eye-closed-line-duotone'
                    " /></template
              ></UButton>
            </template>
          </UInput>
        </UFormGroup>

        <div>
          <UButton
            block
            variant="outline"
            size="lg"
            class="mt-8"
            @click="doConnect"
            v-show="logInfo.state !== 'connected'"
            :loading="isConnecting"
            ><template #leading
              ><Icon name="solar:link-round-angle-bold" v-if="!isConnecting" /></template
            >{{ $t('btn.connect') }}</UButton
          >
          <UButton
            block
            variant="outline"
            size="lg"
            color="rose"
            class="mt-8"
            @click="disconnect"
            v-show="logInfo.state === 'connected'"
            ><template #leading
              ><Icon name="solar:link-broken-minimalistic-bold" v-if="!isConnecting" /></template
            >{{ $t('btn.disconnect') }}</UButton
          >
        </div>
        <div class="flex flex-row items-center justify-end gap-4 text-sm">
          <label class="contents">
            <span>{{ $t('btn.autoConnect') }}</span>
            <UToggle v-model="isAutoReconnect" />
          </label>
        </div>
      </div>
      <div class="md:flex-1 md:p-4 mt-8 md:mt-0">
        <video autoplay controls muted ref="videoElm" class="w-full rounded-md"></video>
      </div>
    </div>

    <LogBar :logInfo="logInfo" />
  </div>
</template>
