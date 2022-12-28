<script setup>
import * as d3 from 'd3'
import { onMounted, ref } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'
import { millis } from 'nats.ws'

const store = useJetStreamStore(),
  windowWidth = ref(window.innerWidth),
  windowHeight = ref(window.innerHeight)

onMounted(async () => {
  await store.fetchStreams()

  const streams = store.streams,
    svg = d3.select('svg.timeline'),
    leftMargin = 120,
    width = svg.attr('width'),
    height = svg.attr('height') - 30,
    xScale = d3
      .scaleTime()
      .domain(lastXMinites())
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

  const timeBarrier = lastXMinites()[0],
    data = streams
      .flatMap(stream =>
        stream.messages.map(message => ({
          stream: stream.config.name,
          subject: message.subject,
          data: message.data,
          id: `${message.subject}/${message.sid}`,
          timestamp: message.info.timestampNanos
        }))
      )
      .filter(message => message.timestamp > timeBarrier),
    messageBarWidth = 20,
    messageBarHeight = 10

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
    xScale.domain(lastXMinites())
    d3.select('.axis--x').transition().call(d3.axisBottom(xScale))

    g.selectAll('.message')
      .transition()
      .attr('x', d => xScale(millis(d.timestamp)))
  }, 1000)

  function lastXMinites() {
    const now = Date.now()
    return [now - 30 * 60 * 1000, now]
  }
})
</script>

<template>
  <svg :height="windowHeight / 2" :width="windowWidth" class="timeline"></svg>
</template>

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
</style>
