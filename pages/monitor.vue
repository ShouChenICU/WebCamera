<script setup lang="ts">
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
const connectId = ref()
const isConnecting = ref(false)
let peerConnection: RTCPeerConnection | undefined
let dataChannel: RTCDataChannel | undefined
let stateJobId: any

function closeStream() {
  if (curStream.value) {
    curStream.value.getTracks().forEach((t) => t.stop())
    curStream.value = undefined
    videoElm.value.srcObject = undefined
  }
}

function disconnect() {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'disconnect' }))
  }
  clearInterval(stateJobId)
  setTimeout(() => {
    logInfo.value.logs.push({
      time: toISOStringWithTimezone(new Date()),
      type: 'info',
      content: 'disconnect'
    })
    if (peerConnection) {
      closeRTCPeerConnection(peerConnection)
      peerConnection = undefined
      dataChannel = undefined
    }
    isConnecting.value = false
    logInfo.value.state = 'disconnected'
    closeStream()
  }, 100)
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

  peerConnection = new RTCPeerConnection({ iceServers: pubIceServers })
  //   peerConnection.createDataChannel('demo')
  // peerConnection.onnegotiationneeded = (e) => {
  //   console.log('onnegotiationneeded', e)
  // }
  peerConnection.ondatachannel = (e) => {
    dataChannel = e.channel
    dataChannel.onmessage = async (e) => {
      // console.log('onmessage', e)
      const obj: any = JSON.stringify(e.data)
      if (obj.type === 'offer') {
        await peerConnection?.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(obj.content))
        )
        const anwser = await peerConnection?.createAnswer()
        await peerConnection?.setLocalDescription(anwser)
        // 这里发不回去的
        dataChannel?.send(JSON.stringify({ type: 'anwser', content: JSON.stringify(anwser) }))
      } else if (obj.type === 'disconnect') {
        disconnect()
      }
    }
  }
  peerConnection.onconnectionstatechange = (e) => {
    if (peerConnection?.connectionState === 'connected') {
      isConnecting.value = false
      logInfo.value.state = 'connected'
      stateJobId = setInterval(async () => {
        const states = await peerConnection?.getStats()
        states?.forEach(async (s) => {
          // console.log(s)
          if (s.type === 'candidate-pair' && s?.nominated) {
            // console.log(s);
            logInfo.value.bytesSent = s?.bytesSent
            logInfo.value.bytesReceived = s?.bytesReceived
            const localCandidate = states.get(s.localCandidateId)
            const localCandidateType = localCandidate?.candidateType
            logInfo.value.localCandidateType = localCandidateType
            const remoteCandidate = states.get(s.remoteCandidateId)
            const remoteCandidateType = remoteCandidate?.candidateType
            logInfo.value.remoteCandidateType = remoteCandidateType
          }
        })
      }, 1000)

      // console.log(peerConnection)

      localStorage.setItem('connectId', connectId.value)
    } else if (
      ['disconnected', 'closed', 'failed'].includes(peerConnection?.connectionState + '')
    ) {
      isConnecting.value = false
      disconnect()
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
    // logInfo.value.logs.push({
    //   time: toISOStringWithTimezone(new Date()),
    //   type: 'warn',
    //   content: e + ''
    // })
    console.warn(e)
  }
  peerConnection.ontrack = (e) => {
    // console.log(e)
    curStream.value?.addTrack(e.track)
  }

  //   const offer = await peerConnection.createOffer()
  //   await peerConnection.setLocalDescription(offer)

  postEventSource('/api/monitor', { connectId: connectId.value }, async (str: string) => {
    if (!peerConnection) {
      throw new Error('RTCPeerConnection is undefined')
    }
    const obj = JSON.parse(str)

    if (obj.type === 'sdp') {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Receive sdp: ' + obj.content
      })
      await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(obj.content)))

      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Send anwser: ' + answer.sdp
      })
      await $fetch('/api/sendEvent', {
        method: 'post',
        body: { id: connectId.value, type: 'sdp', content: JSON.stringify(answer) }
      })
    } else if (obj.type === 'candidate') {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'Receive ice candidate: ' + obj.content
      })
      peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(obj.content)))
    }
  })
    .then(() => {
      isConnecting.value = false
    })
    .catch((e) => {
      console.warn(e)
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
  connectId.value = localStorage.getItem('connectId')
  if (!connectId.value) {
    connectId.value = ''
  }
})
</script>

<template>
  <div class="bg-neutral-50 dark:bg-black">
    <div class="overflow-y-auto md:flex md:flex-row p-4">
      <div class="md:flex-1 md:p-4 space-y-4">
        <UFormGroup label="连接串">
          <UInput
            :type="isShowConnectId ? 'text' : 'password'"
            v-model="connectId"
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
