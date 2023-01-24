<script setup>
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import moment from 'moment'
import { toRef } from 'vue'

const props = defineProps({
    version: {
      type: Object,
      required: true
    }
  }),
  version = toRef(props, 'version')
</script>

<template>
  <div class="version">
    <img class="avatar" :src="version.author.avatar_url" />
    <div>
      <div class="title">
        New release <a class="emphasize" :href="version.html_url" target="_blank">{{ version.tag_name }}</a> is available since
        <span class="emphasize">{{ moment(version.created_at).local().format('DD MMMM YYYY') }}</span
        >!
      </div>
      <div v-html="DOMPurify.sanitize(marked(version.body))"></div>
    </div>
  </div>
  <div class="actions">
    <div>
      <a href="https://github.com/mihcom/apollo-jetstream/releases" target="_blank">See release history</a>
      <a href="https://github.com/mihcom/apollo-jetstream#running" target="_blank">How to apply?</a>
    </div>
    <button class="button" @click="$emit('ignore')">Ignore</button>
  </div>
</template>

<style scoped lang="stylus">
.version
  display flex

  .avatar
    width 50px
    height 50px
    border-radius 50%
    margin-right 1em

  .title
    margin-bottom 1em

  .emphasize
    font-weight bold

.actions
  margin-top 1em
  display flex
  justify-content space-between

  *
    margin-left 1em

a
  text-decoration none
  color yellow
</style>

<style lang="stylus">
.version
  ul
    margin-left 1em
</style>
