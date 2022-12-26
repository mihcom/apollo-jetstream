<template>
  <svg height="350" width="1100"></svg>
</template>

<script>
import * as d3 from 'd3'

export default {
  name: 'Timeline',
  mounted() {
    const data = [
      {
        year: 2010,
        value: 10
      },
      {
        year: 2011,
        value: 14
      },
      {
        year: 2017,
        value: 18
      }
    ]

    const svg = d3.select('svg'),
      width = svg.attr('width'),
      height = svg.attr('height') - 30,
      xScale = d3.scaleBand().range([0, width]).padding(0.4),
      yScale = d3.scaleLinear().range([height, 0]),
      g = svg.append('g').attr('transform', 'translate(' + 30 + ',' + 10 + ')')

    xScale.domain(data.map((d) => d.year))
    yScale.domain([0, d3.max(data, (d) => d.value)])

    g.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(xScale))

    g.append('g').call(
      d3.axisLeft(yScale).tickFormat(function (d) {
        return '$' + d
      })
    )

    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', function (d) {
        return xScale(d.year)
      })
      .attr('y', function (d) {
        return yScale(d.value)
      })
      .attr('width', xScale.bandwidth())
      .attr('height', function (d) {
        return height - yScale(d.value)
      })
  }
}
</script>

<style>
.bar {
  fill: steelblue;
}
</style>
