<script setup>
import { toRefs } from 'vue'
import { millis } from 'nats.ws'
import moment from 'moment/moment.js'

const props = defineProps({
    consumers: {
      type: Array,
      required: true
    }
  }),
  { consumers } = toRefs(props),
  headers = [
    { title: 'Name', key: 'name' },
    { title: 'Filter subject', key: 'config.filter_subject' },
    { title: 'Deliver group', key: 'config.deliver_group' },
    { title: 'Max ACK pending', key: 'config.max_ack_pending' },
    { title: 'ACK wait', key: 'config.ack_wait' },
    { title: 'Pending', key: 'num_pending' },
    { title: 'Redelivered', key: 'num_redelivered' }
  ]

function getMaxAckPendingColor(value) {
  return value > 1 ? 'green' : 'red'
}
</script>

<template>
  <v-data-table :headers="headers" :items="consumers" items-per-page="20">
    <template v-slot:item.config.max_ack_pending="{ value }">
      <v-chip :color="getMaxAckPendingColor(value)">{{
        value.toLocaleString('da-DK', {
          style: 'unit',
          unitDisplay: 'long'
        })
      }}</v-chip>
    </template>
    <template v-slot:item.config.ack_wait="{ value }"> {{ moment.duration(millis(value)).asSeconds() }} seconds </template>
  </v-data-table>
</template>

<style scoped lang="stylus"></style>
