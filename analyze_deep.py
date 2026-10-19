import sys
sys.stdout.reconfigure(encoding='utf-8')
import pandas as pd
import numpy as np
import json

df = pd.read_excel('센서 스무딩.xlsx', sheet_name='센서_시계열')
cols = ['timestamp', 'minute', 'hour', 'temp_raw', 'temp_true', 'vibration_rms', 'pressure', 'event']
df.columns = cols

print("=== 1. Summary Statistics ===")
print(df[['temp_raw', 'temp_true', 'vibration_rms', 'pressure']].describe())

print("\n=== 2. Event Breakdown ===")
event_stats = {}
for ev, group in df.groupby('event'):
    event_stats[ev] = {
        'count': int(len(group)),
        'minute_min': int(group['minute'].min()),
        'minute_max': int(group['minute'].max()),
        'time_ranges': [],
        'temp_raw_mean': round(float(group['temp_raw'].mean()), 3),
        'temp_raw_std': round(float(group['temp_raw'].std()), 3),
        'temp_true_mean': round(float(group['temp_true'].mean()), 3),
        'vib_mean': round(float(group['vibration_rms'].mean()), 3),
        'press_mean': round(float(group['pressure'].mean()), 3),
    }

# Detect continuous event intervals
df['event_change'] = (df['event'] != df['event'].shift()).cumsum()
for change_id, group in df.groupby('event_change'):
    ev_name = group['event'].iloc[0]
    m_start = int(group['minute'].iloc[0])
    m_end = int(group['minute'].iloc[-1])
    t_start = str(group['timestamp'].iloc[0])[:19]
    t_end = str(group['timestamp'].iloc[-1])[:19]
    event_stats[ev_name]['time_ranges'].append({
        'start_min': m_start,
        'end_min': m_end,
        'duration_min': m_end - m_start + 1,
        'start_time': t_start,
        'end_time': t_end
    })

print(json.dumps(event_stats, ensure_ascii=False, indent=2))

print("\n=== 3. Correlation Matrix ===")
corr = df[['temp_raw', 'temp_true', 'vibration_rms', 'pressure']].corr()
print(corr.to_dict())

print("\n=== 4. Noise & Error Metrics ===")
noise = df['temp_raw'] - df['temp_true']
mae = float(noise.abs().mean())
rmse = float(np.sqrt((noise**2).mean()))
snr = float(10 * np.log10(df['temp_true'].var() / noise.var()))
print(f"Noise mean: {noise.mean():.4f}, std: {noise.std():.4f}")
print(f"Raw vs True MAE: {mae:.4f}, RMSE: {rmse:.4f}, SNR: {snr:.2f} dB")

# Save stats to json for commentary
summary = {
    'event_stats': event_stats,
    'correlation': corr.to_dict(),
    'noise_metrics': {
        'mean': round(float(noise.mean()), 4),
        'std': round(float(noise.std()), 4),
        'mae': round(mae, 4),
        'rmse': round(rmse, 4),
        'snr_db': round(snr, 2)
    }
}
with open('data_summary.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
print("\nSaved data_summary.json successfully.")
