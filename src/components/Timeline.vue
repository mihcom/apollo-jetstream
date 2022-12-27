<script setup>
import * as d3 from 'd3'
import { onMounted, ref } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'

const store = useJetStreamStore(),
  windowWidth = ref(window.innerWidth),
  windowHeight = ref(window.innerHeight)

onMounted(async () => {
  await store.fetchStreams()

  const streams = store.streams,
    svg = d3.select('svg.timeline'),
    width = svg.attr('width'),
    height = svg.attr('height') - 30,
    xScale = d3.scaleTime().domain(lastFiveMinutes()).range([0, width]),
    yScale = d3
      .scaleBand()
      .domain(streams.map(x => x.config.name))
      .range([0, height]),
    g = svg.append('g').attr('transform', 'translate(' + 130 + ',' + 10 + ')')

  g.append('g')
    .attr('class', 'axis axis--x')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(xScale))

  g.append('g').attr('class', 'axis axis--y').call(d3.axisLeft(yScale))

  setInterval(() => {
    xScale.domain(lastFiveMinutes())
    d3.select('.axis--x').transition().call(d3.axisBottom(xScale))
  }, 1000)

  function lastFiveMinutes() {
    const now = Date.now()
    return [now - 5 * 60 * 1000, now]
  }
})
</script>

<template>
  <svg :height="windowHeight / 2" :width="windowWidth" class="timeline"></svg>
</template>

<style>
.axis {
  font: 10px sans-serif;
}
</style>
