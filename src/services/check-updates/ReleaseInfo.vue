<script setup>
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import moment from 'moment'
import { toRefs } from 'vue'
import pluralize from 'pluralize'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'
import 'vue3-perfect-scrollbar/dist/vue3-perfect-scrollbar.css'

const props = defineProps({
    releases: {
      type: Array,
      required: true
    },
    appVersion: {
      type: String,
      required: true
    }
  }),
  { releases, appVersion } = toRefs(props)
</script>

<template>
  <div class="version">
    <img class="avatar" :src="releases[0].author.avatar_url" />
    <div>
      <div class="title">
        Your release <span class="emphasize">{{ appVersion }}</span> is {{ releases.length }} {{ pluralize('release', releases.length) }} behind!
      </div>
      <perfect-scrollbar>
        <div class="release" v-for="release in releases" :key="release.id">
          <div class="title">
            <a class="emphasize" :href="release.html_url" target="_blank">{{ release.tag_name }}</a> was released
            <span class="emphasize">{{ moment(release.created_at).local().format('DD MMMM YYYY') }}</span
            >!
          </div>
          <div v-html="DOMPurify.sanitize(marked(release.body))"></div>
        </div>
      </perfect-scrollbar>
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

.ps
  max-height 20em

  .release
    background-color #2186F3
    border-radius 10px
    margin-top: 1em
    padding 1em
    box-shadow 3px 3px 3px rgba(0,0,0,0.32)
    width 96%

.title
  margin-bottom 1em
</style>

<style lang="stylus">
.version
  ul
    margin-left 1em
</style>
