<script setup>
import * as d3 from 'd3'
import { onMounted, ref, watch, onBeforeUnmount, computed } from 'vue'
import { useJetStreamStore } from '../stores/JetStream'
import { millis } from 'nats.ws'
import moment from 'moment'
import pluralize from 'pluralize'
import hotkeys from 'hotkeys-js'
import { debounce } from 'debounce'
import groupToMap from 'core-js/actual/array/group-to-map'

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
  ],
  customRanges = ref([]),
  dateFormat = 'HH:mm:ss.SSS',
  rangeUi = () =>
    customRanges.value.length
      ? `${moment(customRanges.value[0][0]).format(dateFormat)} - ${moment(customRanges.value[0][1]).format(
          dateFormat
        )}`
      : store.timeRange,
  watchers = [],
  selectedStream = ref(undefined),
  openDialog = ref(false)

let refreshInterval

onMounted(async () => {
  watch(() => store.streams, outputData)
  outputData()

  hotkeys('esc', () => {
    customRanges.value.shift()
    customRanges.value = [...customRanges.value]
  })
})

onBeforeUnmount(cleanup)

function cleanup() {
  clearInterval(refreshInterval)
  watchers.forEach(unwatch => unwatch())
}

function outputData() {
  cleanup()

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

    const left = xScale.invert(mousedownValue - leftMargin).getTime(),
      right = xScale.invert(e.offsetX - leftMargin).getTime(),
      domain = [Math.min(left, right), Math.max(left, right)]

    customRanges.value = [domain, ...customRanges.value]
  })

  svg.on('mousemove', e => {
    const tooltipParts = [xScale.invert(e.offsetX - leftMargin)]

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

      const elementsInRange = data.value.reduce((acc, x) => {
        const messageMoment = moment(millis(x.timestampNanos))

        if (messageMoment.isBetween(start, end)) {
          acc.push(x)
        }

        return acc
      }, [])

      tooltipText = `${start.format(dateFormat)} - ${end.format(dateFormat)} (${
        duration.asSeconds() > 3 ? duration.humanize() : duration.asMilliseconds() + ' ms'
      })`

      if (elementsInRange.length > 0) {
        tooltipText += `<br/>${elementsInRange.length} ${pluralize('message', elementsInRange.length)} in range<hr/>`

        groupToMap(elementsInRange, x => x.stream).forEach((value, key) => {
          tooltipText += `${key}: ${value.length} ${pluralize('message', value.length)}<br/>`
        })
      }
    }

    tooltip
      .style('top', `${e.offsetY + 18}px`)
      .style('left', `${e.offsetX + 28}px`)
      .style('opacity', e.offsetX > leftMargin ? '1' : '0')
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

  g.selectAll('.axis--y .tick').on('click', (_, streamName) => {
    const stream = streams.find(x => x.config.name === streamName)
    selectedStream.value = stream
    openDialog.value = true
  })

  const prepareDataEntry = x => ({
      stream: x.stream.config.name,
      subject: x.message.subject,
      data: x.message.data,
      id: x.message.reply,
      timestampNanos: x.message.info.timestampNanos,
      message: x.message
    }),
    data = computed(() => messages.map(prepareDataEntry)),
    messageRadius = 5

  renderData()
  manageLiveEvents()

  watchers.push(
    watch(
      () => store.timeRange,
      () => {
        if (customRanges.value.length) {
          customRanges.value = []
        }

        manageLiveEvents()
      }
    )
  )

  watchers.push(
    watch(customRanges, () => {
      manageLiveEvents()
      displayCustomRange()
    })
  )

  watchers.push(watch(data, debounce(renderData, 100)))

  function renderData() {
    g.selectAll('.message')
      .data(data.value, d => d.id)
      .join(enter =>
        enter
          .append('circle')
          .attr('class', 'message')
          .attr('cx', d => xScale(millis(d.timestampNanos)))
          .attr('cy', d => (yScale(d.stream) || 0) + 15)
          .attr('r', messageRadius)
          .attr('fill', d => accent(d.stream))
          .attr('opacity', 1)
          .on('click', function (_, d) {
            g.selectAll('.message.selected').classed('selected', false)
            d3.select(this).classed('selected', true)
            store.selectedMessage = d.message
          })
          .append('title')
          .text(d => `${d.subject} at ${moment(millis(d.timestampNanos)).format('HH:mm:ss.SSS')}`)
      )
  }

  function manageLiveEvents() {
    if (store.timeRange === 'Live' && !customRanges.value.length) {
      captureLiveEvents()
    } else {
      stopLiveEvents()
    }
  }

  function captureLiveEvents() {
    stopLiveEvents()

    refreshInterval = setInterval(() => {
      xScale.domain(timeRange())
      d3.select('.axis--x').transition().call(d3.axisBottom(xScale))

      g.selectAll('.message.out').remove()

      g.selectAll('.message').each(function (d) {
        const x = xScale(millis(d.timestampNanos)),
          goingOut = x <= 5

        d3.select(this)
          .transition()
          .attr('cx', x)
          .attr('opacity', goingOut ? 0 : 1)

        d3.select(this).classed('out', goingOut)
      })
    }, 1000)
  }

  function stopLiveEvents() {
    clearInterval(refreshInterval)
  }

  function displayCustomRange() {
    const domain = customRanges.value.length ? customRanges.value[0] : timeRange()

    xScale.domain(domain)
    d3.select('.axis--x').transition().call(d3.axisBottom(xScale))

    g.selectAll('.message').call(d => d.transition().attr('cx', d => xScale(millis(d.timestampNanos))))
  }
}
</script>

<template>
  <v-select :items="timeRanges" outlines density="compact" variant="underlined" v-model="store.timeRange">
    <template v-slot:selection="data"> {{ rangeUi() }} </template>
  </v-select>
  <div ref="svgContainer" />
  <v-progress-linear color="yellow-darken-2" indeterminate :active="store.loading" />
  <v-dialog v-model="openDialog" max-width="40em">
    <v-card>
      <v-toolbar color="primary" dense>
        <v-toolbar-title><v-icon>mdi-tray-full</v-icon> {{ selectedStream?.config.name }} </v-toolbar-title>
      </v-toolbar>
      <v-card-text>
        <v-row v-if="selectedStream?.config.description">
          <v-col>Description</v-col>
          <v-col>{{ selectedStream?.config.description }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-filter</v-icon> Subjects</v-col>
          <v-col>{{ selectedStream?.config.subjects.join(', ') }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-database</v-icon>Retention policy</v-col>
          <v-col
            >{{ selectedStream?.config.retention }}
            <ul class="limits">
              <li v-if="selectedStream?.config.max_age > 0">
                {{ moment.duration(millis(selectedStream?.config.max_age)).humanize() }} lifetime
              </li>
              <li v-if="selectedStream?.config.max_bytes > 0">
                {{ selectedStream?.config.max_bytes }} bytes ({{
                  (selectedStream?.config.max_bytes / 1024 / 1024).toLocaleString('da-DK', {
                    style: 'unit',
                    unit: 'megabyte',
                    unitDisplay: 'long'
                  })
                }})
              </li>
              <li v-if="selectedStream?.config.max_msgs > 0">
                {{ selectedStream?.config.max_msgs.toLocaleString('da-DK') }} messages
              </li>
            </ul>
          </v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-email-multiple</v-icon> Messages</v-col>
          <v-col>{{ selectedStream?.state.messages.toLocaleString('da-DK') }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-content-save</v-icon> Size</v-col>
          <v-col>
            {{
              (selectedStream?.state.bytes / 1024 / 1024).toLocaleString('da-DK', {
                style: 'unit',
                unit: 'megabyte',
                unitDisplay: 'long'
              })
            }}</v-col
          >
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-human-queue</v-icon> Consumers</v-col>
          <v-col>{{ selectedStream?.state.consumer_count.toLocaleString('da-DK') }}</v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-calendar-clock</v-icon> First message</v-col>
          <v-col>
            <div v-if="selectedStream?.state.first_ts != '0001-01-01T00:00:00Z'">
              {{ moment(selectedStream?.state.first_ts).format('DD MMM YYYY  HH:mm:ss.SSS') }} ({{
                moment.duration(moment().diff(moment(selectedStream?.state.first_ts))).humanize()
              }}
              ago)
            </div>
            <div v-else>never</div>
          </v-col>
        </v-row>
        <v-row>
          <v-col><v-icon>mdi-calendar-clock</v-icon> Last message</v-col>
          <v-col>
            <div v-if="selectedStream?.state.last_ts != '0001-01-01T00:00:00Z'">
              {{ moment(selectedStream?.state.last_ts).format('DD MMM YYYY  HH:mm:ss.SSS') }} ({{
                moment.duration(moment().diff(moment(selectedStream?.state.last_ts))).humanize()
              }}
              ago)
            </div>
            <div v-else>never</div>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn text @click="openDialog = undefined">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="stylus" scoped>
.v-select
  position absolute
  right 1em
  top 1em
  width 15em

.v-progress-linear
  position absolute
  bottom 0
  left 0
  width 100%
  z-index 100

.v-col:first-child
  flex 0 0 12em

ul.limits
  margin-left 1em
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
  stroke white
  stroke-width 1px
  margin-top 0.5em
  cursor pointer

  &.selected
    fill red
    stroke-width 2px

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
