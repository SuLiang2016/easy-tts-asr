"use client";

import { Select, Label } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { FEATURED_VOICES, FUN_VOICES } from "@/lib/voices";

/**
 * 音色选择 + 语速/音量/音调滑杆。
 * TTS 与换声页共用；范围 0.5–2.0 与火山接口实际支持范围对齐
 * （speed/volume 线性映射 speech_rate/loudness_rate，pitch 映射 ±12 半音）。
 */
export const EFFECT_MIN = 0.5;
export const EFFECT_MAX = 2.0;
export const EFFECT_STEP = 0.1;

interface VoiceControlsProps {
  voiceType: string;
  onVoiceChange: (value: string) => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  pitch: number;
  onPitchChange: (value: number) => void;
}

export function VoiceControls({
  voiceType,
  onVoiceChange,
  speed,
  onSpeedChange,
  volume,
  onVolumeChange,
  pitch,
  onPitchChange,
}: VoiceControlsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>选择音色</Label>
        <Select value={voiceType} onChange={(e) => onVoiceChange(e.target.value)}>
          <optgroup label="精品音色">
            {FEATURED_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} - {voice.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="特色/恶搞音色">
            {FUN_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} - {voice.description}
              </option>
            ))}
          </optgroup>
        </Select>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Slider
          label="语速"
          valueDisplay={`${speed.toFixed(1)}x`}
          min={EFFECT_MIN}
          max={EFFECT_MAX}
          step={EFFECT_STEP}
          value={speed}
          ariaValuetext={`${speed.toFixed(1)} 倍速`}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
        />
        <Slider
          label="音量"
          valueDisplay={volume.toFixed(1)}
          min={EFFECT_MIN}
          max={EFFECT_MAX}
          step={EFFECT_STEP}
          value={volume}
          ariaValuetext={`${volume.toFixed(1)} 倍音量`}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        />
        <Slider
          label="音调"
          valueDisplay={pitch.toFixed(1)}
          min={EFFECT_MIN}
          max={EFFECT_MAX}
          step={EFFECT_STEP}
          value={pitch}
          ariaValuetext={`${pitch.toFixed(1)} 倍音调`}
          onChange={(e) => onPitchChange(parseFloat(e.target.value))}
        />
      </div>
    </>
  );
}
