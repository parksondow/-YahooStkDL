// 全局變量
let stockChart = null;
let volumeChart = null;
let macdChart = null;
let kdChart = null;
let allStockData = [];
let currentPage = 1;
let pageSize = 50;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('股票分析工具初始化...');
    
    try {
        initializeCharts();
        setupEventListeners();
        initializeDates();
        console.log('初始化完成');
    } catch (error) {
        console.error('初始化失敗:', error);
        showError('初始化失敗: ' + error.message);
    }
});

// 初始化圖表
function initializeCharts() {
    try {
        const stockContainer = document.getElementById('stockChart');
        const volumeContainer = document.getElementById('volumeChart');
        const macdContainer = document.getElementById('macdChart');
        const kdContainer = document.getElementById('kdChart');

        if (!stockContainer || !volumeContainer || !macdContainer || !kdContainer) {
            throw new Error('找不到圖表容器');
        }

        stockChart = echarts.init(stockContainer);
        volumeChart = echarts.init(volumeContainer);
        macdChart = echarts.init(macdContainer);
        kdChart = echarts.init(kdContainer);

        // 設置空的初始配置
        const emptyOption = {
            grid: {
                left: '10%',
                right: '10%',
                bottom: '15%'
            },
            xAxis: {
                type: 'category',
                data: [],
                scale: true,
                boundaryGap: false,
                axisLine: { onZero: false },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                scale: true,
                splitLine: { show: true }
            },
            series: []
        };

        stockChart.setOption(emptyOption);
        volumeChart.setOption(emptyOption);
        macdChart.setOption(emptyOption);
        kdChart.setOption(emptyOption);

        // 添加窗口大小改變的監聽器
        window.addEventListener('resize', function() {
            stockChart.resize();
            volumeChart.resize();
            macdChart.resize();
            kdChart.resize();
        });

    } catch (error) {
        console.error('初始化圖表失敗:', error);
        throw error;
    }
}

// 設置事件監聽器
function setupEventListeners() {
    const fetchDataBtn = document.getElementById('fetchData');
    const exportCSVBtn = document.getElementById('exportCSV');
    const stockSymbolInput = document.getElementById('stockSymbol');
    const searchInput = document.getElementById('searchTable');
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    // 查詢數據按鈕
    fetchDataBtn.addEventListener('click', async () => {
        const symbol = stockSymbolInput.value.trim();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!symbol) {
            showError('請輸入股票代號');
            return;
        }

        if (!startDate || !endDate) {
            showError('請選擇日期範圍');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            showError('開始日期不能晚於結束日期');
            return;
        }

        showLoading(true);
        try {
            await fetchStockData(symbol, startDate, endDate);
            hideError();
        } catch (error) {
            showError('獲取數據失敗: ' + error.message);
        } finally {
            showLoading(false);
        }
    });

    // Enter鍵觸發查詢
    stockSymbolInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchDataBtn.click();
        }
    });

    // 導出CSV按鈕
    exportCSVBtn.addEventListener('click', downloadCSV);

    // 表格搜索
    searchInput.addEventListener('input', filterTable);

    // 分頁大小改變
    pageSizeSelect.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        updateTable();
    });

    // 分頁按鈕
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateTable();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allStockData.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            updateTable();
        }
    });
}

// 初始化日期
function initializeDates() {
    const today = new Date();
    const endDateInput = document.getElementById('endDate');
    const startDateInput = document.getElementById('startDate');

    // 設置結束日期為今天
    const endDateStr = formatDateForInput(today);
    endDateInput.value = endDateStr;
    
    // 設置開始日期為今年的1月1日
    const startDate = new Date(today.getFullYear(), 0, 1);
    const startDateStr = formatDateForInput(startDate);
    startDateInput.value = startDateStr;

    // 設置日期輸入框的最大值為今天
    endDateInput.max = endDateStr;
    startDateInput.max = endDateStr;
}

// 格式化日期為 YYYY-MM-DD
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 獲取股票數據
async function fetchStockData(symbol, startDate, endDate) {
    showLoading(true);
    
    try {
        const period1 = Math.floor(new Date(startDate).getTime() / 1000);
        const period2 = Math.floor(new Date(endDate).getTime() / 1000);

        // 優先使用本地代理服務器
        const proxyUrl = `/api/quote/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
        const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
        
        try {
            // 嘗試使用代理服務器
            console.log('嘗試使用代理服務器獲取數據...');
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`代理服務器錯誤: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.message || '代理服務器返回錯誤');
            }
            
            console.log('成功通過代理獲取數據');
            await processStockData(data, symbol);
            
        } catch (proxyError) {
            console.warn('代理服務器請求失敗:', proxyError.message);
            
            try {
                // 嘗試直接請求（可能會遇到CORS問題）
                console.log('嘗試直接請求Yahoo Finance API...');
                const response = await fetch(directUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('成功直接獲取數據');
                await processStockData(data, symbol);
                
            } catch (corsError) {
                console.warn('直接請求也失敗:', corsError.message);
                showError(
                    '無法獲取真實股票數據，可能的原因：\n\n' +
                    '1. 代理服務器未啟動（運行 proxy_server.py）\n' +
                    '2. 網絡連接問題\n' +
                    '3. 瀏覽器CORS限制\n\n' +
                    '現在將使用模擬數據進行演示。', 
                    'warning'
                );
                
                // 生成模擬數據用於演示
                generateMockData(symbol, startDate, endDate);
            }
        }
        
    } catch (error) {
        throw new Error('網絡請求失敗: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// 生成模擬數據
function generateMockData(symbol, startDate, endDate) {
    console.log('生成模擬數據用於演示...');
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const mockData = [];
    let basePrice = 100 + Math.random() * 200; // 基礎價格
    
    for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        
        // 跳過週末
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // 模擬價格波動
        const change = (Math.random() - 0.5) * 6; // -3% 到 +3%
        basePrice += change;
        
        const open = basePrice + (Math.random() - 0.5) * 2;
        const high = Math.max(open, basePrice) + Math.random() * 3;
        const low = Math.min(open, basePrice) - Math.random() * 3;
        const close = low + Math.random() * (high - low);
        const volume = Math.floor(Math.random() * 1000000) + 100000;
        
        mockData.push({
            time: date,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2)),
            volume: volume
        });
        
        basePrice = close;
    }
    
    allStockData = mockData;
    updateCharts(mockData);
    updateTable();
    
    document.getElementById('exportCSV').disabled = false;
    showError('演示模式：顯示模擬數據。要獲取真實數據，請解決CORS限制問題。', 'warning');
}

// 處理股票數據
async function processStockData(data, symbol) {
    if (!data || !data.chart || !data.chart.result || !data.chart.result[0]) {
        throw new Error('無效的數據格式');
    }

    const result = data.chart.result[0];
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;

    if (!timestamps || !quote) {
        throw new Error('數據格式錯誤');
    }

    const stockData = timestamps.map((time, i) => ({
        time: new Date(time * 1000),
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i]
    })).filter(item => 
        item.open !== null && 
        item.high !== null && 
        item.low !== null && 
        item.close !== null && 
        item.volume !== null
    );

    if (stockData.length === 0) {
        throw new Error('沒有找到有效的股票資料');
    }

    allStockData = stockData;
    updateCharts(stockData);
    updateTable();
    
    document.getElementById('exportCSV').disabled = false;
    
    // 保存到本地存儲
    localStorage.setItem('lastStockSymbol', symbol);
    localStorage.setItem('lastStockData', JSON.stringify(stockData.slice(-100))); // 只保存最近100筆
}

// 計算 MACD 指標
function calculateMACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const closes = data.map(item => item.close);
    const emaShort = calculateEMA(closes, shortPeriod);
    const emaLong = calculateEMA(closes, longPeriod);
    
    const DIF = emaShort.map((short, i) => short - emaLong[i]);
    const DEA = calculateEMA(DIF, signalPeriod);
    const MACD = DIF.map((dif, i) => (dif - DEA[i]) * 2);

    return { DIF, DEA, MACD };
}

// 計算指數移動平均線
function calculateEMA(data, period) {
    const alpha = 2 / (period + 1);
    const ema = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
        ema[i] = alpha * data[i] + (1 - alpha) * ema[i - 1];
    }
    
    return ema;
}

// 計算 KD 指標
function calculateKD(data, period = 9, kPeriod = 3, dPeriod = 3) {
    const highs = data.map(item => item.high);
    const lows = data.map(item => item.low);
    const closes = data.map(item => item.close);
    
    const RSV = [];
    const K = [50]; // K值初始值
    const D = [50]; // D值初始值

    // 計算RSV
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            RSV.push(50);
            continue;
        }

        const periodHigh = Math.max(...highs.slice(i - period + 1, i + 1));
        const periodLow = Math.min(...lows.slice(i - period + 1, i + 1));
        const rsv = ((closes[i] - periodLow) / (periodHigh - periodLow)) * 100;
        RSV.push(isNaN(rsv) ? 50 : rsv);
    }

    // 計算K值和D值
    for (let i = 1; i < RSV.length; i++) {
        const kValue = (K[i - 1] * (kPeriod - 1) + RSV[i]) / kPeriod;
        K.push(kValue);
        
        const dValue = (D[i - 1] * (dPeriod - 1) + kValue) / dPeriod;
        D.push(dValue);
    }

    return { K, D };
}

// 計算移動平均線
function calculateMA(data, period) {
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        result.push(sum / period);
    }
    
    return result;
}

// 更新圖表
function updateCharts(data) {
    if (!data || data.length === 0) return;

    const dates = data.map(item => formatDate(item.time));
    const volumes = data.map(item => item.volume);
    
    // 計算技術指標
    const macdData = calculateMACD(data);
    const kdData = calculateKD(data);
    const ma5 = calculateMA(data, 5);
    const ma20 = calculateMA(data, 20);

    // 更新 K 線圖
    stockChart.setOption({
        title: {
            text: '股價走勢圖',
            left: 'center',
            textStyle: {
                color: '#333',
                fontSize: 16
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#ccc',
            textStyle: {
                color: '#333'
            }
        },
        legend: {
            data: ['K線', 'MA5', 'MA20'],
            bottom: 10
        },
        grid: {
            left: '10%',
            right: '10%',
            top: '15%',
            bottom: '20%'
        },
        xAxis: {
            type: 'category',
            data: dates,
            scale: true,
            boundaryGap: false,
            axisLine: { onZero: false },
            splitLine: { show: false },
            splitNumber: 20
        },
        yAxis: {
            scale: true,
            splitArea: {
                show: true
            }
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: [0],
                start: Math.max(0, 100 - (500 / data.length * 100)),
                end: 100
            },
            {
                show: true,
                type: 'slider',
                xAxisIndex: [0],
                bottom: 0,
                start: Math.max(0, 100 - (500 / data.length * 100)),
                end: 100
            }
        ],
        series: [
            {
                name: 'K線',
                type: 'candlestick',
                data: data.map(item => [item.open, item.close, item.low, item.high]),
                itemStyle: {
                    color: '#14b143',
                    color0: '#ef232a',
                    borderColor: '#14b143',
                    borderColor0: '#ef232a'
                }
            },
            {
                name: 'MA5',
                type: 'line',
                data: ma5,
                smooth: true,
                symbol: 'none',
                lineStyle: {
                    width: 1,
                    color: '#ff9800'
                }
            },
            {
                name: 'MA20',
                type: 'line',
                data: ma20,
                smooth: true,
                symbol: 'none',
                lineStyle: {
                    width: 1,
                    color: '#2962ff'
                }
            }
        ]
    });

    // 更新成交量圖
    volumeChart.setOption({
        title: {
            text: '成交量',
            left: 'center',
            textStyle: {
                fontSize: 14
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        grid: {
            left: '10%',
            right: '10%',
            top: '20%',
            bottom: '20%'
        },
        xAxis: {
            data: dates,
            scale: true,
            boundaryGap: false
        },
        yAxis: {
            scale: true
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: [0],
                start: Math.max(0, 100 - (500 / data.length * 100)),
                end: 100
            }
        ],
        series: [{
            type: 'bar',
            data: volumes,
            itemStyle: {
                color: function(params) {
                    const item = data[params.dataIndex];
                    return item.close >= item.open ? '#14b143' : '#ef232a';
                }
            }
        }]
    });

    // 更新 MACD 圖
    macdChart.setOption({
        title: {
            text: 'MACD指標',
            left: 'center',
            textStyle: {
                fontSize: 14
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: ['DIF', 'DEA', 'MACD'],
            bottom: 5
        },
        grid: {
            left: '10%',
            right: '10%',
            top: '20%',
            bottom: '25%'
        },
        xAxis: {
            type: 'category',
            data: dates,
            scale: true,
            boundaryGap: false
        },
        yAxis: {
            scale: true,
            splitArea: {
                show: true
            }
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: [0],
                start: Math.max(0, 100 - (500 / data.length * 100)),
                end: 100
            }
        ],
        series: [{
            name: 'DIF',
            type: 'line',
            data: macdData.DIF,
            symbol: 'none',
            lineStyle: {
                width: 1.5,
                color: '#2962ff'
            }
        }, {
            name: 'DEA',
            type: 'line',
            data: macdData.DEA,
            symbol: 'none',
            lineStyle: {
                width: 1.5,
                color: '#ff9800'
            }
        }, {
            name: 'MACD',
            type: 'bar',
            data: macdData.MACD,
            itemStyle: {
                color: function(params) {
                    return params.data >= 0 ? '#14b143' : '#ef232a';
                }
            }
        }]
    });

    // 更新 KD 圖
    kdChart.setOption({
        title: {
            text: 'KD指標',
            left: 'center',
            textStyle: {
                fontSize: 14
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: ['K', 'D'],
            bottom: 5
        },
        grid: {
            left: '10%',
            right: '10%',
            top: '20%',
            bottom: '25%'
        },
        xAxis: {
            type: 'category',
            data: dates,
            scale: true,
            boundaryGap: false
        },
        yAxis: {
            scale: true,
            min: 0,
            max: 100,
            splitArea: {
                show: true
            }
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: [0],
                start: Math.max(0, 100 - (500 / data.length * 100)),
                end: 100
            }
        ],
        series: [{
            name: 'K',
            type: 'line',
            data: kdData.K,
            symbol: 'none',
            lineStyle: {
                width: 1.5,
                color: '#2962ff'
            }
        }, {
            name: 'D',
            type: 'line',
            data: kdData.D,
            symbol: 'none',
            lineStyle: {
                width: 1.5,
                color: '#ff9800'
            }
        }]
    });

    // 連接所有圖表，使它們同步縮放
    echarts.connect([stockChart, volumeChart, macdChart, kdChart]);
}

// 更新數據表格
function updateTable() {
    if (!allStockData || allStockData.length === 0) return;
    
    const tbody = document.querySelector('#priceTable tbody');
    tbody.innerHTML = '';
    
    // 計算分頁
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, allStockData.length);
    const pageData = allStockData.slice(startIndex, endIndex);
    
    // 填充數據
    pageData.forEach((item, index) => {
        const prevItem = index > 0 ? pageData[index - 1] : 
                        startIndex > 0 ? allStockData[startIndex - 1] : null;
        
        const change = prevItem ? item.close - prevItem.close : 0;
        const changePercent = prevItem ? ((change / prevItem.close) * 100) : 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.time)}</td>
            <td>${item.open.toFixed(2)}</td>
            <td>${item.high.toFixed(2)}</td>
            <td>${item.low.toFixed(2)}</td>
            <td>${item.close.toFixed(2)}</td>
            <td>${item.volume.toLocaleString()}</td>
            <td class="${change >= 0 ? 'positive' : 'negative'}">
                ${change >= 0 ? '+' : ''}${change.toFixed(2)}
            </td>
            <td class="${changePercent >= 0 ? 'positive' : 'negative'}">
                ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // 更新分頁信息
    const totalPages = Math.ceil(allStockData.length / pageSize);
    document.getElementById('pageInfo').textContent = 
        `第 ${currentPage} 頁，共 ${totalPages} 頁 (總計 ${allStockData.length} 筆)`;
    
    // 更新分頁按鈕狀態
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

// 表格搜索過濾
function filterTable() {
    // 這裡可以實現表格搜索功能
    console.log('表格搜索功能待實現');
}

// 格式化日期
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 下載CSV
function downloadCSV() {
    if (!allStockData || allStockData.length === 0) {
        showError('沒有數據可以導出');
        return;
    }

    const symbol = document.getElementById('stockSymbol').value || 'stock';
    const rows = [
        ['日期', '開盤', '最高', '最低', '收盤', '成交量']
    ];
    
    allStockData.forEach(item => {
        rows.push([
            formatDate(item.time),
            item.open.toFixed(2),
            item.high.toFixed(2),
            item.low.toFixed(2),
            item.close.toFixed(2),
            item.volume
        ]);
    });
    
    const csvContent = '\ufeff' + rows.map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${symbol}_股票數據_${formatDate(new Date())}.csv`;
    link.click();
    
    showSuccess('CSV文件已下載');
}

// 重設圖表縮放
function resetZoom(chartType) {
    const chart = window[chartType];
    if (chart) {
        chart.dispatchAction({
            type: 'dataZoom',
            start: 0,
            end: 100
        });
    }
}

// 顯示錯誤信息
function showError(message, type = 'error') {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.className = type === 'warning' ? 'error warning' : 'error';
        errorDiv.style.display = 'block';
        
        // 自動隱藏
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 8000);
    }
}

// 隱藏錯誤信息
function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// 顯示成功信息
function showSuccess(message) {
    // 創建臨時成功提示
    const successDiv = document.createElement('div');
    successDiv.className = 'error';
    successDiv.style.backgroundColor = '#d4edda';
    successDiv.style.borderColor = '#14b143';
    successDiv.style.color = '#155724';
    successDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// 顯示/隱藏載入動畫
function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = show ? 'flex' : 'none';
    }
}

// 全局錯誤處理
window.addEventListener('error', function(e) {
    console.error('全局錯誤:', e.error);
    showError('應用程序發生錯誤，請刷新頁面重試');
});

// 頁面卸載時清理
window.addEventListener('beforeunload', function() {
    if (stockChart) stockChart.dispose();
    if (volumeChart) volumeChart.dispose();
    if (macdChart) macdChart.dispose();
    if (kdChart) kdChart.dispose();
});