<script setup>
import * as d3 from 'd3'
import { onMounted, ref, watch, computed } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'
import { millis } from 'nats.ws'

const store = useJetStreamStore(),
  svgContainer = ref(null),
  windowWidth = ref(window.innerWidth),
  windowHeight = ref(window.innerHeight),
  timeRanges = [
    'Last 5 minutes',
    'Last 15 minutes',
    'Last 30 minutes',
    'Last 1 hour',
    'Last 2 hours',
    'Last 4 hours',
    'Last 8 hours',
    'Last 24 hours'
  ]

onMounted(async () => {
  watch(() => store.streams, outputData)
})

function outputData() {
  d3.select(svgContainer.value).selectAll('*').remove()

  const streams = store.streams,
    messages = store.messages,
    width = windowWidth.value,
    height = windowHeight.value / 2 - 30,
    leftMargin = 120,
    svg = d3
      .select(svgContainer.value)
      .append('svg')
      .attr('class', 'timeline')
      .attr('width', windowWidth.value)
      .attr('height', windowHeight.value / 2),
    rangeSelector = d3
      .select('svg.timeline')
      .append('line')
      .attr('class', 'range-selector')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', height),
    timeRange = () => [Date.now() - store.duration, Date.now()],
    xScale = d3
      .scaleTime()
      .domain(timeRange())
      .range([0, width - leftMargin]),
    yScale = d3
      .scaleBand()
      .domain(streams.map(x => x.config.name))
      .range([0, height]),
    accent = d3
      .scaleOrdinal()
      .domain(streams.map(x => x.config.name))
      .range(d3.schemeSpectral[10]),
    g = svg.append('g').attr('transform', 'translate(' + leftMargin + ',' + 10 + ')')

  svg.on('mousemove', e => rangeSelector.attr('x1', e.offsetX).attr('x2', e.offsetX))

  // add the x Axis (time)
  g.append('g')
    .attr('class', 'axis axis--x')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(xScale))

  // add the y Axis (streams)
  g.append('g')
    .attr('class', 'axis axis--y')
    .call(d3.axisLeft(yScale))
    .selectAll('text')
    .style('fill', d => accent(d))

  const data = messages.map(x => ({
      stream: x.stream.config.name,
      subject: x.message.subject,
      data: x.message.data,
      id: `${x.message.subject}/${x.message.sid}`,
      timestamp: x.message.info.timestampNanos
    })),
    messageBarWidth = 20,
    messageBarHeight = 10

  console.log(data)

  g.selectAll('.message')
    .data(data, d => d.id)
    .join(enter =>
      enter
        .append('rect')
        .attr('class', 'message')
        .attr('x', d => xScale(millis(d.timestamp)))
        .attr('y', d => yScale(d.stream) + messageBarHeight)
        .attr('fill', d => accent(d.stream))
        .attr('width', messageBarWidth)
        .attr('height', messageBarHeight)
        .append('title')
        .text(d => d.subject)
    )

  // move the timeline each second
  setInterval(() => {
    xScale.domain(timeRange())
    d3.select('.axis--x').transition().call(d3.axisBottom(xScale))

    g.selectAll('.message')
      .transition()
      .attr('x', d => xScale(millis(d.timestamp)))
  }, 1000)
}
</script>

<template>
  <v-select :items="timeRanges" outlines density="compact" variant="underlined" v-model="store.timeRange" />
  <div ref="svgContainer" />
  <v-progress-linear color="yellow-darken-2" indeterminate :active="store.loading" />
</template>

<style lang="stylus" scoped>
.v-select
  position absolute
  right 1em
  top 1em
  width 10em

.v-progress-linear
  position absolute
  bottom 0
  left 0
  width 100%
  z-index 100
</style>

<style lang="stylus">
.axis
  font 10px sans-serif

  &.axis--y
    cursor pointer

    .tick
      transition all 0.2s ease-in-out

      &:hover
        color yellowgreen

.message
  stroke #747bff
  margin-top 0.5em
  cursor pointer

  &:hover
    fill #646cff

.range-selector
  stroke yellowgreen
  stroke-width 0.5
  stroke-dasharray 2, 1

svg text
  -webkit-user-select none
  -moz-user-select none
  -ms-user-select none
  user-select none

svg text::selection
  background none
</style>
