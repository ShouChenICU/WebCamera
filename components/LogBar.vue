<script setup>
const { logInfo } = defineProps(['logInfo'])

const logs = computed(() => {
  logInfo.logs.sort((a, b) => (a.time === b.time ? 0 : a.time < b.time ? 1 : -1))
  logInfo.logs = logInfo.logs.slice(0, 100)
  return logInfo.logs
})
</script>

<template>
  <div class="bg-white dark:bg-slate-800 border-t border-color">
    <div class="p-1 text-sm flex flex-row items-center">
      <span>{{ logInfo.state }}</span>

      <div class="flex-1"></div>

      <span>local: {{ logInfo.localCandidateType }}</span>
      <span class="ml-2">remote: {{ logInfo.remoteCandidateType }}</span>
      <span class="ml-2">TX: {{ humanFileSize(logInfo.bytesSent) }}</span>
      <span class="ml-2">RX: {{ humanFileSize(logInfo.bytesReceived) }}</span>
    </div>

    <div class="max-h-[60vh] overflow-y-auto text-xs p-1">
      <p v-for="log in logs">
        <span class="text-neutral-500">{{ log.time }}</span>
        <span
          class="px-1"
          :class="{
            'text-sky-500': log.type === 'info',
            'text-yellow-500': log.type === 'warn',
            'text-red-500': log.type === 'error'
          }"
          >{{ log.type }}</span
        >
        <span>{{ log.content }}</span>
      </p>
    </div>
  </div>
</template>
