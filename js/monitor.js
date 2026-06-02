/**
 * 智慧农业集成平台 - 智能监测中心
 * ESP32 实时土壤湿度 & 温度监测
 */

(function() {
	'use strict';

	// ============ DOM Elements ============
	const humidityValue = document.getElementById('humidity-value');
	const temperatureValue = document.getElementById('temperature-value');
	const humidityBar = document.getElementById('humidity-bar');
	const temperatureBar = document.getElementById('temperature-bar');
	const humidityStatus = document.getElementById('humidity-status');
	const temperatureStatus = document.getElementById('temperature-status');
	const connectionStatusDot = document.querySelector('.status-dot');
	const connectionStatusText = document.querySelector('.status-text');
	const logContainer = document.getElementById('log-container');
	const clearLogBtn = document.getElementById('clear-log-btn');
	const chartCanvas = document.getElementById('data-chart');
	const ctx = chartCanvas.getContext('2d');

	// Connection method buttons
	const connectSerialBtn = document.getElementById('connect-serial-btn');
	const disconnectSerialBtn = document.getElementById('disconnect-serial-btn');
	const baudRateSelect = document.getElementById('baud-rate-select');
	const wsUrlInput = document.getElementById('ws-url');
	const connectWsBtn = document.getElementById('connect-ws-btn');
	const disconnectWsBtn = document.getElementById('disconnect-ws-btn');
	const startDemoBtn = document.getElementById('start-demo-btn');
	const stopDemoBtn = document.getElementById('stop-demo-btn');
	const refreshBtn = document.getElementById('refresh-btn');

	// ============ State ============
	let serialPort = null;
	let serialReader = null;
	let serialWriter = null;
	let wsSocket = null;
	let demoInterval = null;
	let activeConnection = null; // 'serial' | 'websocket' | 'demo' | null

	// Data history for chart (max 60 data points = 1 minute at 1/s)
	const MAX_HISTORY = 60;
	const humidityHistory = [];
	const temperatureHistory = [];
	const timeLabels = [];

	// ============ UI Update Functions ============
	function updateConnectionStatus(status) {
		connectionStatusDot.className = 'status-dot';
		connectionStatusText.className = 'status-text';
		switch (status) {
			case 'connected':
				connectionStatusDot.classList.add('connected');
				connectionStatusText.textContent = '已连接';
				break;
			case 'demo':
				connectionStatusDot.classList.add('demo');
				connectionStatusText.textContent = '演示模式';
				break;
			case 'disconnected':
			default:
				connectionStatusDot.classList.add('disconnected');
				connectionStatusText.textContent = '未连接';
				break;
		}
	}

	function updateSensorData(humidity, temperature, timestamp) {
		// Update humidity
		if (humidity !== null && humidity !== undefined) {
			const h = parseFloat(humidity);
			if (!isNaN(h)) {
				humidityValue.textContent = h.toFixed(1);
				humidityBar.style.width = Math.min(100, Math.max(0, h)) + '%';
				if (h < 20) {
					humidityStatus.textContent = '⚠ 干燥 - 需要灌溉';
					humidityStatus.style.color = '#EF6C00';
				} else if (h < 40) {
					humidityStatus.textContent = '偏干 - 建议灌溉';
					humidityStatus.style.color = '#FFA726';
				} else if (h <= 80) {
					humidityStatus.textContent = '✓ 湿度正常';
					humidityStatus.style.color = '#2E7D32';
				} else {
					humidityStatus.textContent = '⚠ 过湿 - 注意排水';
					humidityStatus.style.color = '#1565C0';
				}
			}
		}

		// Update temperature
		if (temperature !== null && temperature !== undefined) {
			const t = parseFloat(temperature);
			if (!isNaN(t)) {
				temperatureValue.textContent = t.toFixed(1);
				// Map 0°C ~ 50°C to 0% ~ 100%
				const pct = Math.min(100, Math.max(0, (t / 50) * 100));
				temperatureBar.style.width = pct + '%';
				if (t < 10) {
					temperatureStatus.textContent = '❄ 低温 - 注意防冻';
					temperatureStatus.style.color = '#1565C0';
				} else if (t < 15) {
					temperatureStatus.textContent = '偏冷 - 生长缓慢';
					temperatureStatus.style.color = '#29B6F6';
				} else if (t <= 30) {
					temperatureStatus.textContent = '✓ 温度适宜';
					temperatureStatus.style.color = '#2E7D32';
				} else if (t <= 38) {
					temperatureStatus.textContent = '偏热 - 注意通风';
					temperatureStatus.style.color = '#FFA726';
				} else {
					temperatureStatus.textContent = '🔥 高温 - 需要降温';
					temperatureStatus.style.color = '#D32F2F';
				}
			}
		}

		// Update history
		const now = timestamp ? new Date(timestamp * 1000) : new Date();
		const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });

		humidityHistory.push(parseFloat(humidity));
		temperatureHistory.push(parseFloat(temperature));
		timeLabels.push(timeStr);

		// Trim history
		while (humidityHistory.length > MAX_HISTORY) humidityHistory.shift();
		while (temperatureHistory.length > MAX_HISTORY) temperatureHistory.shift();
		while (timeLabels.length > MAX_HISTORY) timeLabels.shift();

		drawChart();
	}

	function addLogEntry(humidity, temperature, timestamp) {
		const now = timestamp ? new Date(timestamp * 1000) : new Date();
		const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });

		// Remove empty state
		const emptyEl = logContainer.querySelector('.log-empty');
		if (emptyEl) emptyEl.remove();

		const entry = document.createElement('div');
		entry.className = 'log-entry';
		entry.innerHTML = '<span class="log-time">[' + timeStr + ']</span>' +
			'<span class="log-humidity">💧 湿度: ' + parseFloat(humidity).toFixed(1) + '%</span>' +
			'<span class="log-temperature">🌡 温度: ' + parseFloat(temperature).toFixed(1) + '°C</span>';

		logContainer.insertBefore(entry, logContainer.firstChild);

		// Limit log entries
		while (logContainer.children.length > 200) {
			logContainer.removeChild(logContainer.lastChild);
		}
	}

	function clearLog() {
		logContainer.innerHTML = '<div class="log-empty">日志已清空</div>';
	}

	function resetDataDisplay() {
		humidityValue.textContent = '--';
		temperatureValue.textContent = '--';
		humidityBar.style.width = '0%';
		temperatureBar.style.width = '0%';
		humidityStatus.textContent = '等待数据...';
		humidityStatus.style.color = '#777';
		temperatureStatus.textContent = '等待数据...';
		temperatureStatus.style.color = '#777';
		humidityHistory.length = 0;
		temperatureHistory.length = 0;
		timeLabels.length = 0;
		drawChart();
	}

	// ============ Chart Drawing (Canvas) ============
	function drawChart() {
		const w = chartCanvas.width;
		const h = chartCanvas.height;
		ctx.clearRect(0, 0, w, h);

		if (humidityHistory.length === 0) {
			ctx.fillStyle = '#bbb';
			ctx.font = '18px "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('等待数据...', w / 2, h / 2);
			return;
		}

		const padding = { top: 30, right: 50, bottom: 60, left: 60 };
		const plotW = w - padding.left - padding.right;
		const plotH = h - padding.top - padding.bottom;

		// Draw grid
		ctx.strokeStyle = '#E0E0E0';
		ctx.lineWidth = 1;
		const gridLines = 5;
		for (let i = 0; i <= gridLines; i++) {
			const y = padding.top + (plotH / gridLines) * i;
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(w - padding.right, y);
			ctx.stroke();

			// Y-axis labels (0-100%)
			const val = 100 - (100 / gridLines) * i;
			ctx.fillStyle = '#999';
			ctx.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(val, padding.left - 8, y + 4);
		}

		// Draw humidity line (green)
		drawLine(humidityHistory, '#2E7D32', plotW, plotH, padding, 0, 100);

		// Draw temperature line (orange, secondary axis 0-50°C)
		drawLine(temperatureHistory, '#EF6C00', plotW, plotH, padding, 0, 50);

		// X-axis labels
		const maxLabels = Math.min(timeLabels.length, 6);
		const step = Math.max(1, Math.floor(timeLabels.length / maxLabels));
		ctx.fillStyle = '#999';
		ctx.font = '11px "Helvetica Neue", Helvetica, Arial, sans-serif';
		ctx.textAlign = 'center';
		for (let i = 0; i < timeLabels.length; i += step) {
			const x = padding.left + (plotW / (timeLabels.length - 1 || 1)) * i;
			ctx.fillText(timeLabels[i], x, h - padding.bottom + 20);
		}

		// Legend
		ctx.font = '14px "Arimo", sans-serif';
		ctx.textAlign = 'left';

		// Humidity legend
		ctx.fillStyle = '#2E7D32';
		ctx.fillRect(padding.left, 8, 16, 16);
		ctx.fillStyle = '#444';
		ctx.fillText('湿度 (%)', padding.left + 22, 21);

		// Temperature legend
		ctx.fillStyle = '#EF6C00';
		ctx.fillRect(padding.left + 120, 8, 16, 16);
		ctx.fillStyle = '#444';
		ctx.fillText('温度 (°C)', padding.left + 142, 21);
	}

	function drawLine(dataArray, color, plotW, plotH, padding, minVal, maxVal) {
		if (dataArray.length < 2) return;

		const range = maxVal - minVal || 1;
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.5;
		ctx.lineJoin = 'round';
		ctx.beginPath();

		for (let i = 0; i < dataArray.length; i++) {
			const x = padding.left + (plotW / (dataArray.length - 1)) * i;
			const val = (dataArray[i] - minVal) / range;
			const clampedVal = Math.max(0, Math.min(1, val));
			const y = padding.top + plotH - clampedVal * plotH;

			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
		ctx.stroke();

		// Draw dots at each data point
		ctx.fillStyle = color;
		for (let i = 0; i < dataArray.length; i++) {
			const x = padding.left + (plotW / (dataArray.length - 1)) * i;
			const val = (dataArray[i] - minVal) / range;
			const clampedVal = Math.max(0, Math.min(1, val));
			const y = padding.top + plotH - clampedVal * plotH;

			ctx.beginPath();
			ctx.arc(x, y, 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// ============ Data Parser ============
	function parseData(dataStr) {
		// Try JSON format first
		try {
			const json = JSON.parse(dataStr.trim());
			return {
				humidity: json.humidity,
				temperature: json.temperature,
				timestamp: json.timestamp || Math.floor(Date.now() / 1000)
			};
		} catch (e) {
			// Try CSV/comma-separated format: humidity,temperature
			const parts = dataStr.trim().split(/[\s,]+/);
			if (parts.length >= 2) {
				const h = parseFloat(parts[0]);
				const t = parseFloat(parts[1]);
				if (!isNaN(h) && !isNaN(t)) {
					return {
						humidity: h,
						temperature: t,
						timestamp: Math.floor(Date.now() / 1000)
					};
				}
			}
		}
		return null;
	}

	function processData(rawData) {
		const parsed = parseData(rawData);
		if (parsed) {
			updateSensorData(parsed.humidity, parsed.temperature, parsed.timestamp);
			addLogEntry(parsed.humidity, parsed.temperature, parsed.timestamp);
		}
	}

	// ============ Web Serial API (USB Connection) ============
	async function connectSerial() {
		if (!('serial' in navigator)) {
			alert('您的浏览器不支持 Web Serial API。\n请使用 Chrome/Edge 浏览器，或尝试 WiFi 连接 / 演示模式。');
			return;
		}

		try {
			serialPort = await navigator.serial.requestPort();
			const baudRate = parseInt(baudRateSelect.value);
			await serialPort.open({ baudRate: baudRate });

			serialReader = serialPort.readable.getReader();
			activeConnection = 'serial';
			updateConnectionStatus('connected');
			updateButtonStates();
			addLogEntryRaw('✅ 串口连接成功，波特率: ' + baudRate);

			// Read loop
			const decoder = new TextDecoder();
			let buffer = '';

			while (serialReader) {
				const { value, done } = await serialReader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Process complete lines
				const lines = buffer.split('\n');
				buffer = lines.pop(); // Keep incomplete line in buffer

				for (const line of lines) {
					if (line.trim()) {
						processData(line.trim());
					}
				}
			}
		} catch (err) {
			if (err.message !== 'The device was disconnected.' && err.name !== 'AbortError') {
				addLogEntryRaw('❌ 串口错误: ' + err.message);
			}
			disconnectSerial();
		}
	}

	async function disconnectSerial() {
		if (serialReader) {
			try { await serialReader.cancel(); } catch (e) {}
			serialReader = null;
		}
		if (serialPort) {
			try { await serialPort.close(); } catch (e) {}
			serialPort = null;
		}
		if (activeConnection === 'serial') {
			activeConnection = null;
			updateConnectionStatus('disconnected');
			resetDataDisplay();
		}
		updateButtonStates();
		addLogEntryRaw('🔌 串口已断开');
	}

	// ============ WebSocket Connection ============
	function connectWebSocket() {
		const url = wsUrlInput.value.trim();
		if (!url) {
			alert('请输入 WebSocket 地址');
			return;
		}

		try {
			wsSocket = new WebSocket(url);

			wsSocket.onopen = function() {
				activeConnection = 'websocket';
				updateConnectionStatus('connected');
				updateButtonStates();
				addLogEntryRaw('✅ WebSocket 连接成功: ' + url);
			};

			wsSocket.onmessage = function(event) {
				processData(event.data);
			};

			wsSocket.onerror = function(err) {
				addLogEntryRaw('❌ WebSocket 连接错误');
			};

			wsSocket.onclose = function() {
				if (activeConnection === 'websocket') {
					activeConnection = null;
					updateConnectionStatus('disconnected');
					resetDataDisplay();
				}
				updateButtonStates();
				addLogEntryRaw('🔌 WebSocket 已断开');
			};
		} catch (err) {
			addLogEntryRaw('❌ WebSocket 创建失败: ' + err.message);
			disconnectWebSocket();
		}
	}

	function disconnectWebSocket() {
		if (wsSocket) {
			wsSocket.close();
			wsSocket = null;
		}
		if (activeConnection === 'websocket') {
			activeConnection = null;
			updateConnectionStatus('disconnected');
		}
		updateButtonStates();
	}

	// ============ Demo Mode - 真实梅园数据模拟 ============
	// 模拟浙江余姚地区 6 月杨梅园数据
	// 日变化规律：清晨凉爽湿润 → 正午高温干燥 → 夜间降温回湿

	/** 根据小时返回基准温湿度（模拟夏季晴天） */
	function getBaseValue(hour) {
		// 温度曲线：凌晨最低(~18°C)，午后最高(~33°C)
		// 使用正弦波模拟日照变化
		const tempPeak = 33;     // 午后最高温
		const tempBase = 18;     // 凌晨最低温
		// 峰值在 14:00
		const tempSin = Math.sin((hour - 8) / 14 * Math.PI);
		const temperature = tempBase + (tempPeak - tempBase) * Math.max(0, tempSin);

		// 湿度曲线：与温度相反，清晨最高(~78%)，午后最低(~35%)
		const humHigh = 78;       // 清晨高湿
		const humLow = 35;        // 午后低湿
		const humidity = humLow + (humHigh - humLow) * Math.max(0, 1 - Math.abs((hour - 6) / 12));
		// 夜间额外回湿
		const nightBoost = (hour < 6 || hour >= 20) ? 8 : 0;

		return {
			temperature: Math.round(temperature * 10) / 10,
			humidity: Math.round((humidity + nightBoost) * 10) / 10
		};
	}

	/** 预加载 24 小时历史数据到图表 */
	function preloadHistory() {
		const now = new Date();
		// 从 24 小时前到现在，每 10 分钟一个数据点 = 144 个点
		const totalPoints = Math.min(144, MAX_HISTORY);
		const intervalSeconds = (24 * 3600) / totalPoints;

		for (let i = 0; i < totalPoints; i++) {
			const pointTime = new Date(now.getTime() - (totalPoints - i) * intervalSeconds * 1000);
			const hour = pointTime.getHours() + pointTime.getMinutes() / 60;
			const base = getBaseValue(hour);
			// 加 ±5% 随机抖动模拟自然波动
			const jitterH = (Math.random() - 0.5) * 5;
			const jitterT = (Math.random() - 0.5) * 2;
			const h = Math.round((base.humidity + jitterH) * 10) / 10;
			const t = Math.round((base.temperature + jitterT) * 10) / 10;
			const ts = Math.floor(pointTime.getTime() / 1000);
			const timeStr = pointTime.toLocaleTimeString('zh-CN', { hour12: false });

			humidityHistory.push(h);
			temperatureHistory.push(t);
			timeLabels.push(timeStr);
			addLogEntry(h, t, ts);
		}
	}

	function startDemo() {
		activeConnection = 'demo';
		updateConnectionStatus('demo');
		updateButtonStates();
		addLogEntryRaw('🎮 演示模式启动 - 模拟余姚杨梅园 6月数据');

		// 预加载历史数据
		preloadHistory();

		// 设定当前时间为午后 14:00 左右的基准（让演示效果更好）
		const now = new Date();
		const currentHour = now.getHours() + now.getMinutes() / 60;
		let simHour = currentHour;

		demoInterval = setInterval(function() {
			// 模拟时间推进（每 1 秒推进 5 分钟 = 加速 300 倍）
			simHour += 5 / 60;
			if (simHour >= 24) simHour -= 24;

			const base = getBaseValue(simHour);

			// 随机抖动模拟传感器噪声
			const jitterH = (Math.random() - 0.5) * 4;
			const jitterT = (Math.random() - 0.5) * 1.0;

			const h = Math.round(Math.max(5, Math.min(95, base.humidity + jitterH)) * 10) / 10;
			const t = Math.round(Math.max(2, Math.min(45, base.temperature + jitterT)) * 10) / 10;
			const ts = Math.floor(Date.now() / 1000);

			updateSensorData(h, t, ts);
			addLogEntry(h, t, ts);
		}, 1000);
	}

	function stopDemo() {
		if (demoInterval) {
			clearInterval(demoInterval);
			demoInterval = null;
		}
		if (activeConnection === 'demo') {
			activeConnection = null;
			updateConnectionStatus('disconnected');
			resetDataDisplay();
		}
		updateButtonStates();
		addLogEntryRaw('🛑 演示模式已停止');
	}

	// ============ Button State Management ============
	function updateButtonStates() {
		const isSerial = activeConnection === 'serial';
		const isWs = activeConnection === 'websocket';
		const isDemo = activeConnection === 'demo';
		const isConnected = isSerial || isWs || isDemo;

		connectSerialBtn.disabled = isConnected;
		disconnectSerialBtn.disabled = !isSerial;
		baudRateSelect.disabled = isConnected;
		wsUrlInput.disabled = isConnected;
		connectWsBtn.disabled = isConnected;
		disconnectWsBtn.disabled = !isWs;
		startDemoBtn.disabled = isConnected;
		stopDemoBtn.disabled = !isDemo;
	}

	function addLogEntryRaw(message) {
		const emptyEl = logContainer.querySelector('.log-empty');
		if (emptyEl) emptyEl.remove();

		const entry = document.createElement('div');
		entry.className = 'log-entry';
		entry.style.color = '#888';
		entry.style.fontStyle = 'italic';
		const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
		entry.innerHTML = '<span class="log-time">[' + now + ']</span> ' + message;

		logContainer.insertBefore(entry, logContainer.firstChild);

		while (logContainer.children.length > 200) {
			logContainer.removeChild(logContainer.lastChild);
		}
	}

	// ============ Event Listeners ============
	connectSerialBtn.addEventListener('click', connectSerial);
	disconnectSerialBtn.addEventListener('click', disconnectSerial);
	connectWsBtn.addEventListener('click', connectWebSocket);
	disconnectWsBtn.addEventListener('click', disconnectWebSocket);
	startDemoBtn.addEventListener('click', startDemo);
	stopDemoBtn.addEventListener('click', stopDemo);
	clearLogBtn.addEventListener('click', clearLog);
	if (refreshBtn) {
		refreshBtn.addEventListener('click', function(e) {
			e.preventDefault();
			if (activeConnection) {
				addLogEntryRaw('🔄 手动刷新 - 等待下一帧数据...');
			}
		});
	}

	// Cleanup on page unload
	window.addEventListener('beforeunload', function() {
		stopDemo();
		disconnectWebSocket();
		disconnectSerial();
	});

	// Initial chart draw
	drawChart();

	// Initial button states
	updateButtonStates();

})();