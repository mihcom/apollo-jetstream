<script setup>
import Message from './components/Message'
import Timeline from './components/Timeline'
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

<style scoped lang="stylus"></style>
