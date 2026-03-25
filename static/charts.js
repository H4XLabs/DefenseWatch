const charts = {};

// Semantic colors — used consistently across all charts and summary labels
const SSH_COLOR   = '#f97316'; // orange   — SSH auth events
const HTTP_COLOR  = '#38bdf8'; // sky blue — HTTP attacks
const BRUTE_COLOR = '#ef4444'; // red      — brute force sessions
const SCAN_COLOR  = '#a78bfa'; // violet   — port scans

// Categorical palette for country/username/endpoint/ASN/attack-type charts
// Muted tones (500-600 level) for comfortable contrast on dark backgrounds
const SUBTLE_COLORS = [
    '#0ea5e9', // sky-500
    '#10b981', // emerald-500
    '#ea580c', // orange-600
    '#8b5cf6', // violet-500
    '#e11d48', // rose-600
    '#d97706', // amber-600
    '#0891b2', // cyan-600
    '#16a34a', // green-600
    '#c026d3', // fuchsia-600
    '#3b82f6', // blue-500
    '#db2777', // pink-600
    '#65a30d', // lime-600
    '#0d9488', // teal-500
    '#9333ea', // purple-600
    '#ca8a04', // yellow-600
];

const LABEL_COLOR = 'rgba(148, 163, 184, 0.85)';
const GRID_COLOR  = 'rgba(255, 255, 255, 0.04)';
const SPLIT_LINE  = { lineStyle: { color: GRID_COLOR } };
const AXIS_LABEL  = { color: LABEL_COLOR, fontSize: 11, fontFamily: 'Inter' };

const TOOLTIP_BASE = {
    backgroundColor: 'rgba(10, 15, 26, 0.96)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: '#e2e8f0', fontSize: 12, fontFamily: 'Inter' },
    extraCssText: 'box-shadow:0 4px 20px rgba(0,0,0,0.5);border-radius:6px;backdrop-filter:blur(12px)',
};

function getOrCreate(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return null;
    if (charts[containerId]) return charts[containerId];

    const chart = echarts.init(el, 'dark');
    chart.getZr().dom.style.background = 'transparent';
    charts[containerId] = chart;

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return chart;
}

function createLineChart(containerId, label, color) {
    const chart = getOrCreate(containerId);
    if (!chart) return null;

    chart.setOption({
        backgroundColor: 'transparent',
        grid: { left: 48, right: 16, top: 24, bottom: 32 },
        tooltip: {
            ...TOOLTIP_BASE,
            trigger: 'axis',
            axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,255,255,0.15)', width: 1, type: 'dashed' } },
            formatter: (params) => {
                const p = params[0];
                if (!p) return '';
                return `<div style="font-weight:600;margin-bottom:4px;color:#f1f5f9">${p.axisValue}</div>` +
                       `<div style="display:flex;align-items:center;gap:6px">${p.marker}<span>${p.seriesName}</span><b style="margin-left:auto;padding-left:12px">${p.value ?? 0}</b></div>`;
            },
        },
        xAxis: {
            type: 'category',
            data: [],
            axisLabel: { ...AXIS_LABEL, margin: 8 },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            boundaryGap: false,
        },
        yAxis: {
            type: 'value',
            axisLabel: { ...AXIS_LABEL, margin: 8 },
            splitLine: SPLIT_LINE,
            minInterval: 1,
            min: 0,
        },
        series: [{
            name: label,
            type: 'line',
            smooth: 0.4,
            symbol: 'circle',
            symbolSize: 4,
            showSymbol: false,
            lineStyle: { color, width: 2.5 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: color + '40' },
                    { offset: 1, color: color + '05' },
                ]),
            },
            itemStyle: { color, borderWidth: 2, borderColor: '#0a0f1a' },
            emphasis: { scale: true },
            data: [],
        }],
    });

    return chart;
}

function createBarChart(containerId, horizontal = false) {
    const chart = getOrCreate(containerId);
    if (!chart) return null;

    const catAxis = {
        type: 'category',
        data: [],
        axisLabel: { ...AXIS_LABEL, fontSize: 11, width: horizontal ? 108 : undefined, overflow: 'truncate' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
    };
    const valAxis = {
        type: 'value',
        axisLabel: { ...AXIS_LABEL, fontSize: 10 },
        splitLine: SPLIT_LINE,
        minInterval: 1,
        min: 0,
    };

    chart.setOption({
        backgroundColor: 'transparent',
        grid: {
            left: horizontal ? 118 : 48,
            right: horizontal ? 48 : 16,
            top: 12,
            bottom: horizontal ? 16 : 32,
        },
        tooltip: {
            ...TOOLTIP_BASE,
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
        },
        xAxis: horizontal ? valAxis : catAxis,
        yAxis: horizontal ? { ...catAxis, inverse: true } : valAxis,
        series: [{
            name: 'Count',
            type: 'bar',
            barMaxWidth: 26,
            itemStyle: {
                borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
                color: (params) => SUBTLE_COLORS[params.dataIndex % SUBTLE_COLORS.length],
                opacity: 0.8,
            },
            emphasis: {
                itemStyle: { opacity: 1 },
            },
            label: {
                show: true,
                position: horizontal ? 'right' : 'top',
                color: LABEL_COLOR,
                fontSize: 10,
                formatter: '{c}',
            },
            data: [],
        }],
    });

    return chart;
}

function createDoughnutChart(containerId) {
    const chart = getOrCreate(containerId);
    if (!chart) return null;

    chart.setOption({
        backgroundColor: 'transparent',
        tooltip: {
            ...TOOLTIP_BASE,
            trigger: 'item',
            formatter: (params) =>
                `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>` +
                `<div>${params.marker} Count: <b>${params.value}</b> &nbsp; <span style="opacity:0.7">${params.percent.toFixed(1)}%</span></div>`,
        },
        legend: {
            type: 'scroll',
            orient: 'horizontal',
            bottom: 2,
            left: 'center',
            textStyle: { color: '#94a3b8', fontSize: 10 },
            icon: 'circle',
            itemWidth: 7,
            itemHeight: 7,
            itemGap: 10,
            pageIconColor: '#10b981',
            pageIconInactiveColor: 'rgba(156, 163, 175, 0.35)',
            pageTextStyle: { color: '#9ca3af', fontSize: 10 },
        },
        color: SUBTLE_COLORS,
        series: [{
            type: 'pie',
            radius: ['44%', '68%'],
            center: ['50%', '46%'],
            avoidLabelOverlap: true,
            minShowLabelAngle: 20,
            label: {
                show: true,
                position: 'outside',
                formatter: (params) => `{pct|${params.percent.toFixed(0)}%}`,
                rich: {
                    pct: { fontSize: 11, fontWeight: '600', color: '#f1f5f9' },
                },
                distanceToLabelLine: 4,
            },
            labelLine: {
                show: true,
                length: 8,
                length2: 6,
                smooth: true,
                lineStyle: { color: 'rgba(156, 163, 175, 0.45)', width: 1 },
            },
            emphasis: {
                label: { show: true, fontSize: 13, fontWeight: 'bold' },
                itemStyle: {
                    shadowBlur: 20,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.6)',
                },
                scale: true,
                scaleSize: 5,
            },
            itemStyle: {
                borderColor: 'rgba(10, 15, 26, 1)',
                borderWidth: 2,
                opacity: 0.85,
            },
            data: [],
        }],
    });

    return chart;
}

function hourLabel(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function initCharts() {
    createLineChart('chart-ssh-timeline',  'SSH Attempts', SSH_COLOR);
    createLineChart('chart-http-timeline', 'HTTP Attacks', HTTP_COLOR);
    createBarChart('chart-countries',  true);
    createDoughnutChart('chart-attack-types');
    createBarChart('chart-usernames',  true);
    createBarChart('chart-endpoints',  true);
    createBarChart('chart-asns',       true);
}

export function updateSSHTimeline(data) {
    const chart = charts['chart-ssh-timeline'];
    if (!chart || !data.timeseries) return;
    chart.setOption({
        xAxis:  { data: data.timeseries.map(d => hourLabel(d.hour)) },
        series: [{ data: data.timeseries.map(d => d.count) }],
    });
}

export function updateHTTPTimeline(data) {
    const chart = charts['chart-http-timeline'];
    if (!chart || !data.timeseries) return;
    chart.setOption({
        xAxis:  { data: data.timeseries.map(d => hourLabel(d.hour)) },
        series: [{ data: data.timeseries.map(d => d.count) }],
    });
}

export function updateCountries(data) {
    const chart = charts['chart-countries'];
    if (!chart || !data.countries) return;
    const top = data.countries.slice(0, 12);
    chart.setOption({
        yAxis:  { data: top.map(d => d.name || d.code) },
        series: [{ data: top.map(d => d.count) }],
    });
}

export function updateAttackTypes(data) {
    const chart = charts['chart-attack-types'];
    if (!chart || !data.attack_types) return;
    chart.setOption({
        series: [{ data: data.attack_types.map(d => ({ name: d.type, value: d.count })) }],
    });
}

export function updateUsernames(data) {
    const chart = charts['chart-usernames'];
    if (!chart || !data.top_usernames) return;
    const top = data.top_usernames.slice(0, 12);
    chart.setOption({
        yAxis:  { data: top.map(d => d.username) },
        series: [{ data: top.map(d => d.count) }],
    });
}

export function updateEndpoints(data) {
    const chart = charts['chart-endpoints'];
    if (!chart || !data.top_paths) return;
    const top = data.top_paths.slice(0, 12);
    chart.setOption({
        yAxis:  { data: top.map(d => d.path.length > 32 ? d.path.substring(0, 32) + '…' : d.path) },
        series: [{ data: top.map(d => d.count) }],
    });
}

export function updateASNs(data) {
    const chart = charts['chart-asns'];
    if (!chart || !data.top_ips) return;
    const orgMap = {};
    for (const ip of data.top_ips) {
        const org = ip.org || 'Unknown';
        orgMap[org] = (orgMap[org] || 0) + ip.count;
    }
    const sorted = Object.entries(orgMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    chart.setOption({
        yAxis:  { data: sorted.map(d => d[0].length > 28 ? d[0].substring(0, 28) + '…' : d[0]) },
        series: [{ data: sorted.map(d => d[1]) }],
    });
}
