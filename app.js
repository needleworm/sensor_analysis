/**
 * Industrial Sensor Time-Series Analytics Dashboard Application
 * 100% Client-side Execution - Zero External Transmission
 */

(function() {
  'use strict';

  // State Management
  let dataset = window.RAW_SENSOR_DATA || [];
  let summary = window.DATA_SUMMARY || null;
  let activeEventFilter = 'ALL';
  let chartInstances = {};

  // Extract core series
  function getSeries(data = dataset) {
    return {
      timestamps: data.map(d => d.timestamp),
      minutes: data.map(d => d.minute),
      tempRaw: data.map(d => d.temp_raw),
      tempTrue: data.map(d => d.temp_true),
      vibration: data.map(d => d.vibration_rms),
      pressure: data.map(d => d.pressure),
      events: data.map(d => d.event)
    };
  }

  // 20 Techniques Catalog
  const TECHNIQUES = [
    {
      id: 1,
      cat: '스무딩/정제',
      name: '단순 이동평균 (SMA)',
      eng: 'Simple Moving Average',
      desc: '설정된 슬라이딩 윈도우 내 데이터의 산술평균을 연속 계산하여 단기 고주파 센서 잡음을 부드럽게 감쇠시킵니다.',
      formula: 'SMA_t = (1 / W) * Σ x_{t-i}',
      tab: 'tab-smoothing',
      param: '윈도우 크기 W (5~60분)'
    },
    {
      id: 2,
      cat: '스무딩/정제',
      name: '지수 이동평균 (EMA)',
      eng: 'Exponential Moving Average',
      desc: '최신 관측치에 지수 가중치를 부여하여 단순 이동평균(SMA)의 고질적 단점인 시간 지연(Phase Lag)을 크게 줄입니다.',
      formula: 'EMA_t = α * x_t + (1 - α) * EMA_{t-1}',
      tab: 'tab-smoothing',
      param: '평활 계수 α = 2 / (N + 1)'
    },
    {
      id: 3,
      cat: '스무딩/정제',
      name: '가중 이동평균 (WMA)',
      eng: 'Weighted Moving Average',
      desc: '윈도우 내에서 시간 순서에 비례하는 선형/삼각 가중치를 부여하여 스텝형 급변 구간의 반응성을 향상시킵니다.',
      formula: 'WMA_t = Σ (w_i * x_i) / Σ w_i',
      tab: 'tab-smoothing',
      param: '선형 가중치 윈도우 크기'
    },
    {
      id: 4,
      cat: '스무딩/정제',
      name: '사비츠키-골레이 필터',
      eng: 'Savitzky-Golay Filter',
      desc: '국소 구간 다항식 회귀를 수행하여 신호의 최고점(Peak) 첨도와 면적, 곡률을 훼손하지 않고 노이즈만 선택 제거합니다.',
      formula: 'min Σ [x_{t+i} - Σ c_k * i^k]^2',
      tab: 'tab-smoothing',
      param: '윈도우 W (11~41), 다항식 차수 (2~4)'
    },
    {
      id: 5,
      cat: '스무딩/정제',
      name: '1차원 칼만 필터',
      eng: '1D Kalman Filter',
      desc: '공정 노이즈 공분산(Q)과 센서 측정 오차 공분산(R)을 기반으로 물리적 상태를 실시간 재귀 추정합니다.',
      formula: 'K_k = P_k^- / (P_k^- + R), x_k = x_k^- + K_k * (z_k - x_k^-)',
      tab: 'tab-smoothing',
      param: '프로세스 노이즈 Q, 측정 노이즈 R'
    },
    {
      id: 6,
      cat: '스무딩/정제',
      name: '중앙값 필터 (Median)',
      eng: 'Median Filter',
      desc: '국소 윈도우의 중위수를 취하여 센서 전송 에러로 발생하는 단일 임펄스 스파이크를 원천 소거합니다.',
      formula: 'Med_t = median(x_{t-m}, ..., x_{t+m})',
      tab: 'tab-smoothing',
      param: '중앙값 윈도우 크기 (5~21)'
    },
    {
      id: 7,
      cat: '형상/포락선',
      name: '상·하한 피크 포락선',
      eng: 'Peak Envelope Analysis',
      desc: '국소 극대값과 극소값을 검출하고 보간하여 신호의 동적 운전 진폭 대역(Upper/Lower Envelope)을 형성합니다.',
      formula: 'Spline(Local_Max), Spline(Local_Min)',
      tab: 'tab-envelope',
      param: '극점 탐색 구간 폭 (20~60분)'
    },
    {
      id: 8,
      cat: '형상/포락선',
      name: '돌출도 기반 피크/밸리 검출',
      eng: 'Peak & Valley Detection',
      desc: '주변 신호 대비 통계적 돌출도(Prominence)와 최소 거리를 만족하는 단기 과열(Peak) 및 일시 냉각(Valley)을 자동 식별합니다.',
      formula: 'x_t > μ + k * σ ∩ Local Extrema',
      tab: 'tab-envelope',
      param: '임계 계수 k, 최소 간격'
    },
    {
      id: 9,
      cat: '형상/포락선',
      name: '다항 추세 분해 및 잔차 분석',
      eng: 'Polynomial Detrending',
      desc: '24시간 주기의 기저 열적 추세선(Baseline Trend)을 분리하고 고주파 잔차(Residual)의 분산 특성을 규명합니다.',
      formula: 'y_t = Trend_t(at^2 + bt + c) + Residual_t',
      tab: 'tab-envelope',
      param: '다항식 차수 (1~3차)'
    },
    {
      id: 10,
      cat: '형상/포락선',
      name: '볼린저 밴드 변동성 채널',
      eng: 'Bollinger Bands Channel',
      desc: '이동평균선과 k배의 이동 표준편차 밴드를 구축하여 설비 정상 운전 범위를 시각화하고 밴드 이탈을 모니터링합니다.',
      formula: 'Upper/Lower = SMA_N ± k * σ_N',
      tab: 'tab-envelope',
      param: '기간 N=20, 승수 k=2.0'
    },
    {
      id: 11,
      cat: '이상치 탐지',
      name: '햄펠 필터 이상치 탐지',
      eng: 'Hampel Filter Anomaly',
      desc: '슬라이딩 윈도우의 중앙값 절대편차(MAD) 기반으로 극단값에 왜곡되지 않는 강건한(Robust) 3-시그마 스파이크를 탐지합니다.',
      formula: '|x_i - Med| > 3 * 1.4826 * MAD',
      tab: 'tab-anomaly',
      param: '창 크기 W=21, 임계 승수 3.0'
    },
    {
      id: 12,
      cat: '이상치 탐지',
      name: '수정 Z-score 탐지법',
      eng: 'Modified Z-score (Iglewicz)',
      desc: '평균과 표준편차 대신 중위수(Median)와 MAD를 사용하여 대형 스파이크가 전체 이상치 지표를 왜곡하는 마스킹 효과를 방지합니다.',
      formula: 'M_i = 0.6745 * (x_i - Med) / MAD',
      tab: 'tab-anomaly',
      param: '임계치 M > 3.5'
    },
    {
      id: 13,
      cat: '이상치 탐지',
      name: 'IQR 사분위수 박스플롯 기법',
      eng: 'IQR Outlier Fence',
      desc: '비모수 사분위수(Q1, Q3)를 기반으로 1.5배 IQR 울타리를 초과하는 통계적 이상 데이터를 완벽하게 스크리닝합니다.',
      formula: '[Q1 - 1.5*IQR,  Q3 + 1.5*IQR]',
      tab: 'tab-anomaly',
      param: 'IQR 배수 k=1.5'
    },
    {
      id: 14,
      cat: '이상치 탐지',
      name: 'CUSUM 누적합 관리도',
      eng: 'Cumulative Sum Control Chart',
      desc: '목표 기준선 대비 누적 편차를 추적하여 단일 샘플로는 감지하기 어려운 완만한 미세 드리프트와 스텝 변위(Step Change)를 포착합니다.',
      formula: 'S_h = max(0, S_{h-1} + (x_t - μ) - K)',
      tab: 'tab-anomaly',
      param: '허용치 K=0.5σ, 결정한계 H=4.0σ'
    },
    {
      id: 15,
      cat: '다변량 분석',
      name: '다변량 동기화 표준화',
      eng: 'Multi-Sensor Normalization',
      desc: '온도(°C), 진동(mm/s), 압력(kPa)의 상이한 단위와 스케일을 MinMax/Z-Score로 일치시켜 복합 거동을 동일 축에서 직관 비교합니다.',
      formula: 'x_{norm} = (x - min) / (max - min)',
      tab: 'tab-multivariate',
      param: 'MinMax [0, 1] 또는 Z-Score 표준화'
    },
    {
      id: 16,
      cat: '다변량 분석',
      name: '피어슨 & 스피어만 상관 분석',
      eng: 'Correlation Matrix Analysis',
      desc: '온도, 진동, 압력 간 선형(Pearson) 및 순위 비선형(Spearman) 상관계수 매트릭스를 도출하여 상호 의존성을 정량화합니다.',
      formula: 'r_{xy} = Cov(X,Y) / (σ_X * σ_Y)',
      tab: 'tab-multivariate',
      param: 'Pearson r & Spearman ρ'
    },
    {
      id: 17,
      cat: '다변량 분석',
      name: '상호상관 시차 지연 분석',
      eng: 'Cross-Correlation & Time-Lag',
      desc: '모터 진동 및 압력 부하 상승 후 센서 온도가 도달하기까지의 물리적 열용량 시간 지연(Phase Lag)을 정밀 산출합니다.',
      formula: 'R_{xy}(τ) = Σ (x_t - μ_x)(y_{t+τ} - μ_y)',
      tab: 'tab-multivariate',
      param: '시차 범위 τ = [-30, +30분]'
    },
    {
      id: 18,
      cat: '다변량 분석',
      name: '마할라노비스 다변량 이상 지수',
      eng: 'Mahalanobis Distance Metric',
      desc: '변수 간 공분산 역행렬을 반영하여 개별 센서는 정상 범위 내에 있으나 3변수의 조합이 이례적인 복합 결함 상태를 탐지합니다.',
      formula: 'D_M = sqrt((x - μ)^T * Σ^(-1) * (x - μ))',
      tab: 'tab-multivariate',
      param: '카이제곱 임계치 (χ² df=3, p=0.05)'
    },
    {
      id: 19,
      cat: '오차/평가',
      name: '필터 성능 정량 평가 벤치마크',
      eng: 'Filter Quantitative Benchmark',
      desc: '온도 참값(Ground Truth)과 비교하여 MAE, RMSE, MAPE, SNR, 피크 감쇠율(Peak Retention)을 체계적으로 벤치마킹합니다.',
      formula: 'MAE = (1/N) Σ |y - ŷ|,  SNR = 10 * log10(Var_s / Var_n)',
      tab: 'tab-benchmark',
      param: 'MAE, RMSE, SNR(dB), Retention%'
    },
    {
      id: 20,
      cat: '도메인 분석',
      name: '운전 상태별 특성 프로파일링',
      eng: 'Operating State Profiling',
      desc: '정상, 부하 증가, 단기 과열, 급격한 과열, 장시간 부하, 일시 냉각, 스파이크의 7개 운전 상태별 다차원 센서 지문을 구축합니다.',
      formula: 'Profile_k = [μ_T, σ_T, μ_V, σ_V, μ_P, σ_P]',
      tab: 'tab-benchmark',
      param: '7개 상태 그룹 다변량 레이더 지문'
    }
  ];

  // Initialize Dashboard
  function initDashboard() {
    renderHeaderInfo();
    renderKpis();
    renderEventNavigator();
    setupTabNavigation();
    renderTechniquesMatrix();
    
    // Initial Render of Active Tab
    renderTabSmoothing();
    setupSmoothingControls();

    // Event Listeners for sub-tabs (lazy loading)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.currentTarget.dataset.tab;
        switchTab(tabId);
      });
    });

    // Print Button
    document.getElementById('btnPrintReport')?.addEventListener('click', () => {
      switchTab('tab-report');
      window.print();
    });
  }

  function renderHeaderInfo() {
    const s = getSeries();
    document.getElementById('metaCount').textContent = `${s.timestamps.length} 포인트 (24시간)`;
    document.getElementById('metaSpan').textContent = `00:00 ~ 23:59 (1분 주기)`;
  }

  function renderKpis() {
    const s = getSeries();
    const noise = s.tempRaw.map((v, i) => v - s.tempTrue[i]);
    const mae = SensorAlgorithms.mean(noise.map(Math.abs));
    const rmse = Math.sqrt(SensorAlgorithms.mean(noise.map(x => x * x)));
    const trueVar = Math.pow(SensorAlgorithms.std(s.tempTrue), 2);
    const noiseVar = Math.pow(SensorAlgorithms.std(noise), 2);
    const snr = 10 * Math.log10(trueVar / noiseVar);

    // Peak stats
    const maxTemp = Math.max(...s.tempRaw);
    const maxTempIdx = s.tempRaw.indexOf(maxTemp);
    const maxVib = Math.max(...s.vibration);

    // Anomaly stats via Hampel
    const hampelRes = SensorAlgorithms.hampelFilter(s.tempRaw, 21, 3.0);

    document.getElementById('kpiTotalPoints').innerHTML = `${s.timestamps.length} <span class="kpi-unit">min</span>`;
    document.getElementById('kpiNoiseSnr').innerHTML = `${snr.toFixed(1)} <span class="kpi-unit">dB</span>`;
    document.getElementById('kpiNoiseMetrics').innerHTML = `MAE: ${mae.toFixed(2)}°C / RMSE: ${rmse.toFixed(2)}°C`;
    document.getElementById('kpiAnomalies').innerHTML = `${hampelRes.anomalies.length} <span class="kpi-unit">건</span>`;
    document.getElementById('kpiMaxTemp').innerHTML = `${maxTemp.toFixed(1)} <span class="kpi-unit">°C</span>`;
    document.getElementById('kpiMaxTempMeta').innerHTML = `발생시각: ${s.timestamps[maxTempIdx]} (${s.events[maxTempIdx]})`;
  }

  function renderEventNavigator() {
    const s = getSeries();
    const eventCounts = {};
    s.events.forEach(ev => { eventCounts[ev] = (eventCounts[ev] || 0) + 1; });

    const container = document.getElementById('eventPillsContainer');
    container.innerHTML = '';

    // "All" pill
    const allPill = document.createElement('div');
    allPill.className = `event-pill ${activeEventFilter === 'ALL' ? 'active' : ''}`;
    allPill.textContent = `전체 (1440분)`;
    allPill.addEventListener('click', () => filterByEvent('ALL'));
    container.appendChild(allPill);

    const eventColors = {
      '정상': 'badge-success',
      '부하 증가': 'badge-primary',
      '단기 과열': 'badge-warning',
      '급격한 과열': 'badge-danger',
      '장시간 부하': 'badge-danger',
      '일시 냉각': 'badge-primary',
      '스파이크 이상치': 'badge-warning'
    };

    Object.keys(eventCounts).forEach(ev => {
      const pill = document.createElement('div');
      pill.className = `event-pill ${activeEventFilter === ev ? 'active' : ''}`;
      pill.textContent = `${ev} (${eventCounts[ev]}분)`;
      pill.addEventListener('click', () => filterByEvent(ev));
      container.appendChild(pill);
    });
  }

  function filterByEvent(eventName) {
    activeEventFilter = eventName;
    renderEventNavigator();

    // Re-render current active tab
    const activeTabEl = document.querySelector('.tab-pane.active');
    if (activeTabEl) {
      const tabId = activeTabEl.id;
      renderActiveTabContent(tabId);
    }
  }

  function setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        const targetPane = document.getElementById(btn.dataset.tab);
        if (targetPane) targetPane.classList.add('active');

        renderActiveTabContent(btn.dataset.tab);
      });
    });
  }

  function switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
  }

  function renderActiveTabContent(tabId) {
    switch (tabId) {
      case 'tab-overview':
        // Overview already rendered
        break;
      case 'tab-smoothing':
        renderTabSmoothing();
        break;
      case 'tab-envelope':
        renderTabEnvelope();
        break;
      case 'tab-anomaly':
        renderTabAnomaly();
        break;
      case 'tab-multivariate':
        renderTabMultivariate();
        break;
      case 'tab-benchmark':
        renderTabBenchmark();
        break;
      case 'tab-report':
        // Report text
        break;
    }
  }

  // 1. Overview Matrix
  function renderTechniquesMatrix() {
    const container = document.getElementById('techniquesMatrixGrid');
    if (!container) return;
    container.innerHTML = '';

    TECHNIQUES.forEach(t => {
      const card = document.createElement('div');
      card.className = 'technique-card';
      card.innerHTML = `
        <span class="technique-badge-cat">${t.cat}</span>
        <div class="technique-num">TECHNIQUE #${String(t.id).padStart(2, '0')}</div>
        <div class="technique-title">${t.name}</div>
        <div class="technique-subtitle">${t.eng}</div>
        <div class="technique-desc">${t.desc}</div>
        <div class="technique-formula">${t.formula}</div>
        <div class="technique-footer">
          <span>권장 파라미터: ${t.param}</span>
          <span style="color: var(--accent-primary); font-weight: 600;">체험 이동 →</span>
        </div>
      `;
      card.addEventListener('click', () => {
        switchTab(t.tab);
      });
      container.appendChild(card);
    });
  }

  // 2. Tab: Smoothing & Denoising (Techniques 1~6)
  function renderTabSmoothing() {
    const s = getSeries();
    const filterType = document.getElementById('smoothingAlgorithmSelect')?.value || 'savitzkyGolay';
    const windowSize = parseInt(document.getElementById('smoothingWindowSlider')?.value || 15, 10);
    const polyOrder = parseInt(document.getElementById('smoothingPolySelect')?.value || 2, 10);
    const kalmanQ = parseFloat(document.getElementById('kalmanQInput')?.value || 0.02);
    const kalmanR = parseFloat(document.getElementById('kalmanRInput')?.value || 0.8);

    let filteredSeries = [];
    let filterName = '';

    switch (filterType) {
      case 'sma':
        filteredSeries = SensorAlgorithms.sma(s.tempRaw, windowSize);
        filterName = `단순 이동평균 (SMA W=${windowSize})`;
        break;
      case 'ema':
        filteredSeries = SensorAlgorithms.ema(s.tempRaw, windowSize);
        filterName = `지수 이동평균 (EMA N=${windowSize})`;
        break;
      case 'wma':
        filteredSeries = SensorAlgorithms.wma(s.tempRaw, windowSize);
        filterName = `가중 이동평균 (WMA W=${windowSize})`;
        break;
      case 'savitzkyGolay':
        filteredSeries = SensorAlgorithms.savitzkyGolay(s.tempRaw, windowSize, polyOrder);
        filterName = `사비츠키-골레이 (SG W=${windowSize}, Order=${polyOrder})`;
        break;
      case 'kalman':
        const kRes = SensorAlgorithms.kalmanFilter(s.tempRaw, kalmanQ, kalmanR);
        filteredSeries = kRes.estimate;
        filterName = `칼만 필터 (Kalman Q=${kalmanQ}, R=${kalmanR})`;
        break;
      case 'median':
        filteredSeries = SensorAlgorithms.medianFilter(s.tempRaw, windowSize);
        filterName = `중앙값 필터 (Median W=${windowSize})`;
        break;
    }

    // Performance Metrics
    const perf = SensorAlgorithms.evaluatePerformance(s.tempRaw, s.tempTrue, filteredSeries);
    const rawPerf = SensorAlgorithms.evaluatePerformance(s.tempRaw, s.tempTrue, s.tempRaw);

    document.getElementById('smoothMetricMae').textContent = `${perf.mae.toFixed(3)} °C`;
    document.getElementById('smoothMetricRmse').textContent = `${perf.rmse.toFixed(3)} °C`;
    document.getElementById('smoothMetricSnr').textContent = `${perf.snr.toFixed(2)} dB`;
    document.getElementById('smoothMetricRetention').textContent = `${perf.peakRetention.toFixed(1)} %`;

    // Comparison with Raw
    const maeImprove = ((rawPerf.mae - perf.mae) / rawPerf.mae * 100).toFixed(1);
    document.getElementById('smoothMetricMaeImprove').textContent = `(원시값 대비 ${maeImprove}% 개선)`;

    // Render Chart
    const ctx = document.getElementById('smoothingChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.smoothingChart) chartInstances.smoothingChart.destroy();

    // Data sample or filter by event if active
    let labels = s.timestamps;
    let rawData = s.tempRaw;
    let trueData = s.tempTrue;
    let filtData = filteredSeries;

    if (activeEventFilter !== 'ALL') {
      const indices = [];
      s.events.forEach((ev, idx) => { if (ev === activeEventFilter) indices.push(idx); });
      labels = indices.map(i => s.timestamps[i]);
      rawData = indices.map(i => s.tempRaw[i]);
      trueData = indices.map(i => s.tempTrue[i]);
      filtData = indices.map(i => filteredSeries[i]);
    }

    chartInstances.smoothingChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '원시값 (Raw Temp)',
            data: rawData,
            borderColor: 'rgba(148, 163, 184, 0.45)',
            borderWidth: 1.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0
          },
          {
            label: '참값·비교용 (Ground Truth)',
            data: trueData,
            borderColor: 'rgba(52, 211, 153, 0.85)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.1
          },
          {
            label: filterName,
            data: filtData,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            borderWidth: 2.2,
            pointRadius: 0,
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#cbd5e1', font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#38bdf8',
            bodyColor: '#e2e8f0',
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${context.parsed.y.toFixed(3)} °C`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', maxTicksLimit: 14 },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            title: { display: true, text: '온도 (°C)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });

    // Sub-chart: Noise Residual (Filtered - True)
    renderSmoothingResidualChart(labels, filtData, trueData);
  }

  function renderSmoothingResidualChart(labels, filtered, trueData) {
    const ctx = document.getElementById('smoothingResidualChart')?.getContext('2d');
    if (!ctx) return;
    if (chartInstances.smoothingResidual) chartInstances.smoothingResidual.destroy();

    const residuals = filtered.map((v, i) => v - trueData[i]);

    chartInstances.smoothingResidual = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '복원 잔차 오차 (Filtered - Ground Truth)',
          data: residuals,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderWidth: 1.2,
          pointRadius: 0,
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            callbacks: {
              label: ctx => ` 오차: ${ctx.parsed.y.toFixed(3)} °C`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', maxTicksLimit: 14 }, grid: { display: false } },
          y: {
            title: { display: true, text: '잔차 오차 (°C)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  function setupSmoothingControls() {
    const algoSelect = document.getElementById('smoothingAlgorithmSelect');
    const winSlider = document.getElementById('smoothingWindowSlider');
    const winVal = document.getElementById('smoothingWindowVal');
    const polySelect = document.getElementById('smoothingPolySelect');
    const polyGroup = document.getElementById('smoothingPolyGroup');
    const kalmanGroup = document.getElementById('kalmanGroup');

    algoSelect?.addEventListener('change', () => {
      const val = algoSelect.value;
      if (val === 'savitzkyGolay') {
        polyGroup.style.display = 'flex';
        kalmanGroup.style.display = 'none';
      } else if (val === 'kalman') {
        polyGroup.style.display = 'none';
        kalmanGroup.style.display = 'flex';
      } else {
        polyGroup.style.display = 'none';
        kalmanGroup.style.display = 'none';
      }
      renderTabSmoothing();
    });

    winSlider?.addEventListener('input', (e) => {
      winVal.textContent = e.target.value;
      renderTabSmoothing();
    });

    polySelect?.addEventListener('change', () => renderTabSmoothing());
    document.getElementById('kalmanQInput')?.addEventListener('input', () => renderTabSmoothing());
    document.getElementById('kalmanRInput')?.addEventListener('input', () => renderTabSmoothing());
  }

  // 3. Tab: Envelope & Trend (Techniques 7~10)
  function renderTabEnvelope() {
    const s = getSeries();
    const envSpan = parseInt(document.getElementById('envelopeSpanSelect')?.value || 30, 10);
    const envData = SensorAlgorithms.peakEnvelope(s.tempRaw, envSpan);
    const pvData = SensorAlgorithms.detectPeaksAndValleys(s.tempRaw, 1.8, 20);
    const bBands = SensorAlgorithms.bollingerBands(s.tempRaw, 25, 2.0);
    const polyTrend = SensorAlgorithms.polynomialTrend(s.tempRaw, 2);

    // Main Envelope Chart
    const ctx1 = document.getElementById('envelopeChart')?.getContext('2d');
    if (ctx1) {
      if (chartInstances.envelopeChart) chartInstances.envelopeChart.destroy();

      // Peak point datasets for markers
      const peakPoints = new Array(s.timestamps.length).fill(null);
      pvData.peaks.forEach(p => { peakPoints[p.index] = p.value; });

      const valleyPoints = new Array(s.timestamps.length).fill(null);
      pvData.valleys.forEach(v => { valleyPoints[v.index] = v.value; });

      chartInstances.envelopeChart = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: s.timestamps,
          datasets: [
            {
              label: '상한 피크 포락선 (Upper Envelope)',
              data: envData.upper,
              borderColor: '#f87171',
              borderWidth: 1.8,
              borderDash: [4, 4],
              pointRadius: 0,
              fill: false
            },
            {
              label: '원시 온도 센서값',
              data: s.tempRaw,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.05)',
              borderWidth: 1.5,
              pointRadius: 0
            },
            {
              label: '하한 피크 포락선 (Lower Envelope)',
              data: envData.lower,
              borderColor: '#60a5fa',
              borderWidth: 1.8,
              borderDash: [4, 4],
              pointRadius: 0,
              fill: '-2', // fill between lower and upper
              backgroundColor: 'rgba(56, 189, 248, 0.04)'
            },
            {
              label: '검출된 과열 피크 (Prominent Peak)',
              data: peakPoints,
              borderColor: '#ef4444',
              backgroundColor: '#ef4444',
              pointRadius: 5,
              pointStyle: 'triangle',
              showLine: false
            },
            {
              label: '검출된 냉각 밸리 (Prominent Valley)',
              data: valleyPoints,
              borderColor: '#3b82f6',
              backgroundColor: '#3b82f6',
              pointRadius: 5,
              pointStyle: 'rectRot',
              showLine: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { color: '#cbd5e1' } },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) : '-'} °C`
              }
            }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 14 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { title: { display: true, text: '온도 (°C)', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // Sub-chart 1: Bollinger Bands
    const ctx2 = document.getElementById('bollingerChart')?.getContext('2d');
    if (ctx2) {
      if (chartInstances.bollingerChart) chartInstances.bollingerChart.destroy();
      chartInstances.bollingerChart = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: s.timestamps,
          datasets: [
            {
              label: '볼린저 상단 (+2σ)',
              data: bBands.upper,
              borderColor: '#a855f7',
              borderWidth: 1.2,
              pointRadius: 0
            },
            {
              label: '원시값',
              data: s.tempRaw,
              borderColor: '#e2e8f0',
              borderWidth: 1.2,
              pointRadius: 0
            },
            {
              label: '중심선 (SMA 20)',
              data: bBands.mid,
              borderColor: '#38bdf8',
              borderWidth: 1.5,
              pointRadius: 0
            },
            {
              label: '볼린저 하단 (-2σ)',
              data: bBands.lower,
              borderColor: '#a855f7',
              borderWidth: 1.2,
              pointRadius: 0,
              fill: '-3',
              backgroundColor: 'rgba(168, 85, 247, 0.08)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }

    // Sub-chart 2: Trend & Detrended Residuals
    const ctx3 = document.getElementById('trendResidualChart')?.getContext('2d');
    if (ctx3) {
      if (chartInstances.trendResidualChart) chartInstances.trendResidualChart.destroy();
      chartInstances.trendResidualChart = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: s.timestamps,
          datasets: [
            {
              label: '2차 기저 다항 추세선 (Trend)',
              data: polyTrend.trend,
              borderColor: '#ec4899',
              borderWidth: 2.2,
              pointRadius: 0
            },
            {
              label: '추세 제거 잔차 (Detrended Residual)',
              data: polyTrend.detrended,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 1,
              pointRadius: 0,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }

    // Envelope Span select listener
    document.getElementById('envelopeSpanSelect')?.addEventListener('change', () => renderTabEnvelope());
  }

  // 4. Tab: Anomaly & Fault Detection (Techniques 11~14)
  function renderTabAnomaly() {
    const s = getSeries();
    const hampelRes = SensorAlgorithms.hampelFilter(s.tempRaw, 21, 3.0);
    const modZRes = SensorAlgorithms.modifiedZScore(s.tempRaw, 3.5);
    const iqrRes = SensorAlgorithms.iqrOutliers(s.tempRaw, 1.5);
    const cusumRes = SensorAlgorithms.cusum(s.tempRaw, null, 0.5, 4.0);

    // Update anomaly counts
    document.getElementById('hampelCount').textContent = `${hampelRes.anomalies.length}건`;
    document.getElementById('modZCount').textContent = `${modZRes.anomalies.length}건`;
    document.getElementById('iqrCount').textContent = `${iqrRes.anomalies.length}건`;
    document.getElementById('cusumCount').textContent = `${cusumRes.alarms.length}개 구간`;

    // Chart 1: Hampel Cleaned Signal vs Detected Spikes
    const ctx1 = document.getElementById('hampelChart')?.getContext('2d');
    if (ctx1) {
      if (chartInstances.hampelChart) chartInstances.hampelChart.destroy();

      const spikePoints = new Array(s.timestamps.length).fill(null);
      hampelRes.anomalies.forEach(a => { spikePoints[a.index] = a.originalValue; });

      chartInstances.hampelChart = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: s.timestamps,
          datasets: [
            {
              label: 'Hampel 정제 신호 (스파이크 제거)',
              data: hampelRes.cleanSeries,
              borderColor: '#38bdf8',
              borderWidth: 1.8,
              pointRadius: 0
            },
            {
              label: '원본 센서값',
              data: s.tempRaw,
              borderColor: 'rgba(148, 163, 184, 0.35)',
              borderWidth: 1,
              pointRadius: 0
            },
            {
              label: '탐지된 스파이크 이상치 (Spike)',
              data: spikePoints,
              borderColor: '#ef4444',
              backgroundColor: '#ef4444',
              pointRadius: 6,
              pointStyle: 'circle',
              showLine: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 14 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { title: { display: true, text: '온도 (°C)', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // Chart 2: Modified Z-Score Time-series Bar Chart
    const ctx2 = document.getElementById('modZChart')?.getContext('2d');
    if (ctx2) {
      if (chartInstances.modZChart) chartInstances.modZChart.destroy();

      const barColors = modZRes.zScores.map(z => Math.abs(z) > 3.5 ? '#ef4444' : '#64748b');

      chartInstances.modZChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: s.timestamps,
          datasets: [{
            label: 'Modified Z-score',
            data: modZRes.zScores,
            backgroundColor: barColors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` Z-Score: ${ctx.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 }, grid: { display: false } },
            y: {
              title: { display: true, text: 'Z-Score (임계치 ±3.5)', color: '#94a3b8' },
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }

    // Chart 3: CUSUM Cumulative Sum Control Chart
    const ctx3 = document.getElementById('cusumChart')?.getContext('2d');
    if (ctx3) {
      if (chartInstances.cusumChart) chartInstances.cusumChart.destroy();

      chartInstances.cusumChart = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: s.timestamps,
          datasets: [
            {
              label: '양의 누적합 S+ (과열 누적)',
              data: cusumRes.sPos,
              borderColor: '#f87171',
              backgroundColor: 'rgba(248, 113, 113, 0.1)',
              borderWidth: 1.8,
              pointRadius: 0,
              fill: true
            },
            {
              label: '음의 누적합 S- (냉각 누적)',
              data: cusumRes.sNeg,
              borderColor: '#60a5fa',
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              borderWidth: 1.8,
              pointRadius: 0,
              fill: true
            },
            {
              label: `경보 한계선 (H = ${cusumRes.threshold.toFixed(2)})`,
              data: new Array(s.timestamps.length).fill(cusumRes.threshold),
              borderColor: '#fbbf24',
              borderWidth: 1.5,
              borderDash: [6, 6],
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 }, grid: { display: false } },
            y: { title: { display: true, text: '누적합 CUSUM', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }
  }

  // 5. Tab: Multivariate & Cross-Analysis (Techniques 15~18)
  function renderTabMultivariate() {
    const s = getSeries();
    const multiNorm = SensorAlgorithms.normalizeMulti({
      temp: s.tempRaw,
      vib: s.vibration,
      press: s.pressure
    });

    const corrData = SensorAlgorithms.correlationMatrix({
      '온도(원시)': s.tempRaw,
      '온도(참값)': s.tempTrue,
      '진동 RMS': s.vibration,
      '압력': s.pressure
    });

    const xcorrTempVib = SensorAlgorithms.crossCorrelationLag(s.vibration, s.tempRaw, 30);
    const mahalanobis = SensorAlgorithms.mahalanobisDistance({
      temp: s.tempRaw,
      vib: s.vibration,
      press: s.pressure
    });

    // Chart 1: Normalized Multi-Sensor Overlay
    const ctx1 = document.getElementById('multiNormChart')?.getContext('2d');
    if (ctx1) {
      if (chartInstances.multiNormChart) chartInstances.multiNormChart.destroy();
      chartInstances.multiNormChart = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: s.timestamps,
          datasets: [
            {
              label: '온도 정규화 (MinMax 0~1)',
              data: multiNorm.minMaxNormalized.temp,
              borderColor: '#f87171',
              borderWidth: 2,
              pointRadius: 0
            },
            {
              label: '진동 RMS 정규화 (MinMax 0~1)',
              data: multiNorm.minMaxNormalized.vib,
              borderColor: '#fbbf24',
              borderWidth: 1.8,
              pointRadius: 0
            },
            {
              label: '압력 정규화 (MinMax 0~1)',
              data: multiNorm.minMaxNormalized.press,
              borderColor: '#38bdf8',
              borderWidth: 1.8,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 14 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { title: { display: true, text: '정규화 진폭 (0 ~ 1)', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // Chart 2: Cross-Correlation Time-Lag
    const ctx2 = document.getElementById('crossCorrChart')?.getContext('2d');
    if (ctx2) {
      if (chartInstances.crossCorrChart) chartInstances.crossCorrChart.destroy();
      chartInstances.crossCorrChart = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: xcorrTempVib.lags.map(l => `${l > 0 ? '+' : ''}${l}분`),
          datasets: [{
            label: '진동 → 온도 교차상관계수 R(τ)',
            data: xcorrTempVib.correlations,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.15)',
            borderWidth: 2,
            pointRadius: 3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: '#cbd5e1' } },
            tooltip: {
              callbacks: {
                afterBody: () => `최대 상관 지연: ${xcorrTempVib.bestLag}분 (r = ${xcorrTempVib.maxCorr.toFixed(3)})`
              }
            }
          },
          scales: {
            x: { title: { display: true, text: '시차 지연 (Lag: 진동 선행 시간)', color: '#94a3b8' }, ticks: { color: '#94a3b8' } },
            y: { title: { display: true, text: '상관계수 R', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
      document.getElementById('bestLagInfo').textContent = 
        `진동 발생 후 온도 최고 반응 지연: 약 ${xcorrTempVib.bestLag}분 (최대 상관도 r = ${xcorrTempVib.maxCorr.toFixed(3)})`;
    }

    // Chart 3: Mahalanobis Distance Time-series
    const ctx3 = document.getElementById('mahalanobisChart')?.getContext('2d');
    if (ctx3) {
      if (chartInstances.mahalanobisChart) chartInstances.mahalanobisChart.destroy();
      chartInstances.mahalanobisChart = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: s.timestamps,
          datasets: [
            {
              label: '마할라노비스 거리 (다변량 이상 지수)',
              data: mahalanobis.distances,
              borderColor: '#f97316',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              borderWidth: 1.5,
              pointRadius: 0,
              fill: true
            },
            {
              label: `카이제곱 통계적 임계선 (${mahalanobis.threshold.toFixed(2)})`,
              data: new Array(s.timestamps.length).fill(mahalanobis.threshold),
              borderColor: '#ef4444',
              borderWidth: 1.5,
              borderDash: [6, 6],
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 }, grid: { display: false } },
            y: { title: { display: true, text: '마할라노비스 거리 D_M', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // Render Correlation Matrix Table
    renderCorrelationTable(corrData);
  }

  function renderCorrelationTable(corrData) {
    const tableEl = document.getElementById('corrMatrixTable');
    if (!tableEl) return;
    const keys = corrData.keys;

    let html = '<thead><tr><th>변수</th>';
    keys.forEach(k => { html += `<th>${k}</th>`; });
    html += '</tr></thead><tbody>';

    keys.forEach(k1 => {
      html += `<tr><td><strong>${k1}</strong></td>`;
      keys.forEach(k2 => {
        const val = corrData.pearson[k1][k2];
        const color = val > 0.7 ? '#38bdf8' : (val > 0.4 ? '#34d399' : '#94a3b8');
        html += `<td style="color:${color}; font-weight:700;">${val.toFixed(3)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
    tableEl.innerHTML = html;
  }

  // 6. Tab: Benchmark & Event Profiling (Techniques 19~20)
  function renderTabBenchmark() {
    const s = getSeries();

    // 5 Filter Candidates
    const filters = [
      { name: 'SMA (15분)', data: SensorAlgorithms.sma(s.tempRaw, 15) },
      { name: 'EMA (N=15)', data: SensorAlgorithms.ema(s.tempRaw, 15) },
      { name: 'Savitzky-Golay (W=15, p=2)', data: SensorAlgorithms.savitzkyGolay(s.tempRaw, 15, 2) },
      { name: 'Kalman (Q=0.02, R=0.8)', data: SensorAlgorithms.kalmanFilter(s.tempRaw, 0.02, 0.8).estimate },
      { name: 'Hampel + SMA 복합', data: SensorAlgorithms.sma(SensorAlgorithms.hampelFilter(s.tempRaw, 21, 3.0).cleanSeries, 11) }
    ];

    const benchmarkResults = filters.map(f => {
      const p = SensorAlgorithms.evaluatePerformance(s.tempRaw, s.tempTrue, f.data);
      return { name: f.name, ...p };
    });

    // Render Benchmark Chart
    const ctx1 = document.getElementById('benchmarkBarChart')?.getContext('2d');
    if (ctx1) {
      if (chartInstances.benchmarkBarChart) chartInstances.benchmarkBarChart.destroy();
      chartInstances.benchmarkBarChart = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: benchmarkResults.map(r => r.name),
          datasets: [
            {
              label: 'MAE 오차 (°C, 낮을수록 우수)',
              data: benchmarkResults.map(r => r.mae),
              backgroundColor: '#38bdf8',
              borderRadius: 6
            },
            {
              label: 'RMSE 오차 (°C, 낮을수록 우수)',
              data: benchmarkResults.map(r => r.rmse),
              backgroundColor: '#818cf8',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#cbd5e1' }, grid: { display: false } },
            y: { title: { display: true, text: '오차 (°C)', color: '#94a3b8' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // Render Event Profiles (Radar & Table)
    const profiles = SensorAlgorithms.profileEvents(dataset);
    renderEventRadar(profiles);
    renderEventTable(profiles);
  }

  function renderEventRadar(profiles) {
    const ctx = document.getElementById('eventRadarChart')?.getContext('2d');
    if (!ctx) return;
    if (chartInstances.eventRadarChart) chartInstances.eventRadarChart.destroy();

    const eventsToRadar = ['정상', '부하 증가', '단기 과열', '급격한 과열', '장시간 부하', '일시 냉각'];
    const colors = ['#10b981', '#38bdf8', '#fbbf24', '#ef4444', '#c084fc', '#60a5fa'];

    const datasets = eventsToRadar.map((ev, idx) => {
      const p = profiles[ev];
      // Normalize values roughly: Temp / 40, Vib / 3, Press / 105
      return {
        label: ev,
        data: [
          (p.tempMean / 40) * 100,
          (p.tempStd / 2) * 100,
          (p.vibMean / 3) * 100,
          (p.pressMean / 105) * 100,
          (p.count / 1440) * 100 * 5 // Scaled duration
        ],
        borderColor: colors[idx],
        backgroundColor: colors[idx] + '22',
        borderWidth: 2,
        pointRadius: 3
      };
    });

    chartInstances.eventRadarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['평균 온도', '온도 변동폭(Std)', '평균 진동 RMS', '평균 압력', '지속 비중'],
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#cbd5e1' } } },
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: { color: '#cbd5e1', font: { size: 11, weight: 'bold' } },
            ticks: { display: false }
          }
        }
      }
    });
  }

  function renderEventTable(profiles) {
    const tableEl = document.getElementById('eventProfileTable');
    if (!tableEl) return;

    let html = `<thead><tr>
      <th>운전 상태 (이벤트)</th>
      <th>발생 누적(분)</th>
      <th>평균 온도(°C)</th>
      <th>온도 범위</th>
      <th>진동 RMS (mm/s)</th>
      <th>압력 (kPa)</th>
    </tr></thead><tbody>`;

    Object.keys(profiles).forEach(ev => {
      const p = profiles[ev];
      html += `<tr>
        <td><strong>${ev}</strong></td>
        <td>${p.count}분</td>
        <td>${p.tempMean.toFixed(2)} ± ${p.tempStd.toFixed(2)}</td>
        <td>${p.tempMin.toFixed(1)} ~ ${p.tempMax.toFixed(1)}</td>
        <td>${p.vibMean.toFixed(2)}</td>
        <td>${p.pressMean.toFixed(2)}</td>
      </tr>`;
    });
    html += '</tbody>';
    tableEl.innerHTML = html;
  }

  // File Upload Drag & Drop Support
  function setupFileLoader() {
    const dropArea = document.getElementById('fileDropArea');
    const fileInput = document.getElementById('fileInput');

    if (!dropArea || !fileInput) return;

    dropArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });

    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.style.borderColor = 'var(--accent-primary)';
    });

    dropArea.addEventListener('dragleave', () => {
      dropArea.style.borderColor = 'var(--border-color)';
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.style.borderColor = 'var(--border-color)';
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const text = evt.target.result;
        // Check if JSON
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            dataset = parsed;
            initDashboard();
            alert(`성공: ${parsed.length}개 행의 데이터를 성공적으로 로드했습니다!`);
          }
        } else if (file.name.endsWith('.csv')) {
          // Simple CSV parser
          const lines = text.trim().split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const newRows = [];
          for (let i = 1; i < lines.length; i++) {
            const rowVals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (rowVals.length === headers.length) {
              const rowObj = {
                timestamp: rowVals[0] || `00:${i}`,
                minute: i - 1,
                hour: ((i - 1) / 60).toFixed(2),
                temp_raw: parseFloat(rowVals[3] || rowVals[1]),
                temp_true: parseFloat(rowVals[4] || rowVals[2] || rowVals[1]),
                vibration_rms: parseFloat(rowVals[5] || rowVals[3] || 1.0),
                pressure: parseFloat(rowVals[6] || rowVals[4] || 101.3),
                event: rowVals[7] || '정상'
              };
              newRows.push(rowObj);
            }
          }
          if (newRows.length > 0) {
            dataset = newRows;
            initDashboard();
            alert(`성공: CSV에서 ${newRows.length}개 행을 파싱하여 로드했습니다!`);
          }
        }
      } catch (err) {
        alert('파일 파싱 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // DOM Content Loaded
  window.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setupFileLoader();
  });

})();
