<script setup>
import * as d3 from 'd3'
import { onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'
import { millis } from 'nats.ws'
import { eventBus, events } from '../infrastructure/eventBus.js'
import moment from 'moment'
import pluralize from 'pluralize'

const store = useJetStreamStore(),
  svgContainer = ref(null),
  windowWidth = ref(window.innerWidth),
  windowHeight = ref(window.innerHeight),
  timeRanges = [
    'Live',
    'Last 5 minutes',
    'Last 15 minutes',
    'Last 30 minutes',
    'Last 1 hour',
    'Last 2 hours',
    'Last 4 hours',
    'Last 8 hours',
    'Last 24 hours'
  ]

let refreshInterval

onMounted(async () => {
  watch(() => store.streams, outputData)
  outputData()
})

onBeforeUnmount(() => {
  eventBus.off(events.NewMessage)
  clearInterval(refreshInterval)
})

function outputData() {
  d3.select(svgContainer.value).selectAll('*').remove()

  const streams = store.streams,
    messages = store.messages,
    leftMargin = 120,
    rightMargin = 50,
    width = windowWidth.value - rightMargin,
    height = windowHeight.value / 2 - 30,
    svg = d3
      .select(svgContainer.value)
      .append('svg')
      .attr('class', 'timeline')
      .attr('width', windowWidth.value)
      .attr('height', windowHeight.value / 2),
    rangeSelector = d3
      .select('svg.timeline')
      .append('rect')
      .attr('class', 'range-selector')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 0)
      .attr('height', height),
    tooltip = d3.select(svgContainer.value).append('div').attr('class', 'tooltip').style('opacity', 0),
    timeRange = () => [Date.now() - store.duration, Date.now()],
    mouseDown = ref(undefined),
    customRange = ref([]),
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
      .range(d3.schemeTableau10),
    g = svg.append('g').attr('transform', 'translate(' + leftMargin + ',' + 10 + ')')

  svg.on('mousedown', e => {
    mouseDown.value = e.offsetX
    rangeSelector.attr('x', e.offsetX).attr('width', 0)
  })

  svg.on('mouseup', e => {
    const mousedownValue = mouseDown.value

    rangeSelector.attr('width', 0)
    mouseDown.value = undefined

    if (Math.abs(mousedownValue - e.offsetX) < 10) {
      return
    }

    customRange.value = [xScale.invert(mousedownValue - leftMargin), xScale.invert(e.offsetX - leftMargin)]

    xScale.domain([customRange.value[0].getTime(), customRange.value[1].getTime()])
    d3.select('.axis--x').transition().call(d3.axisBottom(xScale))

    g.selectAll('.message')
      .data(data, d => d.id)
      .call(d => d.transition().attr('x', d => xScale(millis(d.timestampNanos))))
  })

  svg.on('mousemove', e => {
    const tooltipParts = [xScale.invert(e.offsetX - leftMargin)],
      dateFormat = 'HH:mm:ss.SSS'

    if (mouseDown.value !== undefined) {
      tooltipParts.push(xScale.invert(mouseDown.value - leftMargin))
    }

    let tooltipText

    if (tooltipParts.length === 1) {
      tooltipText = moment(tooltipParts[0]).format(dateFormat)
    } else {
      const start = moment(Math.min(...tooltipParts)),
        end = moment(Math.max(...tooltipParts)),
        duration = moment.duration(end.diff(start))

      const elementsInRange = data.reduce((acc, x) => {
        const messageMoment = moment(millis(x.timestampNanos))

        if (messageMoment.isBetween(start, end)) {
          return acc + 1
        }

        return acc
      }, 0)

      tooltipText = `${start.format(dateFormat)} - ${end.format(dateFormat)} (${
        duration.asSeconds() > 3 ? duration.humanize() : duration.asMilliseconds() + ' ms'
      })`

      if (elementsInRange > 0) {
        tooltipText += `<br/>${elementsInRange} ${pluralize('message', elementsInRange)} in range`
      }
    }

    tooltip
      .style('top', `${e.offsetY + 18}px`)
      .style('left', `${e.offsetX + 28}px`)
      .html(tooltipText)

    if (e.buttons !== 1 || mouseDown.value === undefined) {
      // ignore if primary buttons is not pressed
      return
    }

    const width = e.offsetX - mouseDown.value

    // user can drag mouse left or right
    if (width > 0) {
      rangeSelector.attr('x', mouseDown.value).attr('width', width)
    } else {
      rangeSelector.attr('x', mouseDown.value + width).attr('width', Math.abs(width))
    }
  })

  svg.on('mouseenter', () => tooltip.style('opacity', 1))
  svg.on('mouseleave', () => tooltip.style('opacity', 0))

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

  const prepareDataEntry = x => ({
      stream: x.stream.config.name,
      subject: x.message.subject,
      data: x.message.data,
      id: x.message.reply,
      timestampNanos: x.message.info.timestampNanos,
      message: x.message
    }),
    data = messages.map(prepareDataEntry),
    messageBarWidth = 20,
    messageBarHeight = 10

  renderData()
  manageLiveEvents()
  watch(() => store.timeRange, manageLiveEvents)

  function renderData() {
    g.selectAll('.message')
      .data(data, d => d.id)
      .join(enter =>
        enter
          .append('rect')
          .attr('class', 'message')
          .attr('x', d => xScale(millis(d.timestampNanos)))
          .attr('y', d => yScale(d.stream) + messageBarHeight)
          .attr('fill', d => accent(d.stream))
          .attr('width', messageBarWidth)
          .attr('height', messageBarHeight)
          .on('click', (_, d) => (store.selectedMessage = d.message))
          .append('title')
          .text(d => `${d.subject} at ${moment(millis(d.timestampNanos)).format('HH:mm:ss.SSS')}`)
      )
  }

  function manageLiveEvents() {
    if (store.timeRange === 'Live') {
      captureLiveEvents()
    } else {
      stopLiveEvents()
    }
  }

  function captureLiveEvents() {
    stopLiveEvents()

    eventBus.on(events.NewMessage, x => {
      data.push(prepareDataEntry(x))
      renderData()
    })

    refreshInterval = setInterval(() => {
      xScale.domain(timeRange())
      d3.select('.axis--x').transition().call(d3.axisBottom(xScale))

      g.selectAll('.message')
        .transition()
        .attr('x', d => xScale(millis(d.timestampNanos)))
    }, 1000)
  }

  function stopLiveEvents() {
    clearInterval(refreshInterval)
    eventBus.off(events.NewMessage)
  }
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
  stroke-width 1px
  margin-top 0.5em
  cursor pointer

  &:hover
    fill #646cff

.range-selector
  fill #2B2E33

svg text
  -webkit-user-select none
  -moz-user-select none
  -ms-user-select none
  user-select none

svg text::selection
  background none

.tooltip
  position absolute
  background-color #22252B
  color #fff
  padding 5px
  border-radius 2px
  transition opacity 0.5s
  pointer-events none
  z-index 100
</style>
