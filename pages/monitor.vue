<script setup lang="ts">
import { RTCNode } from '#imports'
import type { _1 } from '#tailwind-config/theme/aspectRatio'
import { SSE } from 'sse.js'

const { t } = useI18n()
const navHeight = useNavHeight()

// 当前媒体流
const curStream = ref<MediaStream>()
const videoElm = ref()

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

const isShowConnectId = ref(false)
const cameraId = ref()
const monitorId = ref('')
const isConnecting = ref(false)

// 连接信令服务器的EventSource
const sse = shallowRef<SSE>()

// RTC封装
const rtcNode = shallowRef<RTCNode>()

let stateJobId: any
let watchDogJonId: any

const isModernFileAPISupport = ref(false)

const isRecordSettingModalOpen = ref(false)
const isRecording = ref(false)
const recordingStartTime = ref(0)
const recordingTimeStr = ref('')
const recordSize = ref(0)
const recordSetting = ref({
  mimeType: '',
  bitsPerSecond: 0
})
let videoChunks: Blob[] = []
let fileHandler: FileSystemFileHandle
let mediaRecoder: MediaRecorder

useSeoMeta({
  title: t('btn.monitor')
})

/**
 * 开始录制
 */
async function startRecording() {
  if (isRecording.value || !curStream.value) {
    return
  }
  isRecording.value = true
  recordingStartTime.value = new Date().getTime()
  recordSize.value = 0
  videoChunks = []
  if (isModernFileAPIAvailable()) {
    // 支持现代化文件访问，数据直接写入磁盘
    fileHandler = await showSaveFilePicker({
      startIn: 'downloads',
      suggestedName: 'Video_' + formatDateTime(new Date(), 'yyyyMMddHHmmss') + '.webm'
    })
    const writer = await fileHandler.createWritable()

    mediaRecoder = new MediaRecorder(curStream.value, { mimeType: recordSetting.value.mimeType })
    mediaRecoder.ondataavailable = (ev) => {
      recordingTimeStr.value = formatTime(new Date().getTime() - recordingStartTime.value)
      recordSize.value += ev.data.size
      return writer.write(ev.data)
    }
    mediaRecoder.onerror = console.error
    mediaRecoder.onstop = () => writer.close()
    mediaRecoder.start(200)
  } else {
    // 不支持现代化文件访问，录制数据保存在内存中（注意可能导致OOM

    mediaRecoder = new MediaRecorder(curStream.value, { mimeType: recordSetting.value.mimeType })
    mediaRecoder.ondataavailable = (ev) => {
      const timeDuration = new Date().getTime() - recordingStartTime.value
      recordingTimeStr.value = formatTime(timeDuration)
      recordSize.value += ev.data.size
      videoChunks.push(ev.data)
      if (timeDuration >= 600e3) {
        // 超过十分钟，停止录制，避免OOM
        mediaRecoder.stop()
      }
    }
    mediaRecoder.onerror = console.error
    mediaRecoder.onstop = () => {
      const videoBlob = new Blob(videoChunks, { type: mediaRecoder.mimeType })
      doDownloadFromBlob(
        videoBlob,
        'Video_' + formatDateTime(new Date(), 'yyyyMMddHHmmss') + '.webm'
      )
    }
    mediaRecoder.start(200)
  }
}

/**
 * 结束录制
 */
function stopRecording() {
  mediaRecoder?.stop()
  isRecording.value = false
}

/**
 * 关闭媒体流
 */
function closeStream() {
  if (curStream.value) {
    curStream.value.getTracks().forEach((t) => t.stop())
    curStream.value = undefined
    videoElm.value.srcObject = undefined
  }
}

/**
 * 断开连接并清理资源
 */
function disconnect() {
  stopRecording()
  clearInterval(stateJobId)
  clearInterval(watchDogJonId)
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Disconnect'
  })
  isConnecting.value = false
  logInfo.value.state = 'disconnected'
  rtcNode.value?.dispose()
  sse.value?.close()
  closeStream()
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
    sse.value = new SSE('/api/monitor', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ monitorId: monitorId.value }),
      start: false
    })
    sse.value.onopen = () => {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Sign server connected'
      })
      if (!rtcNode.value || !rtcNode.value.isConnected()) {
        $fetch('/api/sendEvent', {
          method: 'post',
          body: { id: cameraId.value, type: 'monitorId', content: monitorId.value }
        }).catch((e) => {
          console.error(e)
          logInfo.value.logs.push({
            time: toISOStringWithTimezone(new Date()),
            type: 'warn',
            content: 'Camera not found'
          })
          disconnect()
        })
      }
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
          if (rtcNode.value?.isConnected()) {
            connectSignServer()
          }
        }, 500)
      }
    }
  }
  sse.value.onmessage = (e) => {
    const obj = JSON.parse(e.data)
    // console.log(obj)

    if (obj?.type === 'sdp') {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Receive SDP type: ' + obj.content?.type
      })
      rtcNode.value?.setRemoteSDP(obj.content)
      if (!videoElm.value.paused) {
        videoElm.value.pause()
        setTimeout(() => {
          videoElm.value.play()
        }, 100)
      }
    } else if (obj?.type === 'candidate') {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Receive candidate: ' + JSON.stringify(obj.content)
      })
      rtcNode.value?.addICECandidate(obj.content)
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
  localStorage.setItem('connectId', cameraId.value)
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Do connecting...'
  })
  closeStream()
  videoElm.value.srcObject = undefined
  isConnecting.value = true
  logInfo.value.state = 'connecting'

  if (rtcNode) {
    rtcNode.value?.dispose()
  }
  rtcNode.value = new RTCNode(pubIceServers)
  rtcNode.value.onConnected = () => {
    isConnecting.value = false
    logInfo.value.state = 'connected'
    videoElm.value.srcObject = curStream.value
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
      body: { id: cameraId.value, type: 'sdp', content: sdp }
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
      body: { id: cameraId.value, type: 'candidate', content: candidate }
    })
  }
  curStream.value = rtcNode.value.getMediaStream()

  connectSignServer()

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

onMounted(() => {
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Monitor'
  })
  monitorId.value = genRandomString(16)
  cameraId.value = localStorage.getItem('connectId')
  if (!cameraId.value) {
    cameraId.value = ''
  }
  const recordMimeTypes = getRecordMimeTypes()
  if (recordMimeTypes.length > 0) {
    recordSetting.value.mimeType = recordMimeTypes[0]
  }
  isModernFileAPISupport.value = isModernFileAPIAvailable()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="bg-neutral-50 dark:bg-black" :style="{ 'padding-top': navHeight + 'px' }">
    <div class="overflow-y-auto md:flex md:flex-row p-4">
      <div class="md:flex-1 md:p-4 space-y-4">
        <UFormGroup :label="$t('label.connectionID')">
          <UInput
            :type="isShowConnectId ? 'text' : 'password'"
            v-model="cameraId"
            :disabled="isConnecting || logInfo.state === 'connected'"
            :ui="{ icon: { trailing: { pointer: '' } } }"
            size="lg"
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

        <UDivider class="my-8" :label="$t('label.record')" />

        <div class="flex flex-row items-center">
          <span>
            {{ recordingStartTime === 0 ? '00:00:00' : recordingTimeStr }}
          </span>

          <span class="ml-2">{{ humanFileSize(recordSize) }}</span>

          <div class="flex-1"></div>

          <UButton
            variant="ghost"
            color="gray"
            square
            class="mr-2"
            :disabled="isRecording"
            @click="() => (isRecordSettingModalOpen = true)"
            ><template #leading><Icon name="solar:settings-linear" /></template
          ></UButton>

          <UButton color="green" @click="startRecording" v-if="!isRecording"
            ><template #leading><icon name="solar:play-linear" /></template
            >{{ $t('btn.startRec') }}</UButton
          >
          <UButton color="rose" @click="stopRecording" v-else
            ><template #leading><Icon name="solar:stop-linear" /></template
            >{{ $t('btn.stopRec') }}</UButton
          >
        </div>
        <div v-show="!isModernFileAPISupport" class="text-xs">
          <span class="text-red-500">*</span>{{ $t('hint.recHint') }}
        </div>
      </div>

      <div class="md:flex-1 md:p-4 mt-8 md:mt-0">
        <video controls autoplay ref="videoElm" class="w-full rounded-md"></video>
      </div>
    </div>

    <LogBar :logInfo="logInfo" />

    <UModal v-model="isRecordSettingModalOpen">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div>{{ $t('label.recordSettings') }}</div>
        </template>

        <div class="space-y-4">
          <UFormGroup :label="$t('label.format')">
            <USelectMenu :options="getRecordMimeTypes()" v-model="recordSetting.mimeType" />
          </UFormGroup>

          <!-- <UFormGroup :label="$t('label.bps')">
            <UInput type="number" v-model="recordSetting.bitsPerSecond" />
          </UFormGroup> -->
        </div>
      </UCard>
    </UModal>
  </div>
</template>
