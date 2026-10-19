/**
 * 20 Advanced Time-Series & Sensor Data Analysis Algorithms
 * Pure JavaScript, Client-side execution without external dependencies
 */

const SensorAlgorithms = (function() {
  'use strict';

  // Helper: Mean
  function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
  }

  // Helper: Standard Deviation
  function std(arr, ddof = 1) {
    if (!arr || arr.length <= ddof) return 0;
    const m = mean(arr);
    let sumSq = 0;
    for (let i = 0; i < arr.length; i++) {
      const d = arr[i] - m;
      sumSq += d * d;
    }
    return Math.sqrt(sumSq / (arr.length - ddof));
  }

  // Helper: Median
  function median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Helper: Median Absolute Deviation (MAD)
  function mad(arr) {
    const med = median(arr);
    const diffs = arr.map(x => Math.abs(x - med));
    return median(diffs);
  }

  // 1. Simple Moving Average (SMA)
  function sma(series, windowSize = 15) {
    const n = series.length;
    const result = new Array(n);
    const half = Math.floor(windowSize / 2);
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - half);
      const end = Math.min(n, i + half + 1);
      let sum = 0;
      for (let j = start; j < end; j++) sum += series[j];
      result[i] = sum / (end - start);
    }
    return result;
  }

  // 2. Exponential Moving Average (EMA)
  function ema(series, period = 15) {
    const n = series.length;
    const result = new Array(n);
    const alpha = 2 / (period + 1);
    result[0] = series[0];
    for (let i = 1; i < n; i++) {
      result[i] = alpha * series[i] + (1 - alpha) * result[i - 1];
    }
    return result;
  }

  // 3. Weighted Moving Average (WMA)
  function wma(series, windowSize = 15) {
    const n = series.length;
    const result = new Array(n);
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - windowSize + 1);
      let weightSum = 0;
      let valSum = 0;
      for (let j = start; j <= i; j++) {
        const w = (j - start + 1);
        valSum += series[j] * w;
        weightSum += w;
      }
      result[i] = valSum / weightSum;
    }
    return result;
  }

  // 4. Savitzky-Golay Filter (Quadratic/Cubic polynomial convolution)
  function savitzkyGolay(series, windowSize = 15, polyOrder = 2) {
    // Ensure windowSize is odd
    let w = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
    if (w < 5) w = 5;
    const m = Math.floor(w / 2);
    const n = series.length;
    const result = new Array(n);

    // Compute Vandermonde matrix and projection weights: W = (A^T A)^(-1) A^T
    // For quadratic (polyOrder 2 or 3), central row coefficients:
    // Gram polynomials approach
    const A = [];
    for (let i = -m; i <= m; i++) {
      const row = [];
      for (let p = 0; p <= polyOrder; p++) {
        row.push(Math.pow(i, p));
      }
      A.push(row);
    }
    // Compute A^T * A (size: (order+1) x (order+1))
    const pLen = polyOrder + 1;
    const ATA = Array.from({ length: pLen }, () => new Array(pLen).fill(0));
    for (let r = 0; r < pLen; r++) {
      for (let c = 0; c < pLen; c++) {
        for (let i = 0; i < w; i++) {
          ATA[r][c] += A[i][r] * A[i][c];
        }
      }
    }
    // Invert ATA (small 3x3 or 4x4, gaussian elimination)
    const invATA = invertSmallMatrix(ATA);
    // Convolution weights for central point (row 0 of invATA * A^T)
    const weights = new Array(w).fill(0);
    for (let i = 0; i < w; i++) {
      for (let p = 0; p < pLen; p++) {
        weights[i] += invATA[0][p] * A[i][p];
      }
    }

    // Apply convolution with symmetric reflection at boundaries
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -m; k <= m; k++) {
        let idx = i + k;
        if (idx < 0) idx = -idx;
        else if (idx >= n) idx = 2 * n - idx - 2;
        if (idx >= 0 && idx < n) {
          sum += series[idx] * weights[k + m];
        } else {
          sum += series[i] * weights[k + m];
        }
      }
      result[i] = sum;
    }
    return result;
  }

  // Matrix inverter for small square matrices
  function invertSmallMatrix(M) {
    const n = M.length;
    const A = M.map(row => [...row]);
    const I = Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0);
      row[i] = 1;
      return row;
    });

    for (let i = 0; i < n; i++) {
      let pivot = A[i][i];
      if (Math.abs(pivot) < 1e-12) {
        // find swap row
        for (let j = i + 1; j < n; j++) {
          if (Math.abs(A[j][i]) > 1e-12) {
            [A[i], A[j]] = [A[j], A[i]];
            [I[i], I[j]] = [I[j], I[i]];
            pivot = A[i][i];
            break;
          }
        }
      }
      for (let j = 0; j < n; j++) {
        A[i][j] /= pivot;
        I[i][j] /= pivot;
      }
      for (let r = 0; r < n; r++) {
        if (r !== i) {
          const factor = A[r][i];
          for (let c = 0; c < n; c++) {
            A[r][c] -= factor * A[i][c];
            I[r][c] -= factor * I[i][c];
          }
        }
      }
    }
    return I;
  }

  // 5. 1D Kalman Filter
  function kalmanFilter(series, Q = 0.02, R = 0.8) {
    const n = series.length;
    const estimate = new Array(n);
    const errorCovariance = new Array(n);

    let x = series[0];
    let P = 1.0;

    for (let k = 0; k < n; k++) {
      // Prediction step
      const x_pred = x;
      const P_pred = P + Q;

      // Update step
      const K = P_pred / (P_pred + R);
      x = x_pred + K * (series[k] - x_pred);
      P = (1 - K) * P_pred;

      estimate[k] = x;
      errorCovariance[k] = P;
    }
    return { estimate, errorCovariance };
  }

  // 6. Median Filter
  function medianFilter(series, windowSize = 9) {
    let w = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
    const m = Math.floor(w / 2);
    const n = series.length;
    const result = new Array(n);

    for (let i = 0; i < n; i++) {
      const windowVals = [];
      for (let k = -m; k <= m; k++) {
        const idx = Math.min(Math.max(0, i + k), n - 1);
        windowVals.push(series[idx]);
      }
      result[i] = median(windowVals);
    }
    return result;
  }

  // 7. Peak Envelope (Upper and Lower Envelopes)
  function peakEnvelope(series, windowSpan = 30) {
    const n = series.length;
    const upperPeaks = [];
    const lowerValleys = [];

    // Find local maxima and minima within windowSpan
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - windowSpan);
      const end = Math.min(n, i + windowSpan + 1);
      let isMax = true;
      let isMin = true;
      for (let j = start; j < end; j++) {
        if (j !== i) {
          if (series[j] > series[i]) isMax = false;
          if (series[j] < series[i]) isMin = false;
        }
      }
      if (isMax) upperPeaks.push({ x: i, y: series[i] });
      if (isMin) lowerValleys.push({ x: i, y: series[i] });
    }

    // Always anchor ends
    if (upperPeaks.length === 0 || upperPeaks[0].x !== 0) upperPeaks.unshift({ x: 0, y: series[0] });
    if (upperPeaks[upperPeaks.length - 1].x !== n - 1) upperPeaks.push({ x: n - 1, y: series[n - 1] });
    if (lowerValleys.length === 0 || lowerValleys[0].x !== 0) lowerValleys.unshift({ x: 0, y: series[0] });
    if (lowerValleys[lowerValleys.length - 1].x !== n - 1) lowerValleys.push({ x: n - 1, y: series[n - 1] });

    // Linear/smooth interpolation for envelopes
    function interpolate(points) {
      const curve = new Array(n);
      let pIdx = 0;
      for (let i = 0; i < n; i++) {
        while (pIdx < points.length - 1 && points[pIdx + 1].x < i) {
          pIdx++;
        }
        if (pIdx >= points.length - 1) {
          curve[i] = points[points.length - 1].y;
        } else {
          const p0 = points[pIdx];
          const p1 = points[pIdx + 1];
          const t = (i - p0.x) / (p1.x - p0.x);
          curve[i] = p0.y + t * (p1.y - p0.y);
        }
      }
      return curve;
    }

    return {
      upper: interpolate(upperPeaks),
      lower: interpolate(lowerValleys),
      peaks: upperPeaks,
      valleys: lowerValleys
    };
  }

  // 8. Prominence-based Peak and Valley Detection
  function detectPeaksAndValleys(series, thresholdStd = 1.8, minDistance = 20) {
    const n = series.length;
    const m = mean(series);
    const s = std(series);
    const peaks = [];
    const valleys = [];

    for (let i = 1; i < n - 1; i++) {
      // Local peak
      if (series[i] > series[i - 1] && series[i] > series[i + 1]) {
        if (series[i] > m + thresholdStd * s) {
          if (peaks.length === 0 || (i - peaks[peaks.length - 1].index) >= minDistance) {
            peaks.push({ index: i, value: series[i], type: 'peak' });
          }
        }
      }
      // Local valley
      if (series[i] < series[i - 1] && series[i] < series[i + 1]) {
        if (series[i] < m - thresholdStd * s) {
          if (valleys.length === 0 || (i - valleys[valleys.length - 1].index) >= minDistance) {
            valleys.push({ index: i, value: series[i], type: 'valley' });
          }
        }
      }
    }
    return { peaks, valleys };
  }

  // 9. Polynomial Trend Decomposition & Detrending
  function polynomialTrend(series, degree = 2) {
    const n = series.length;
    const x = Array.from({ length: n }, (_, i) => i);
    // Fit polynomial using least squares
    const pLen = degree + 1;
    const ATA = Array.from({ length: pLen }, () => new Array(pLen).fill(0));
    const ATY = new Array(pLen).fill(0);

    for (let i = 0; i < n; i++) {
      const xi = x[i] / n; // normalize x to avoid numeric overflow
      const yi = series[i];
      for (let r = 0; r < pLen; r++) {
        const xr = Math.pow(xi, r);
        ATY[r] += xr * yi;
        for (let c = 0; c < pLen; c++) {
          ATA[r][c] += xr * Math.pow(xi, c);
        }
      }
    }

    const invATA = invertSmallMatrix(ATA);
    const coeffs = new Array(pLen).fill(0);
    for (let r = 0; r < pLen; r++) {
      for (let c = 0; c < pLen; c++) {
        coeffs[r] += invATA[r][c] * ATY[c];
      }
    }

    const trend = new Array(n);
    const detrended = new Array(n);
    for (let i = 0; i < n; i++) {
      const xi = i / n;
      let yHat = 0;
      for (let p = 0; p < pLen; p++) {
        yHat += coeffs[p] * Math.pow(xi, p);
      }
      trend[i] = yHat;
      detrended[i] = series[i] - yHat;
    }

    return { trend, detrended, coeffs };
  }

  // 10. Bollinger Bands
  function bollingerBands(series, period = 20, k = 2.0) {
    const n = series.length;
    const mid = sma(series, period);
    const upper = new Array(n);
    const lower = new Array(n);
    const breaches = [];
    const half = Math.floor(period / 2);

    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - half);
      const end = Math.min(n, i + half + 1);
      const windowVals = series.slice(start, end);
      const s = std(windowVals);
      upper[i] = mid[i] + k * s;
      lower[i] = mid[i] - k * s;

      if (series[i] > upper[i]) breaches.push({ index: i, type: 'upper', value: series[i] });
      else if (series[i] < lower[i]) breaches.push({ index: i, type: 'lower', value: series[i] });
    }
    return { mid, upper, lower, breaches };
  }

  // 11. Hampel Filter (Robust Anomaly Detection)
  function hampelFilter(series, windowSize = 21, thresholdFactor = 3.0) {
    let w = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
    const m = Math.floor(w / 2);
    const n = series.length;
    const cleanSeries = [...series];
    const anomalies = [];

    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - m);
      const end = Math.min(n, i + m + 1);
      const windowVals = series.slice(start, end);
      const med = median(windowVals);
      const diffs = windowVals.map(x => Math.abs(x - med));
      const windowMad = median(diffs);
      const threshold = thresholdFactor * 1.4826 * windowMad;

      if (Math.abs(series[i] - med) > threshold && windowMad > 1e-6) {
        anomalies.push({ index: i, originalValue: series[i], replacement: med });
        cleanSeries[i] = med;
      }
    }
    return { cleanSeries, anomalies };
  }

  // 12. Modified Z-Score (Iglewicz and Hoaglin)
  function modifiedZScore(series, threshold = 3.5) {
    const med = median(series);
    const diffs = series.map(x => Math.abs(x - med));
    const m = median(diffs);
    const zScores = new Array(series.length);
    const anomalies = [];

    const denom = 1.4826 * m;
    for (let i = 0; i < series.length; i++) {
      const z = denom > 1e-6 ? (series[i] - med) / denom : 0;
      zScores[i] = z;
      if (Math.abs(z) > threshold) {
        anomalies.push({ index: i, value: series[i], zScore: z });
      }
    }
    return { zScores, anomalies, threshold };
  }

  // 13. IQR Boxplot Outlier Detection
  function iqrOutliers(series, factor = 1.5) {
    const sorted = [...series].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerFence = q1 - factor * iqr;
    const upperFence = q3 + factor * iqr;

    const anomalies = [];
    for (let i = 0; i < series.length; i++) {
      if (series[i] < lowerFence || series[i] > upperFence) {
        anomalies.push({ index: i, value: series[i], fence: series[i] < lowerFence ? 'lower' : 'upper' });
      }
    }
    return { q1, q3, iqr, lowerFence, upperFence, anomalies };
  }

  // 14. CUSUM (Cumulative Sum Control Chart)
  function cusum(series, target = null, allowance = 0.5, decisionH = 4.0) {
    const n = series.length;
    const m = target !== null ? target : mean(series);
    const s = std(series);
    const k = allowance * s;
    const h = decisionH * s;

    const sPos = new Array(n).fill(0);
    const sNeg = new Array(n).fill(0);
    const alarms = [];

    for (let i = 1; i < n; i++) {
      sPos[i] = Math.max(0, sPos[i - 1] + (series[i] - m) - k);
      sNeg[i] = Math.max(0, sNeg[i - 1] - (series[i] - m) - k);

      if (sPos[i] > h || sNeg[i] > h) {
        alarms.push({
          index: i,
          type: sPos[i] > h ? 'positive_shift' : 'negative_shift',
          sPos: sPos[i],
          sNeg: sNeg[i]
        });
      }
    }
    return { sPos, sNeg, threshold: h, alarms };
  }

  // 15. Multi-Sensor Normalization (MinMax & Z-Score)
  function normalizeMulti(sensors) {
    const keys = Object.keys(sensors);
    const minMaxNormalized = {};
    const zScoreNormalized = {};

    keys.forEach(k => {
      const arr = sensors[k];
      const minVal = Math.min(...arr);
      const maxVal = Math.max(...arr);
      const range = maxVal - minVal || 1;
      minMaxNormalized[k] = arr.map(v => (v - minVal) / range);

      const m = mean(arr);
      const s = std(arr) || 1;
      zScoreNormalized[k] = arr.map(v => (v - m) / s);
    });

    return { minMaxNormalized, zScoreNormalized };
  }

  // 16. Pearson & Spearman Correlation Matrix
  function correlationMatrix(variables) {
    const keys = Object.keys(variables);
    const n = variables[keys[0]].length;
    const pearson = {};
    const spearman = {};

    keys.forEach(k1 => {
      pearson[k1] = {};
      spearman[k1] = {};
    });

    // Helper for rank array
    function getRanks(arr) {
      const indexed = arr.map((val, idx) => ({ val, idx }));
      indexed.sort((a, b) => a.val - b.val);
      const ranks = new Array(arr.length);
      for (let i = 0; i < indexed.length; i++) {
        ranks[indexed[i].idx] = i + 1;
      }
      return ranks;
    }

    const ranksMap = {};
    keys.forEach(k => { ranksMap[k] = getRanks(variables[k]); });

    for (let i = 0; i < keys.length; i++) {
      const k1 = keys[i];
      for (let j = 0; j < keys.length; j++) {
        const k2 = keys[j];
        if (i === j) {
          pearson[k1][k2] = 1.0;
          spearman[k1][k2] = 1.0;
        } else {
          // Pearson
          const m1 = mean(variables[k1]);
          const m2 = mean(variables[k2]);
          let num = 0, d1 = 0, d2 = 0;
          for (let p = 0; p < n; p++) {
            const diff1 = variables[k1][p] - m1;
            const diff2 = variables[k2][p] - m2;
            num += diff1 * diff2;
            d1 += diff1 * diff1;
            d2 += diff2 * diff2;
          }
          const pCorr = num / Math.sqrt(d1 * d2);
          pearson[k1][k2] = pCorr;

          // Spearman
          const rm1 = (n + 1) / 2;
          let sNum = 0, sd1 = 0, sd2 = 0;
          for (let p = 0; p < n; p++) {
            const diff1 = ranksMap[k1][p] - rm1;
            const diff2 = ranksMap[k2][p] - rm1;
            sNum += diff1 * diff2;
            sd1 += diff1 * diff1;
            sd2 += diff2 * diff2;
          }
          spearman[k1][k2] = sNum / Math.sqrt(sd1 * sd2);
        }
      }
    }
    return { keys, pearson, spearman };
  }

  // 17. Cross-Correlation & Time-Lag Analysis
  function crossCorrelationLag(xSeries, ySeries, maxLag = 30) {
    const n = xSeries.length;
    const mx = mean(xSeries);
    const my = mean(ySeries);
    const sx = std(xSeries);
    const sy = std(ySeries);

    const lags = [];
    const correlations = [];
    let bestLag = 0;
    let maxCorr = -1;

    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < n; i++) {
        const j = i + lag;
        if (j >= 0 && j < n) {
          sum += (xSeries[i] - mx) * (ySeries[j] - my);
          count++;
        }
      }
      const r = count > 0 ? (sum / (count * sx * sy)) : 0;
      lags.push(lag);
      correlations.push(r);
      if (Math.abs(r) > maxCorr) {
        maxCorr = Math.abs(r);
        bestLag = lag;
      }
    }
    return { lags, correlations, bestLag, maxCorr };
  }

  // 18. Mahalanobis Distance (Multivariate Outlier Scoring)
  function mahalanobisDistance(seriesObj) {
    const keys = Object.keys(seriesObj);
    const numVars = keys.length;
    const n = seriesObj[keys[0]].length;

    // Means
    const means = keys.map(k => mean(seriesObj[k]));

    // Covariance Matrix
    const cov = Array.from({ length: numVars }, () => new Array(numVars).fill(0));
    for (let i = 0; i < numVars; i++) {
      for (let j = 0; j < numVars; j++) {
        let sum = 0;
        for (let p = 0; p < n; p++) {
          sum += (seriesObj[keys[i]][p] - means[i]) * (seriesObj[keys[j]][p] - means[j]);
        }
        cov[i][j] = sum / (n - 1);
      }
    }

    const invCov = invertSmallMatrix(cov);
    const distances = new Array(n);
    const thresholdChiSq = 7.815; // Chi-Square with 3 df at p = 0.05
    const anomalies = [];

    for (let p = 0; p < n; p++) {
      const diff = keys.map((k, idx) => seriesObj[k][p] - means[idx]);
      let distSq = 0;
      for (let i = 0; i < numVars; i++) {
        let dot = 0;
        for (let j = 0; j < numVars; j++) {
          dot += diff[j] * invCov[j][i];
        }
        distSq += diff[i] * dot;
      }
      const dist = Math.sqrt(Math.max(0, distSq));
      distances[p] = dist;
      if (distSq > thresholdChiSq) {
        anomalies.push({ index: p, distance: dist });
      }
    }
    return { distances, threshold: Math.sqrt(thresholdChiSq), anomalies };
  }

  // 19. Evaluation Metrics (MAE, RMSE, MAPE, SNR, Peak Attenuation)
  function evaluatePerformance(raw, trueSignal, filtered) {
    const n = raw.length;
    let sumAbsErr = 0;
    let sumSqErr = 0;
    let sumPctErr = 0;
    let noiseVarSum = 0;
    let trueVarSum = 0;
    const trueMean = mean(trueSignal);

    for (let i = 0; i < n; i++) {
      const err = filtered[i] - trueSignal[i];
      sumAbsErr += Math.abs(err);
      sumSqErr += err * err;
      sumPctErr += Math.abs(err / (trueSignal[i] || 1));
      noiseVarSum += err * err;
      const tDiff = trueSignal[i] - trueMean;
      trueVarSum += tDiff * tDiff;
    }

    const mae = sumAbsErr / n;
    const rmse = Math.sqrt(sumSqErr / n);
    const mape = (sumPctErr / n) * 100;
    const snr = 10 * Math.log10((trueVarSum / n) / ((noiseVarSum / n) || 1e-6));

    // Peak attenuation: compare max values
    const trueMax = Math.max(...trueSignal);
    const filtMax = Math.max(...filtered);
    const peakRetention = (filtMax / trueMax) * 100;

    return { mae, rmse, mape, snr, peakRetention };
  }

  // 20. Operating State Profiling
  function profileEvents(dataset) {
    const groups = {};
    dataset.forEach(row => {
      const ev = row.event;
      if (!groups[ev]) groups[ev] = [];
      groups[ev].push(row);
    });

    const profiles = {};
    Object.keys(groups).forEach(ev => {
      const rows = groups[ev];
      const temps = rows.map(r => r.temp_raw);
      const vibs = rows.map(r => r.vibration_rms);
      const press = rows.map(r => r.pressure);

      profiles[ev] = {
        count: rows.length,
        durationMinutes: rows.length,
        tempMean: mean(temps),
        tempStd: std(temps),
        tempMin: Math.min(...temps),
        tempMax: Math.max(...temps),
        vibMean: mean(vibs),
        vibStd: std(vibs),
        vibMin: Math.min(...vibs),
        vibMax: Math.max(...vibs),
        pressMean: mean(press),
        pressStd: std(press),
        pressMin: Math.min(...press),
        pressMax: Math.max(...press)
      };
    });
    return profiles;
  }

  return {
    mean, std, median, mad,
    sma, ema, wma, savitzkyGolay, kalmanFilter, medianFilter,
    peakEnvelope, detectPeaksAndValleys, polynomialTrend, bollingerBands,
    hampelFilter, modifiedZScore, iqrOutliers, cusum,
    normalizeMulti, correlationMatrix, crossCorrelationLag, mahalanobisDistance,
    evaluatePerformance, profileEvents
  };
})();
