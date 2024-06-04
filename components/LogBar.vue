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
    <div class="p-1 text-sm md:flex flex-row items-center">
      <span
        class="inline-flex rounded-full px-2 py-1 flex-row items-center"
        :class="{
          'bg-rose-300 dark:bg-rose-900': logInfo.state !== 'connected',
          'bg-green-400 dark:bg-green-700': logInfo.state === 'connected'
        }"
        ><Icon
          class="mr-1"
          :name="
            logInfo.state === 'connected'
              ? 'solar:link-round-angle-bold'
              : 'solar:link-broken-minimalistic-bold'
          "
        />{{ logInfo.state }}</span
      >

      <div class="md:ml-2 px-1">
        local:
        {{
          logInfo?.local?.protocol +
          ' ' +
          logInfo?.local?.address +
          ':' +
          logInfo?.local?.port +
          ' ' +
          logInfo?.local?.candidateType
        }}
      </div>
      <div class="md:ml-2 px-1">
        remote:
        {{
          logInfo?.remote?.protocol +
          ' ' +
          logInfo?.remote?.address +
          ':' +
          logInfo?.remote?.port +
          ' ' +
          logInfo?.remote?.candidateType
        }}
      </div>

      <span class="md:flex-1"></span>

      <div class="ml-2 inline-block">Tx: {{ humanFileSize(logInfo.bytesSent) }}</div>
      <div class="ml-2 inline-block">Rx: {{ humanFileSize(logInfo.bytesReceived) }}</div>
    </div>

    <div
      class="max-h-[50vh] overflow-y-auto overflow-x-hidden break-words break-all text-xs p-1 pb-4"
    >
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
