<script setup>
import { onMounted, ref, watch } from 'vue'
import { useJetStreamStore } from '../stores/JetStream.js'
import moment from 'moment'
import { millis } from 'nats.ws'
import groupToMap from 'core-js/actual/array/group-to-map'

const store = useJetStreamStore(),
  trace = ref([]),
  services = ref()

onMounted(() => {
  watch(() => store.selectedMessage, fetchMessageTrace)
  watch(
    trace,
    () => {
      const mappedServices =
        trace.value.value === undefined ? new Map() : groupToMap(trace.value.value, entry => entry.headers.get('Tracing.Headers.Event.Service')[0])

      mappedServices.forEach((value, key) => {
        mappedServices.set(
          key,
          groupToMap(value, entry => entry.headers.get('Tracing.Headers.Handler')[0])
        )
      })

      services.value = mappedServices
    },
    { deep: true }
  )

  fetchMessageTrace()
})

function fetchMessageTrace() {
  const message = store.selectedMessage

  if (!message?.data) {
    trace.value = []
    return
  }

  const stringData = new TextDecoder().decode(message.data)

  if (!stringData || !stringData.length) {
    trace.value = []
    return
  }

  try {
    const messageContent = JSON.parse(new TextDecoder().decode(message.data))
    trace.value = store.fetchMessageTrace(messageContent.messageId)
  } catch {
    trace.value = []
  }
}

function getTraceIcon(traceEntry) {
  const traceType = traceEntry.headers.get('Tracing.Headers.Event.Id')[0]

  switch (traceType) {
    case '1001':
      return 'mdi-arrow-right'

    case '1002':
      return 'mdi-check'

    default:
      return undefined
  }
}

function getTraceColor(traceEntry) {
  const traceType = traceEntry.headers.get('Tracing.Headers.Event.Id')[0]

  switch (traceType) {
    case '1001': // Message processing started
      return 'blue'

    case '1002': // Message processing completed
      // check if there is an exception
      return getTraceException(traceEntry) ? 'red' : 'green'

    default:
      return undefined
  }
}

function getTraceException(traceEntry) {
  const exceptionHeader = traceEntry.headers.get('Tracing.Headers.Exception')

  return exceptionHeader ? exceptionHeader[0].replace('<br/>', '\n') : undefined
}

function getTraceDuration(traceEntry, previousTraceEntry) {
  if (!previousTraceEntry) {
    previousTraceEntry = store.selectedMessage
  }

  const messageTimestamp = traceEntry.info.timestampNanos,
    previousMessageTimestamp = previousTraceEntry.info.timestampNanos

  return millis(messageTimestamp - previousMessageTimestamp)
}

function formatDuration(duration) {
  if (duration < 1000) {
    return `${duration}ms`
  }

  const momentDuration = moment.duration(duration, 'milliseconds')

  if (momentDuration.days() > 0) {
    return `${momentDuration.days()}d ${momentDuration.hours()}h ${momentDuration.minutes()}m ${momentDuration.seconds()}s ${momentDuration.milliseconds()}ms`
  }

  if (momentDuration.hours() > 0) {
    return `${momentDuration.hours()}h ${momentDuration.minutes()}m ${momentDuration.seconds()}s ${momentDuration.milliseconds()}ms`
  }

  if (momentDuration.minutes() > 0) {
    return `${momentDuration.minutes()}m ${momentDuration.seconds()}s ${momentDuration.milliseconds()}ms`
  }

  return `${momentDuration.seconds()}s ${momentDuration.milliseconds()}ms`
}
</script>

<template>
  <div class="message-tracing">
    <div class="header">Message tracing</div>
    <div class="service-traces" v-if="services?.size">
      <div class="service-trace" v-for="service in Array.from(services.keys()).sort()">
        <div class="service-name title">{{ service }} {{ services[service] }}</div>
        <div class="service-handlers">
          <div class="service-handler" v-for="serviceHandler in Array.from(services.get(service).keys()).sort()">
            <div class="service-handler-name title" :title="serviceHandler">
              {{ serviceHandler.split('.').slice(-1)[0] }}
            </div>
            <v-timeline side="end">
              <v-timeline-item :key="store.selectedMessage.seq" icon="mdi-radio-tower" dot-color="#25a5be" line-inset="3">
                <template v-slot:opposite>
                  {{ moment(millis(store.selectedMessage.info.timestampNanos)).format('HH:mm:ss.SSS') }}
                </template>
                <v-alert
                  :value="true"
                  color="#25a5be"
                  @mouseenter="store.selectedTimestamp = store.selectedMessage.info.timestampNanos"
                  @mouseleave="store.selectedTimestamp = undefined"
                  >Message published</v-alert
                >
              </v-timeline-item>
              <v-timeline-item
                v-for="(traceEntry, index) in services.get(service).get(serviceHandler)"
                :key="traceEntry.seq"
                :icon="getTraceIcon(traceEntry)"
                :dot-color="getTraceColor(traceEntry)"
                line-inset="3"
              >
                <template v-slot:opposite>
                  <div class="duration" :class="{ slow: getTraceDuration(traceEntry, services.get(service).get(serviceHandler)[index - 1]) > 20 }">
                    +{{ formatDuration(getTraceDuration(traceEntry, services.get(service).get(serviceHandler)[index - 1])) }}
                  </div>
                  {{ moment(millis(traceEntry.info.timestampNanos)).format('HH:mm:ss.SSS') }}
                </template>
                <v-alert
                  :value="true"
                  :color="getTraceColor(traceEntry)"
                  @mouseenter="store.selectedTimestamp = traceEntry.info.timestampNanos"
                  @mouseleave="store.selectedTimestamp = undefined"
                >
                  {{ getTraceException(traceEntry) || traceEntry.headers.get('Tracing.Headers.Event.Name')[0] }}
                </v-alert>
              </v-timeline-item>
            </v-timeline>
          </div>
        </div>
      </div>
    </div>
    <div class="no-consumers" v-else>No tracing information available</div>
  </div>
</template>

<style scoped lang="stylus">
.message-tracing
  background-color #1e1e1e
  font-size 0.9em
  display flex
  flex-direction column

  .header
    height 33px
    background-color #2f6dd0
    padding-left 0.5em
    display flex
    align-items center
    justify-content center
    margin-bottom 1em

  .v-timeline
    margin-left 1em

  .service-traces
    display flex
    flex 1
    overflow auto

    .service-trace
      padding 0 1em

      .service-handlers
        display flex
        margin-top 1em

        .service-handler
          margin 0 1em
          max-width 40em

          .v-timeline-item
            overflow-wrap break-word

      .title
        text-align center
        border-radius 1em
        padding 0.3em

      .service-name
        background-color cornflowerblue

      .service-handler-name
        background-color #68b6ef

      .duration
        text-align right

        &.slow
          color red

      .v-timeline--vertical.v-timeline
        height auto

  .no-consumers
    display flex
    height 100%
    width 100%
    justify-content center
    align-items center
    font-size 1.5em
</style>
