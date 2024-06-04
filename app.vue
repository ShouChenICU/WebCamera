<script setup>
useSeoMeta({
  ogImage: 'https://webcamera.cc/ogImg.webp',
  twitterCard: 'summary_large_image',
  twitterTitle: 'WebCamera',
  twitterDescription:
    'WebRTC-powered Peer-to-Peer webcam surveillance application for real-time monitoring platform.',
  twitterImage: 'https://webcamera.cc/ogImg.webp',
  twitterSite: 'https://webcamera.cc',
  twitterCreator: '@ShouChen_'
})
</script>

<template>
  <NuxtPwaManifest />
  <div class="relative min-h-[100vh]">
    <NavBar />

    <NuxtPage />
  </div>
</template>
