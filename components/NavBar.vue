<script setup>
const locatePath = useLocalePath()
const colorMode = useColorMode()
const { setLocale, locale } = useI18n()
const navElm = ref()
const navHeight = useNavHeight()

function switchDark() {
  // console.log(colorMode)
  if (colorMode.preference === 'dark') {
    colorMode.preference = 'light'
  } else {
    colorMode.preference = 'dark'
  }
}

function switchI18n() {
  if (locale.value === 'en') {
    setLocale('zh')
  } else {
    setLocale('en')
  }
}

onMounted(() => {
  navHeight.value = navElm.value?.getBoundingClientRect()?.height
})
</script>

<template>
  <nav
    ref="navElm"
    class="fixed top-0 right-0 left-0 flex flex-row items-center px-4 md:px-6 py-3 z-50"
  >
    <NuxtLink :to="locatePath('/')" class="contents">
      <img src="/favicon.webp" alt="web camera" class="size-6 mr-2" />
      <div>
        <span>WebCamera</span>
        <span class="ml-2 text-xs">v0.1.2</span>
      </div>
    </NuxtLink>

    <div class="flex-1"></div>

    <div class="contents">
      <!-- <UDivider orientation="vertical" class="mx-2 h-4" /> -->

      <UButton
        variant="ghost"
        color="gray"
        size="xl"
        square
        to="https://github.com/ShouChenICU/WebCamera"
        target="_blank"
      >
        <template #leading>
          <Icon name="mdi:github" />
        </template>
      </UButton>

      <UButton variant="ghost" color="gray" size="xl" square @click="switchI18n">
        <template #leading>
          <Icon name="icon-park-outline:chinese" v-if="locale === 'zh'" />
          <Icon name="icon-park-outline:english" v-else-if="locale === 'en'" />
        </template>
      </UButton>

      <UButton variant="ghost" color="gray" size="xl" square @click="switchDark">
        <template #leading>
          <Icon name="solar:moon-linear" v-if="colorMode.preference === 'dark'" />
          <Icon name="solar:sun-linear" v-else />
        </template>
      </UButton>
    </div>
  </nav>
</template>
