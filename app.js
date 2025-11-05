let chart;
let mapChart;

// --- Ambil elemen canvas utama ---
const ctx = document.getElementById('pbiChart')?.getContext('2d');
if (!ctx) {
    console.error("❌ Elemen canvas dengan id='pbiChart' tidak ditemukan!");
}

// --- Fungsi ambil data JSON ---
async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error(`Gagal memuat data: ${response.statusText}`);
        return await response.json();
    } catch (err) {
        console.error("❌ Error saat fetch data.json:", err);
        return [];
    }
}

// --- Fungsi render chart (Bar, Line, Pie, Scatter, Histogram) ---
function renderChart(data, type, labelTitle) {
    const chartCanvas = document.getElementById('pbiChart');
    const mapCanvas = document.getElementById('mapChart');
    if (!chartCanvas) return;

    chartCanvas.style.display = 'block';
    mapCanvas.style.display = 'none';

    if (chart) chart.destroy();

    if (!data || data.length === 0) {
        console.warn("⚠️ Tidak ada data yang cocok dengan filter.");
        document.getElementById('highestValue').textContent = '-';
        document.getElementById('highestRegion').textContent = '-';
        document.getElementById('lowestValue').textContent = '-';
        document.getElementById('lowestRegion').textContent = '-';
        return;
    }

    const labels = data.map(item => item.kabupaten_kota);
    const values = data.map(item => parseFloat(item.persentase));

    let datasetConfig = {};

    if (type === 'scatter') {
        datasetConfig = {
            datasets: [{
                label: labelTitle,
                data: data.map((item, i) => ({ x: i, y: item.persentase })),
                backgroundColor: 'rgba(255,99,132,0.6)'
            }]
        };
    } else if (type === 'pie') {
        datasetConfig = {
            labels: labels,
            datasets: [{
                label: 'Persentase',
                data: values,
                backgroundColor: labels.map(() => `hsl(${Math.random() * 360}, 70%, 70%)`)
            }]
        };
    } else {
        datasetConfig = {
            labels: labels,
            datasets: [{
                label: labelTitle,
                data: values,
                borderColor: 'blue',
                backgroundColor: 'rgba(255,99,132,0.4)',
                fill: type !== 'line'
            }]
        };
    }

    chart = new Chart(ctx, {
        type: type === 'histogram' ? 'bar' : type,
        data: datasetConfig,
        options: {
            responsive: true,
            plugins: {
                legend: { display: true }
            },
            scales: (type === 'pie' || type === 'scatter') ? {} : {
                y: { beginAtZero: true, title: { display: true, text: 'Persentase (%)' } },
                x: { title: { display: true, text: 'Kabupaten / Kota' } }
            }
        }
    });

    updateStats(data);
}

// --- Fungsi render peta interaktif ---
async function renderMap(data) {
    const chartCanvas = document.getElementById('pbiChart');
    const mapCanvas = document.getElementById('mapChart');

    chartCanvas.style.display = 'none';
    mapCanvas.style.display = 'block';

    const ctxMap = mapCanvas.getContext('2d');
    if (!ctxMap) return;

    if (mapChart) mapChart.destroy();

    const geoRes = await fetch('jawa_barat.geojson');
    const geoData = await geoRes.json();

    const mapData = {};
    data.forEach(item => {
        mapData[item.kabupaten_kota.toUpperCase()] = item.persentase;
    });

    // Warna acak cerah untuk tiap kabupaten
    const randomColors = {};
    const getColor = (name) => {
        if (!randomColors[name]) {
            const hue = Math.floor(Math.random() * 360);
            randomColors[name] = `hsl(${hue}, 70%, 60%)`; // warna cerah dinamis
        }
        return randomColors[name];
    };


    const chartData = {
        labels: geoData.features.map(f => f.properties.VARNAME_2.toUpperCase()),
        datasets: [{
            label: 'Persentase',
            outline: geoData,
            showOutline: true,
            backgroundColor: ctx => {
                const name = ctx.chart.data.labels[ctx.dataIndex];
                return getColor(name);
            },

            data: geoData.features.map(f => ({
                feature: f,
                value: mapData[f.properties.VARNAME_2.toUpperCase()] || 0
            }))
        }]
    };

    mapChart = new Chart(ctxMap, {
        type: 'choropleth',
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const name = ctx.chart.data.labels[ctx.dataIndex];
                            const val = mapData[name] || 0;
                            return `${name}: ${val}%`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Peta Sebaran Persentase PBI di Jawa Barat',
                    font: { size: 16 }
                }
            },
            scales: {
                projection: {
                    axis: 'x',
                    projection: 'mercator'
                }
            }
        }
    });

    updateStats(data);
}

// --- Fungsi tampilkan statistik tertinggi & terendah ---
function updateStats(data) {
    if (!data || data.length === 0) return;

    const maxData = data.reduce((a, b) => a.persentase > b.persentase ? a : b);
    const minData = data.reduce((a, b) => a.persentase < b.persentase ? a : b);

    document.getElementById('highestValue').textContent = `${maxData.persentase}%`;
    document.getElementById('highestRegion').textContent = maxData.kabupaten_kota;
    document.getElementById('lowestValue').textContent = `${minData.persentase}%`;
    document.getElementById('lowestRegion').textContent = minData.kabupaten_kota;
}

// --- Fungsi utama update chart/peta ---
async function updateChart() {
    const data = await loadData();

    const tahunEl = document.getElementById('tahun');
    const jenisEl = document.getElementById('jenisPBI');
    const typeEl = document.getElementById('chartType');

    if (!tahunEl || !jenisEl || !typeEl) {
        console.error("❌ Elemen filter (tahun, jenisPBI, chartType) tidak ditemukan!");
        return;
    }

    const tahun = tahunEl.value;
    const jenis = jenisEl.value;
    const chartType = typeEl.value;

    function mapJenisPBI(val) {
        switch (val) {
            case "PPU": return "PEKERJA PENERIMA UPAH (PPU)";
            case "PBPU": return "PEKERJA BUKAN PENERIMA UPAH (PBPU) / MANDIRI";
            case "BP": return "BUKAN PEKERJA (BP)";
            default: return val;
        }
    }

    const jenisFull = mapJenisPBI(jenis);

    const filtered = data.filter(d =>
        String(d.tahun) === tahun &&
        d.jenisPBI?.trim().toUpperCase() === jenisFull.trim().toUpperCase()
    );

    const labelTitle = `${jenisFull} - ${tahun}`;

    // Tentukan apakah tampil grafik biasa atau peta
    if (chartType === 'map') {
        renderMap(filtered);
    } else {
        renderChart(filtered, chartType, labelTitle);
    }
}

// --- Event listener untuk dropdown ---
document.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', updateChart);
});

// --- Jalankan pertama kali ---
updateChart();
