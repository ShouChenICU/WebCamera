<script setup lang="ts">
const locatePath = useLocalePath()
</script>

<template>
  <div>
    <div class="text-center mt-16">
      <h1 class="text-3xl">Web Camera</h1>
      <h2 class="text-base mt-4">基于WebRTC的点对点网络摄像头实时监控工具</h2>
    </div>

    <div class="flex flex-row items-center justify-center gap-8 mt-12">
      <UButton variant="outline" color="rose" size="lg" :to="locatePath('/camera')"
        ><template #leading><Icon name="solar:videocamera-record-outline" /></template
        >{{ $t('btn.camera') }}</UButton
      >

      <UButton variant="outline" color="sky" size="lg" :to="locatePath('/monitor')"
        ><template #leading><Icon name="solar:monitor-camera-line-duotone" /></template
        >{{ $t('btn.monitor') }}</UButton
      >
    </div>
  </div>
</template>
