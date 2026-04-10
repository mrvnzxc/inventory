<script setup lang="ts">
import type { DashboardStats } from '~/stores/salesStore'

const props = defineProps<{
  isOwner: boolean
  weeklySeries: { day: string; revenue: number }[]
  topProducts: { name: string; revenue: number }[]
  byBranch: DashboardStats['byBranch']
  formatMoney: (n: number) => string
}>()

const palette = ['#EAB308', '#EC4899', '#38BDF8', '#A78BFA', '#34D399', '#FB923C', '#F43F5E', '#22D3EE']

const chartFont = 'system-ui, Segoe UI, sans-serif'

/** Narrow viewport: smaller chart heights + Apex responsive overrides */
const isNarrow = ref(false)
let mq: MediaQueryList | null = null
function syncNarrow() {
  if (!import.meta.client || !mq) return
  isNarrow.value = mq.matches
}
onMounted(() => {
  if (!import.meta.client) return
  mq = window.matchMedia('(max-width: 639px)')
  syncNarrow()
  mq.addEventListener('change', syncNarrow)
})
onUnmounted(() => {
  mq?.removeEventListener('change', syncNarrow)
})

const hArea = computed(() => (isNarrow.value ? 240 : 300))
const hBar = computed(() => (isNarrow.value ? 260 : 300))
const hDonut = computed(() => (isNarrow.value ? 280 : 320))

const chartBase = {
  width: '100%' as const,
  redrawOnParentResize: true,
  redrawOnWindowResize: true,
  parentHeightOffset: 0,
}

const revenueSeries = computed(() => [
  {
    name: 'Revenue',
    data: props.weeklySeries.map((s) => Math.round(s.revenue * 100) / 100),
  },
])

const revenueCategories = computed(() => props.weeklySeries.map((s) => s.day))

const areaOptions = computed(() => ({
  chart: {
    ...chartBase,
    type: 'area',
    fontFamily: chartFont,
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true },
    offsetX: isNarrow.value ? -4 : 0,
    offsetY: isNarrow.value ? -4 : 0,
  },
  colors: ['#CA8A04'],
  fill: {
    type: 'gradient',
    gradient: {
      shade: 'light',
      type: 'vertical',
      shadeIntensity: 0.35,
      opacityFrom: 0.65,
      opacityTo: 0.05,
      stops: [0, 100],
    },
  },
  stroke: { curve: 'smooth', width: isNarrow.value ? 2 : 3, colors: ['#CA8A04'] },
  dataLabels: { enabled: false },
  xaxis: {
    categories: revenueCategories.value,
    labels: {
      style: { colors: '#57534E', fontWeight: 600, fontSize: isNarrow.value ? '9px' : '11px' },
      rotate: isNarrow.value ? -45 : 0,
      rotateAlways: isNarrow.value,
      hideOverlappingLabels: true,
      trim: true,
      maxHeight: isNarrow.value ? 70 : undefined,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      maxWidth: isNarrow.value ? 52 : undefined,
      style: { colors: '#57534E', fontWeight: 600, fontSize: isNarrow.value ? '9px' : '11px' },
      formatter: (val: number) => props.formatMoney(val),
    },
  },
  grid: {
    borderColor: '#E7E5E4',
    strokeDashArray: 4,
    padding: { left: isNarrow.value ? 4 : 8, right: isNarrow.value ? 8 : 12 },
  },
  tooltip: {
    theme: 'light',
    y: {
      formatter: (val: number) => props.formatMoney(val),
    },
  },
  markers: {
    size: isNarrow.value ? 3 : 4,
    colors: ['#FACC15'],
    strokeColors: '#A16207',
    strokeWidth: 2,
    hover: { size: 7 },
  },
}))

const branchSeries = computed(() => [
  {
    name: 'Revenue',
    data: props.byBranch.map((b) => Math.round(b.revenue * 100) / 100),
  },
])

const branchOptions = computed(() => ({
  chart: {
    ...chartBase,
    type: 'bar',
    fontFamily: chartFont,
    toolbar: { show: false },
    animations: { enabled: true },
    offsetX: isNarrow.value ? -6 : 0,
  },
  plotOptions: {
    bar: {
      borderRadius: 8,
      columnWidth: isNarrow.value ? '70%' : '55%',
      distributed: true,
    },
  },
  colors: props.byBranch.map((_, i) => palette[i % palette.length]),
  legend: { show: false },
  dataLabels: {
    enabled: !isNarrow.value,
    formatter: (val: number) => props.formatMoney(val),
    style: { fontSize: '10px', fontWeight: 700, colors: ['#1C1917'] },
    offsetY: -2,
  },
  xaxis: {
    categories: props.byBranch.map((b) => b.branch_name),
    labels: {
      style: { colors: '#44403C', fontWeight: 600, fontSize: isNarrow.value ? '10px' : '12px' },
      trim: true,
      maxHeight: isNarrow.value ? 48 : undefined,
    },
  },
  yaxis: {
    labels: {
      maxWidth: isNarrow.value ? 48 : undefined,
      style: { colors: '#57534E', fontWeight: 600, fontSize: isNarrow.value ? '9px' : '11px' },
      formatter: (val: number) => props.formatMoney(val),
    },
  },
  grid: {
    borderColor: '#E7E5E4',
    strokeDashArray: 4,
    padding: { left: isNarrow.value ? 2 : 8, right: isNarrow.value ? 4 : 12 },
  },
  tooltip: {
    y: { formatter: (val: number) => props.formatMoney(val) },
  },
}))

const donutSeries = computed(() => props.topProducts.map((p) => Math.round(p.revenue * 100) / 100))

const donutOptions = computed(() => ({
  chart: {
    ...chartBase,
    type: 'donut',
    fontFamily: chartFont,
    toolbar: { show: false },
    animations: { enabled: true },
  },
  labels: props.topProducts.map((p) => p.name),
  colors: props.topProducts.map((_, i) => palette[i % palette.length]),
  plotOptions: {
    pie: {
      donut: {
        size: isNarrow.value ? '72%' : '68%',
        labels: {
          show: true,
          name: { fontSize: isNarrow.value ? '11px' : '13px' },
          value: { fontSize: isNarrow.value ? '10px' : '12px' },
          total: {
            show: true,
            label: 'Total',
            fontSize: isNarrow.value ? '11px' : '13px',
            formatter: () =>
              props.formatMoney(props.topProducts.reduce((s, p) => s + p.revenue, 0)),
          },
        },
      },
    },
  },
  dataLabels: {
    enabled: !isNarrow.value,
    formatter: (_val: number, opts: { seriesIndex: number }) =>
      props.formatMoney(props.topProducts[opts.seriesIndex]?.revenue ?? 0),
  },
  legend: {
    position: 'bottom',
    fontWeight: 600,
    fontSize: isNarrow.value ? '10px' : '12px',
    labels: { colors: '#44403C' },
    itemMargin: { horizontal: 6, vertical: 2 },
  },
  tooltip: {
    y: {
      formatter: (val: number) => props.formatMoney(val),
    },
  },
}))

const branchDonutSeries = computed(() => props.byBranch.map((b) => Math.round(b.revenue * 100) / 100))

const branchDonutOptions = computed(() => ({
  chart: {
    ...chartBase,
    type: 'donut',
    fontFamily: chartFont,
    toolbar: { show: false },
  },
  labels: props.byBranch.map((b) => b.branch_name),
  colors: props.byBranch.map((_, i) => palette[i % palette.length]),
  plotOptions: {
    pie: {
      donut: {
        size: isNarrow.value ? '68%' : '62%',
        labels: {
          show: true,
          name: { fontSize: isNarrow.value ? '11px' : '13px' },
          total: {
            show: true,
            label: '7d revenue',
            fontSize: isNarrow.value ? '11px' : '13px',
            formatter: () =>
              props.formatMoney(props.byBranch.reduce((s, b) => s + b.revenue, 0)),
          },
        },
      },
    },
  },
  legend: {
    position: 'bottom',
    fontWeight: 600,
    fontSize: isNarrow.value ? '10px' : '12px',
    labels: { colors: '#44403C' },
    itemMargin: { horizontal: 6, vertical: 2 },
  },
  tooltip: {
    y: { formatter: (val: number) => props.formatMoney(val) },
  },
}))
</script>

<template>
  <div class="grid w-full min-w-0 max-w-full gap-4 sm:gap-6 lg:grid-cols-2">
    <div
      class="min-w-0 max-w-full overflow-hidden rounded-xl border border-brand-100 bg-gradient-to-br from-amber-50/80 to-white p-3 shadow-sm sm:p-4"
    >
      <h3 class="text-sm font-bold text-brand-950">7-day revenue trend</h3>
      <p class="mb-2 text-xs text-brand-600">Daily totals for your current view</p>
      <ClientOnly>
        <div class="w-full min-w-0 max-w-full">
          <ApexChart type="area" :height="hArea" width="100%" :options="areaOptions" :series="revenueSeries" />
        </div>
        <template #fallback>
          <div class="flex h-[240px] items-center justify-center text-sm text-brand-500 sm:h-[300px]">
            Loading chart…
          </div>
        </template>
      </ClientOnly>
    </div>

    <template v-if="isOwner">
      <div
        v-if="byBranch.length > 0"
        class="min-w-0 max-w-full overflow-hidden rounded-xl border border-brand-100 bg-gradient-to-br from-fuchsia-50/60 to-white p-3 shadow-sm sm:p-4"
      >
        <h3 class="text-sm font-bold text-brand-950">Revenue by branch</h3>
        <p class="mb-2 text-xs text-brand-600">Last 7 days — all branches</p>
        <ClientOnly>
          <div class="w-full min-w-0 max-w-full">
            <ApexChart type="bar" :height="hBar" width="100%" :options="branchOptions" :series="branchSeries" />
          </div>
          <template #fallback>
            <div class="flex h-[260px] items-center justify-center text-sm text-brand-500 sm:h-[300px]">
              Loading chart…
            </div>
          </template>
        </ClientOnly>
      </div>
      <div
        v-else
        class="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-brand-200 bg-white p-6 text-sm text-brand-600"
      >
        No branch sales yet — charts will appear once you record sales.
      </div>

      <div
        v-if="byBranch.length > 0"
        class="min-w-0 max-w-full overflow-hidden rounded-xl border border-brand-100 bg-gradient-to-br from-sky-50/70 to-white p-3 shadow-sm sm:p-4 lg:col-span-2"
      >
        <h3 class="text-sm font-bold text-brand-950">Branch mix</h3>
        <p class="mb-2 text-xs text-brand-600">Share of revenue across branches (7 days)</p>
        <ClientOnly>
          <div class="mx-auto w-full min-w-0 max-w-lg">
            <ApexChart
              type="donut"
              :height="hDonut"
              width="100%"
              :options="branchDonutOptions"
              :series="branchDonutSeries"
            />
          </div>
          <template #fallback>
            <div class="flex h-[280px] items-center justify-center text-sm text-brand-500 sm:h-[320px]">
              Loading chart…
            </div>
          </template>
        </ClientOnly>
      </div>
    </template>

    <template v-else>
      <div
        class="min-w-0 max-w-full overflow-hidden rounded-xl border border-brand-100 bg-gradient-to-br from-violet-50/70 to-white p-3 shadow-sm sm:p-4"
      >
        <h3 class="text-sm font-bold text-brand-950">Top products by revenue</h3>
        <p class="mb-2 text-xs text-brand-600">Your branch — recent sales mix</p>
        <ClientOnly>
          <div class="w-full min-w-0">
            <div v-if="topProducts.length > 0" class="mx-auto w-full min-w-0 max-w-md">
              <ApexChart type="donut" :height="hDonut" width="100%" :options="donutOptions" :series="donutSeries" />
            </div>
            <div v-else class="flex h-[240px] items-center justify-center text-sm text-brand-600 sm:h-[280px]">
              No product mix yet — sell something to see this chart.
            </div>
          </div>
          <template #fallback>
            <div class="flex h-[280px] items-center justify-center text-sm text-brand-500 sm:h-[320px]">
              Loading chart…
            </div>
          </template>
        </ClientOnly>
      </div>
    </template>
  </div>
</template>
