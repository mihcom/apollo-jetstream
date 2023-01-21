<script setup>
import Message from './components/Message.vue'
import Timeline from './components/Timeline.vue'
</script>

<template>
  <v-app theme="dark">
    <v-main>
      <Message />
    </v-main>
    <v-footer app>
      <Timeline />
    </v-footer>
  </v-app>
</template>
