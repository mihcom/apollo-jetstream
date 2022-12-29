<script setup>
import JetStream from './components/JetStream.vue'
import Timeline from './components/Timeline.vue'
</script>

<template>
  <v-app theme="dark">
    <v-main>
      <JetStream />
    </v-main>
    <v-footer app>
      <Timeline />
    </v-footer>
  </v-app>
</template>

<style scoped></style>
