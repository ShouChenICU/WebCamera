<script setup>
const curStream = ref()
const videoElm = ref()
const logInfo = ref({ state: 'disconnected', logs: [] })
const connectId = ref('')
const isConnecting = ref(false)
let peerConnection

function closeStream() {
  if (curStream.value) {
    curStream.value.getTracks().forEach((t) => t.stop())
    curStream.value = undefined
    videoElm.value.srcObject = undefined
  }
}

function disconnect() {
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'disconnect'
  })
  if (peerConnection) {
    closeRTCPeerConnection(peerConnection)
    isConnecting.value = false
    logInfo.state = 'disconnected'
  }
  closeStream()
}

async function doConnect() {
  if (isConnecting.value || !connectId.value.trim()) {
    return
  }
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'doConnect'
  })
  closeStream()
  curStream.value = new MediaStream()
  videoElm.value.srcObject = curStream.value
  isConnecting.value = true
  logInfo.value.state = 'connecting'

  peerConnection = new RTCPeerConnection()
  peerConnection.createDataChannel('demo')
  peerConnection.onconnectionstatechange = (e) => {
    if (peerConnection.connectionState === 'connected') {
      isConnecting.value = false
      logInfo.value.state = 'connected'
    } else if (peerConnection.connectionState === 'disconnected') {
      isConnecting.value = false
      logInfo.value.state = 'disconnected'
    } else if (peerConnection.connectionState === 'closed') {
      isConnecting.value = false
      logInfo.value.state = 'closed'
    } else if (peerConnection.connectionState === 'failed') {
      isConnecting.value = false
      logInfo.value.state = 'failed'
    }
  }
  peerConnection.onicecandidate = async (e) => {
    const candidate = e?.candidate
    if (candidate?.candidate) {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Send ice candidate: ' + candidate.candidate
      })
      await $fetch('/api/sendEvent', {
        method: 'post',
        body: { id: connectId.value, type: 'candidate', content: JSON.stringify(candidate) }
      })
    }
  }
  peerConnection.onicecandidateerror = (e) => {
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'warn',
      content: e + ''
    })
    console.warn(e)
  }
  peerConnection.ontrack = (e) => {
    console.log(e)

    curStream.value.addTrack(e.track)
  }

  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  postEventSource(
    '/api/monitor',
    { connectId: connectId.value, sdp: JSON.stringify(offer) },
    async (str) => {
      const obj = JSON.parse(str)

      if (obj.type === 'sdp') {
        logInfo.value.logs.push({
          time: toISOStringWithTimezone(new Date()),
          type: 'info',
          content: 'Receive sdp: ' + obj.content
        })
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(obj.content))
        )
      } else if (obj.type === 'candidate') {
        logInfo.value.logs.push({
          time: toISOStringWithTimezone(new Date()),
          type: 'info',
          content: 'Receive ice candidate: ' + obj.content
        })
        peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(obj.content)))
      }
    }
  )
    .then(() => {
      isConnecting.value = false
    })
    .catch((e) => {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'warn',
        content: e + ''
      })
      disconnect()
    })
}

onMounted(() => {
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Monitor'
  })
})
</script>

<template>
  <div class="bg-neutral-50 dark:bg-black">
    <div class="overflow-auto md:flex md:flex-row p-4">
      <div class="md:flex-1 md:p-4 space-y-4">
        <UFormGroup label="连接串">
          <UInput type="text" v-model="connectId" />
        </UFormGroup>

        <div class="mt-8">
          <UButton block variant="outline" size="lg" @click="doConnect">连接</UButton>
        </div>
      </div>

      <div class="md:flex-1 md:p-4 mt-8 md:mt-0">
        <video controls autoplay ref="videoElm" class="w-full rounded-md"></video>
      </div>
    </div>

    <LogBar :logInfo="logInfo" />
  </div>
</template>
