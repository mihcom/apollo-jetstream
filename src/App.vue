<script setup>
import JetStream from './components/JetStream.vue'
import Timeline from './components/Timeline.vue'
</script>

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

<style scoped></style>
