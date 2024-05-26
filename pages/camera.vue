<script setup>
const videoElm = ref()
const curStream = ref()
const curVideoDevInfo = ref({ id: undefined })
const curAudioDevInfo = ref({ id: undefined })
const videoDevList = ref([])
const audioDevList = ref([])
const isOpenAudio = ref(true)
const logInfo = ref({ state: 'disconnected', logs: [] })

function closeStream() {
  if (curStream.value) {
    curStream.value.getTracks().forEach((t) => t.stop())
    curStream.value = undefined
  }
}

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
  return true
}

onMounted(async () => {
  logInfo.value.logs.push({
    time: toISOStringWithTimezone(new Date()),
    type: 'info',
    content: 'Hello'
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
  const devInfoMap = {}
  for (const dev of devs) {
    const devInfo = { id: dev.deviceId, label: dev.label }
    devInfoMap[dev.deviceId] = devInfo
    if (dev.kind === 'videoinput') {
      videoDevList.value.push(devInfo)
    } else if (dev.kind === 'audioinput') {
      audioDevList.value.push(devInfo)
    }
  }
  const videoTracks = curStream.value.getVideoTracks()
  //   console.log(videoTracks)
  if (videoTracks.length > 0) {
    const vt = videoTracks[0]
    const setting = vt.getSettings()
    curVideoDevInfo.value = devInfoMap[setting.deviceId]
  }
  const audioTracks = curStream.value.getAudioTracks()
  if (audioTracks.length > 0) {
    const at = audioTracks[0]
    const setting = at.getSettings()
    curAudioDevInfo.value = devInfoMap[setting.deviceId]
  }
  localStorage.setItem('videoDev', JSON.stringify(curVideoDevInfo.value))
  localStorage.setItem('audioDev', JSON.stringify(curAudioDevInfo.value))

  watch(curAudioDevInfo, refreshStream)
  watch(curVideoDevInfo, refreshStream)
  watch(isOpenAudio, refreshStream)
})

onUnmounted(() => {
  closeStream()
})
</script>

<template>
  <div class="bg-neutral-50 dark:bg-black">
    <div class="overflow-auto min-h-[90vh] md:flex md:flex-row p-4">
      <div class="md:flex-1 md:p-4 space-y-4">
        <UFormGroup label="视频设备">
          <USelectMenu :options="videoDevList" v-model="curVideoDevInfo" />
        </UFormGroup>
        <UFormGroup label="音频设备">
          <USelectMenu :options="audioDevList" v-model="curAudioDevInfo" :disabled="!isOpenAudio" />
        </UFormGroup>
        <label class="flex flex-row items-center justify-end gap-4 text-sm">
          <span>开启音频</span>
          <UToggle v-model="isOpenAudio" />
        </label>

        <UFormGroup label="连接串">
          <UInput type="text" />
        </UFormGroup>
      </div>
      <div class="md:flex-1 md:p-4 mt-8 md:mt-0">
        <video autoplay muted ref="videoElm" class="w-full rounded-md"></video>
      </div>
    </div>

    <LogBar :logInfo="logInfo" />
  </div>
</template>
