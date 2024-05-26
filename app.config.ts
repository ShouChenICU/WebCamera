export default defineAppConfig({
  ui: {
    primary: 'blue',
    gray: 'slate',

    notifications: {
      // Show toasts at the top right of the screen
      position: 'top-auto bottom-4'
    }
  },

  navLinks: [
    { icon: 'i-solar-home-2-linear', key: 'home', link: '/' },
    { icon: 'solar:cup-line-duotone', key: 'about', link: '/about' }
  ]
})
