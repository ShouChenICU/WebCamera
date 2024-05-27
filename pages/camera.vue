<script setup lang="ts">
const videoElm = ref()
const curStream = ref<MediaStream>()
const curVideoDevInfo = ref({ id: undefined, label: undefined })
const curAudioDevInfo = ref({ id: undefined, label: undefined })
const videoDevList = ref<Array<any>>([])
const audioDevList = ref<Array<any>>([])
const isOpenAudio = ref(true)
const isAutoReconnect = ref(false)
const logInfo = ref<any>({
  state: 'disconnected',
  logs: [],
  bytesReceived: 0,
  bytesSent: 0,
  localCandidateType: '',
  remoteCandidateType: ''
})
const connectId = ref()
const isShowConnectId = ref(false)
const isConnecting = ref(false)
const monitorId = ref('')
let peerConnection: RTCPeerConnection | undefined
let dataChannel: RTCDataChannel | undefined
let stateJobId: any

function tryReconnnect() {
  setTimeout(() => {
    if (isAutoReconnect.value && !isConnecting.value && logInfo.value.state !== 'connected') {
      doConnect()
    }
  }, 3000)
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
    monitorId.value = ''
    isConnecting.value = false
    logInfo.value.state = 'disconnected'
    refreshStream()
    tryReconnnect()
  }, 100)
}

function doConnect() {
  if (isConnecting.value || !connectId.value.trim()) {
    return
  }
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'doConnect'
  })
  isConnecting.value = true
  logInfo.value.state = 'connecting'
  monitorId.value = ''

  postEventSource('/api/camera', { connectId: connectId.value }, async (str: string) => {
    const obj = JSON.parse(str)
    if (monitorId.value === '') {
      if (obj.type === 'monitorId') {
        monitorId.value = obj.content
        peerConnection = new RTCPeerConnection({ iceServers: pubIceServers })
        dataChannel = peerConnection.createDataChannel('dataChannel')
        dataChannel.onmessage = async (e) => {
          // console.log('onmessage', e)

          const obj: any = JSON.parse(e.data)
          if (obj.type === 'anwser') {
            await peerConnection?.setRemoteDescription(
              new RTCSessionDescription(JSON.parse(obj.content))
            )
          } else if (obj.type === 'disconnect') {
            disconnect()
          }
        }

        // console.log(curStream.value)

        curStream.value?.getTracks().forEach((t) => {
          // console.log(t)
          peerConnection?.addTrack(t)
        })
        peerConnection.onnegotiationneeded = async (e) => {
          // console.log('onnegotiationneeded', e)
          logInfo.value.logs.push({
            time: toISOStringWithTimezone(new Date()),
            type: 'info',
            content: 'Negotiation SDP'
          })
          if (dataChannel?.readyState === 'open') {
            const offer = await peerConnection?.createOffer()
            await peerConnection?.setLocalDescription(offer)
            dataChannel?.send(JSON.stringify({ type: 'offer', content: JSON.stringify(offer) }))
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
        peerConnection.oniceconnectionstatechange = (e) => {}
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
              body: { id: monitorId.value, type: 'candidate', content: JSON.stringify(candidate) }
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

        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        await $fetch('/api/sendEvent', {
          method: 'post',
          body: { id: monitorId.value, type: 'sdp', content: JSON.stringify(offer) }
        })
      }
    } else {
      if (obj.type === 'sdp') {
        logInfo.value.logs.push({
          time: toISOStringWithTimezone(new Date()),
          type: 'info',
          content: 'Receive sdp: ' + obj.content
        })
        await peerConnection?.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(obj.content))
        )
      } else if (obj.type === 'candidate') {
        logInfo.value.logs.push({
          time: toISOStringWithTimezone(new Date()),
          type: 'info',
          content: 'Receive ice candidate: ' + obj.content
        })
        try {
          peerConnection?.addIceCandidate(new RTCIceCandidate(JSON.parse(obj.content)))
        } catch (e) {
          console.warn('RTCIceCandidate', e, obj)
        }
      }
    }
  })
    .then(() => {
      isConnecting.value = false
      tryReconnnect()
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

function closeStream() {
  if (curStream.value) {
    curStream.value.getTracks().forEach((t) => t.stop())
    curStream.value = undefined
  }
}

async function refreshStream() {
  if (peerConnection && peerConnection.connectionState === 'connected') {
    peerConnection.getSenders().forEach((sender) => {
      peerConnection?.removeTrack(sender)
    })
  }
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
        content: 'VideoDev: ' + curVideoDevInfo.value?.id + ' - ' + curVideoDevInfo.value?.label
      })
      localStorage.setItem('videoDev', JSON.stringify(curVideoDevInfo.value))
    }
    if (curAudioDevInfo.value?.id && isOpenAudio.value) {
      logInfo.value.logs.push({
        time: toISOStringWithTimezone(new Date()),
        type: 'info',
        content: 'AudioDev: ' + curAudioDevInfo.value?.id + ' - ' + curAudioDevInfo.value?.label
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
  if (peerConnection && peerConnection.connectionState === 'connected') {
    curStream.value.getTracks().forEach((t) => peerConnection?.addTrack(t))
  }
  return true
}

onMounted(async () => {
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Camera'
  })
  let tmpDev = localStorage.getItem('videoDev')
  if (tmpDev) {
    curVideoDevInfo.value = JSON.parse(tmpDev)
  }
  tmpDev = localStorage.getItem('audioDev')
  if (tmpDev) {
    curAudioDevInfo.value = JSON.parse(tmpDev)
  }

  if (!(await refreshStream())) {
    return
  }
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

  connectId.value = localStorage.getItem('connectId')
  if (!connectId.value) {
    connectId.value = genRandomString(16)
    localStorage.setItem('connectId', connectId.value)
  }

  const tmp = localStorage.getItem('isAutoReconnect')
  if (tmp === 'true') {
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
  closeStream()
})
</script>

<template>
  <div class="bg-neutral-50 dark:bg-black">
    <div class="overflow-y-auto md:flex md:flex-row p-4">
      <div class="md:flex-1 md:p-4 space-y-4">
        <UFormGroup label="视频设备">
          <USelectMenu :options="videoDevList" v-model="curVideoDevInfo" />
        </UFormGroup>
        <UFormGroup label="音频设备">
          <USelectMenu :options="audioDevList" v-model="curAudioDevInfo" :disabled="!isOpenAudio" />
        </UFormGroup>
        <div class="flex flex-row items-center justify-end gap-4 text-sm">
          <label class="contents">
            <span>开启音频</span>
            <UToggle v-model="isOpenAudio" />
          </label>
        </div>

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
        <div class="flex flex-row items-center justify-end gap-4 text-sm">
          <label class="contents">
            <span>自动连接</span>
            <UToggle v-model="isAutoReconnect" />
          </label>
        </div>
      </div>
      <div class="md:flex-1 md:p-4 mt-8 md:mt-0">
        <video autoplay muted ref="videoElm" class="w-full rounded-md"></video>
      </div>
    </div>

    <LogBar :logInfo="logInfo" />
  </div>
</template>
