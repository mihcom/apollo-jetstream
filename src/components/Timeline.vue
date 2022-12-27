<script setup>
import * as d3 from 'd3'
import { onMounted, ref } from 'vue'

const windowWidth = ref(window.innerWidth)

onMounted(() => {
  const svg = d3.select('svg.timeline'),
    width = svg.attr('width'),
    height = svg.attr('height') - 30,
    xScale = d3.scaleTime().range([0, width]),
    yScale = d3.scaleLinear().range([height, 0]),
    g = svg.append('g').attr('transform', 'translate(' + 30 + ',' + 10 + ')')

  xScale.domain(lastFiveMinutes())
  yScale.domain([0, 20])

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
  <svg :width="windowWidth" class="timeline" height="350"></svg>
</template>

<style scoped></style>
