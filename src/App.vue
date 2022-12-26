<template>
  <v-app>
    <v-main>
      <JetStream />
    </v-main>
    <v-footer app theme="dark">
      <Timeline />
    </v-footer>
  </v-app>
</template>

<script>
import JetStream from './components/JetStream.vue'
import Timeline from './components/Timeline.vue'

export default {
  name: 'App',

  components: {
    JetStream,
    Timeline
  }
}
</script>

<style scoped></style>
