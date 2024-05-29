<script setup lang="ts">
import { RTCNode } from '#imports'
import { SSE } from 'sse.js'

const curStream = ref<MediaStream>()
const videoElm = ref()
const logInfo = ref<any>({
  state: 'disconnected',
  logs: [],
  bytesReceived: 0,
  bytesSent: 0,
  localCandidateType: '',
  remoteCandidateType: ''
})
const isShowConnectId = ref(false)
const cameraId = ref()
const monitorId = ref('')
const isConnecting = ref(false)
const sse = shallowRef<SSE>()
const rtcNode = shallowRef<RTCNode>()
let stateJobId: any

function closeStream() {
  if (curStream.value) {
    curStream.value.getTracks().forEach((t) => t.stop())
    curStream.value = undefined
    videoElm.value.srcObject = undefined
  }
}

function disconnect() {
  clearInterval(stateJobId)
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

function connectSignServer() {
  if (!sse.value || sse.value.readyState !== SSE.OPEN) {
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
      if (e.readyState === 2) {
        logInfo.value.logs.push({
          time: toISOStringWithTimezone(new Date()),
          type: 'warn',
          content: 'Sign server disconnected'
        })
        setTimeout(() => {
          if (rtcNode.value?.isConnected()) {
            connectSignServer()
          }
        }, 10)
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
  rtcNode.value = new RTCNode()
  rtcNode.value.onConnected = () => {
    isConnecting.value = false
    logInfo.value.state = 'connected'
    videoElm.value.srcObject = curStream.value
    stateJobId = setInterval(async () => {
      const info = await rtcNode.value?.getInfo()
      logInfo.value.bytesSent = info?.bytesSent
      logInfo.value.bytesReceived = info?.bytesReceived
      logInfo.value.localCandidateType = info?.localCandidateType
      logInfo.value.remoteCandidateType = info?.remoteCandidateType
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
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="bg-neutral-50 dark:bg-black">
    <div class="overflow-y-auto md:flex md:flex-row p-4">
      <div class="md:flex-1 md:p-4 space-y-4">
        <UFormGroup label="连接串">
          <UInput
            :type="isShowConnectId ? 'text' : 'password'"
            v-model="cameraId"
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
            >连接</UButton
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
            >断开连接</UButton
          >
        </div>
      </div>

      <div class="md:flex-1 md:p-4 mt-8 md:mt-0">
        <video controls autoplay ref="videoElm" class="w-full rounded-md"></video>
      </div>
    </div>

    <LogBar :logInfo="logInfo" />
  </div>
</template>
