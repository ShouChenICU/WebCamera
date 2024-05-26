<script setup>
const locatePath = useLocalePath()
const colorMode = useColorMode()
const { setLocale, locale } = useI18n()

function switchDark() {
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
</script>

<template>
  <nav
    class="sticky top-0 right-0 left-0 flex flex-row items-center px-4 md:px-6 py-3 shadow bg-white/80 dark:bg-slate-900/80 backdrop-blur z-50"
  >
    <NuxtLink :to="locatePath('/')">WebCamera</NuxtLink>

    <div class="flex-1"></div>

    <div class="contents">
      <UDivider orientation="vertical" class="mx-2 h-4" />

      <UButton variant="ghost" color="gray" size="xl" square @click="switchI18n">
        <template #leading>
          <Icon
            :name="locale === 'zh' ? 'icon-park-outline:chinese' : 'icon-park-outline:english'"
          />
        </template>
      </UButton>

      <UButton variant="ghost" color="gray" size="xl" square @click="switchDark">
        <template #leading>
          <Icon
            :name="colorMode.preference === 'dark' ? 'solar:moon-linear' : 'solar:sun-linear'"
          />
        </template>
      </UButton>
    </div>
  </nav>
</template>
