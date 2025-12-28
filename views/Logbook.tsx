import React, { useState } from 'react';
import { WorkoutLog, AppData, WorkoutSet, MovementEffectArea } from '../types';
import { Button } from '../components/Button';
import { Download, Calendar, Activity, ChevronDown, ChevronRight, Clock, Timer, X, Dumbbell, Target, Trash2, Move, Package } from 'lucide-react';
import { MediaButtons } from './ActiveWorkout';

// Etki Alanları tanımları
const EFFECT_AREAS: { key: MovementEffectArea; label: string; emoji: string }[] = [
  { key: 'stretching', label: 'Açma', emoji: '🔓' },
  { key: 'balance', label: 'Denge', emoji: '⚖️' },
  { key: 'breathing', label: 'Nefes', emoji: '🌬️' },
  { key: 'strength', label: 'Kas Kuvvet', emoji: '💪' },
  { key: 'cardio', label: 'Kardiyo', emoji: '❤️' },
  { key: 'flexibility', label: 'Germe', emoji: '🧘' },
];

interface LogbookProps {
  data: AppData;
  onDeleteLog?: (logId: string) => void;
}

export const LogbookView: React.FC<LogbookProps> = ({ data, onDeleteLog }) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set());

  const sortedLogs = [...data.logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getExerciseDef = (id: string) => {
    return data.exercises.find(e => e.id === id);
  };

  const toggleLog = (id: string) => {
    if (expandedLogId === id) {
      setExpandedLogId(null);
      setExpandedExercises(new Set());
      setExpandedMovements(new Set());
    } else {
      setExpandedLogId(id);
    }
  };

  const toggleExercise = (logId: string, exerciseIdx: number) => {
    const key = `${logId}-${exerciseIdx}`;
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleMovement = (key: string) => {
    setExpandedMovements(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatSetDisplay = (set: WorkoutSet) => {
    const parts = [];
    if (set.weight) parts.push(`${set.weight}kg`);
    if (set.reps) parts.push(`${set.reps} tekrar`);
    if (set.timeSeconds) {
      const mins = Math.floor(set.timeSeconds / 60);
      const secs = set.timeSeconds % 60;
      parts.push(`${mins > 0 ? `${mins}dk ` : ''}${secs}sn`);
    }
    return parts.length > 0 ? parts.join(' x ') : (set.completed ? 'Tamamlandı' : '');
  };

  const formatTimeDetailed = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} sn`;
    if (secs === 0) return `${mins} dk`;
    return `${mins} dk ${secs} sn`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}sa ${m}dk`;
    return `${m}dk ${s}sn`;
  };

  const formatTimeRange = (start?: string, end?: string) => {
    if (!start) return '';
    const s = new Date(start);
    const sStr = s.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (end) {
      const e = new Date(end);
      const eStr = e.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return `${sStr} - ${eStr}`;
    }
    return sStr;
  };

  const handleDownloadHtml = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Antrenman Kayıtları - FitLog Pro</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { border-bottom: 2px solid #22c55e; padding-bottom: 10px; }
          .log-entry { background: #f9f9f9; border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
          .log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .log-date { font-weight: bold; color: #555; }
          .log-routine { font-size: 1.2em; color: #16a34a; font-weight: bold; }
          .exercise-item { margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
          .exercise-name { font-weight: 600; }
          .exercise-details { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px; font-size: 0.9em; color: #555; }
          .notes { font-style: italic; color: #666; margin-top: 15px; background: #fff; padding: 10px; border-radius: 4px; border-left: 3px solid #22c55e; }
        </style>
      </head>
      <body>
        <h1>Antrenman Kayıt Defteri</h1>
        <p>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
        
        ${sortedLogs.map(log => `
          <div class="log-entry">
            <div class="log-header">
              <span class="log-routine">${log.routineName} ${log.category ? `(${log.category})` : ''}</span>
              <span class="log-date">${new Date(log.date).toLocaleString('tr-TR')}</span>
            </div>
            ${log.durationSeconds ? `<div style="font-size: 0.9em; color: #666; margin-bottom: 15px;">Süre: ${formatDuration(log.durationSeconds)} | Saat: ${formatTimeRange(log.startTime, log.endTime)}</div>` : ''}
            
            ${log.exercises.map(ex => {
      const def = data.exercises.find(e => e.id === ex.exerciseId);
      const set = ex.sets[0];
      return `
              <div class="exercise-item">
                <div class="exercise-name">${def?.name || 'Bilinmeyen'}</div>
                <div class="exercise-details">
                  <span>📊 ${ex.sets.length} set</span>
                  ${set?.reps ? `<span>🔄 ${set.reps} tekrar</span>` : ''}
                  ${set?.weight ? `<span>🏋️ ${set.weight} kg</span>` : ''}
                  ${set?.timeSeconds ? `<span>⏱️ ${formatTimeDetailed(set.timeSeconds)}</span>` : ''}
                </div>
              </div>
            `}).join('')}
            
            ${log.notes ? `<div class="notes">${log.notes}</div>` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `antrenman_kayitlari_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Kayıt Defteri</h2>
          <p className="text-sm text-slate-500">{sortedLogs.length} antrenman tamamlandı</p>
        </div>
        <Button onClick={handleDownloadHtml} variant="secondary" size="sm" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Kayıtları İndir</span>
        </Button>
      </div>

      {/* Log List */}
      <div className="space-y-3">
        {sortedLogs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Henüz antrenman kaydı bulunmuyor.</p>
            <p className="text-sm text-slate-400">Antrenman Kaydı bölümünden ilk kaydını oluştur.</p>
          </div>
        ) : (
          sortedLogs.map((log) => {
            const isLogExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isLogExpanded ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-100'}`}
              >
                {/* Log Header - Sade Görünüm */}
                <div
                  onClick={() => toggleLog(log.id)}
                  className="p-4 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-transform duration-200 ${isLogExpanded ? 'rotate-90 bg-brand-100' : 'bg-slate-100'}`}>
                      <ChevronDown size={16} className={`text-slate-500 transition-transform ${isLogExpanded ? 'rotate-[-90deg]' : ''}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        {log.routineName}
                        {log.category && (
                          <span className="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                            {log.category}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(log.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {log.durationSeconds && log.durationSeconds > 0 && (
                          <span className="flex items-center gap-1">
                            <Timer size={12} />
                            {formatDuration(log.durationSeconds)}
                          </span>
                        )}
                        <span className="text-slate-400">• {log.exercises.length} egzersiz</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {log.media && log.media.length > 0 && <MediaButtons media={log.media} compact />}
                    {onDeleteLog && (
                      <button
                        onClick={() => {
                          if (confirm('Bu antrenman kaydını silmek istediğinize emin misiniz?')) {
                            onDeleteLog(log.id);
                          }
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Kaydı Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Genişletilmiş Detaylar */}
                {isLogExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top-1 duration-150">
                    {/* Zaman Bilgisi */}
                    {log.startTime && (
                      <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                        <Clock size={12} />
                        <span>Saat: {formatTimeRange(log.startTime, log.endTime)}</span>
                      </div>
                    )}

                    {/* Notlar */}
                    {log.notes && (
                      <div className="mx-4 mt-3 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-100 italic">
                        "{log.notes}"
                      </div>
                    )}

                    {/* Egzersiz Listesi - Toggle Format */}
                    <div className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Egzersizler</p>
                      {log.exercises.map((ex, idx) => {
                        // Hareket mi egzersiz mi kontrol et
                        const isMovement = ex.exerciseId.startsWith('mov_');
                        const movId = ex.exerciseId.replace('mov_', '');

                        // Tanımı al
                        const def = isMovement
                          ? (data.movements || []).find(m => m.id === movId)
                          : data.exercises.find(e => e.id === ex.exerciseId);

                        const isExerciseExpanded = expandedExercises.has(`${log.id}-${idx}`);
                        const set = ex.sets[0];

                        // Set/tekrar özet
                        const targetSummary = [
                          ex.sets.length > 0 && `${ex.sets.length} set`,
                          set?.reps && `${set.reps} tekrar`,
                          set?.weight && `${set.weight}kg`,
                          set?.timeSeconds && formatTimeDetailed(set.timeSeconds)
                        ].filter(Boolean).join(' • ');

                        // Egzersizin içindeki hareketler (sadece egzersizler için)
                        const exerciseMovements = !isMovement && def && 'movementIds' in def
                          ? (def.movementIds || []).map(mId => (data.movements || []).find(m => m.id === mId)).filter(Boolean)
                          : !isMovement && def && 'movementId' in def && def.movementId
                            ? [(data.movements || []).find(m => m.id === def.movementId)].filter(Boolean)
                            : [];

                        const exerciseKey = `${log.id}-${idx}`;

                        // Ekipman isimleri
                        const equipmentNames = def && 'equipmentIds' in def
                          ? (def.equipmentIds || [])
                            .map(id => data.equipment.find(eq => eq.id === id)?.name)
                            .filter(Boolean)
                            .join(', ')
                          : '';

                        // Doğrudan hareket eklendiyse farklı göster
                        if (isMovement && def) {
                          const movDef = def as any; // Movement type
                          const movUniqueId = `mov_${log.id}_${idx}`;
                          const isMovExpanded = expandedExercises.has(`${log.id}-${idx}`);

                          return (
                            <div key={idx} className={`bg-emerald-50 rounded-lg border overflow-hidden transition-all ${isMovExpanded ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-emerald-200'}`}>
                              {/* Hareket Header */}
                              <div
                                onClick={() => toggleExercise(log.id, idx)}
                                className="p-3 cursor-pointer flex items-center justify-between hover:bg-emerald-100/50 transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className={`p-1 rounded transition-transform duration-200 shrink-0 ${isMovExpanded ? 'rotate-90 bg-emerald-200' : 'bg-emerald-100'}`}>
                                    <ChevronRight size={12} className="text-emerald-600" />
                                  </div>
                                  <Move size={14} className="text-emerald-600 shrink-0" />
                                  {movDef.media && <MediaButtons media={[movDef.media]} compact />}
                                  <div className="min-w-0">
                                    <span className="font-medium text-emerald-800">{movDef.name}</span>
                                    {targetSummary && (
                                      <span className="text-[10px] text-emerald-600 ml-2">• {targetSummary}</span>
                                    )}
                                  </div>
                                </div>
                                {/* Etki alanları mini */}
                                <div className="flex gap-0.5 shrink-0">
                                  {(movDef.effectAreas || []).slice(0, 2).map((areaKey: string) => {
                                    const area = EFFECT_AREAS.find(a => a.key === areaKey);
                                    return area ? <span key={areaKey} className="text-[10px]">{area.emoji}</span> : null;
                                  })}
                                </div>
                              </div>

                              {/* Hareket Detayları */}
                              {isMovExpanded && (
                                <div className="px-3 pb-3 border-t border-emerald-200 bg-emerald-50/50 animate-in slide-in-from-top-1 duration-150">
                                  {/* Etki Alanları */}
                                  {(movDef.effectAreas || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {(movDef.effectAreas || []).map((areaKey: string) => {
                                        const area = EFFECT_AREAS.find(a => a.key === areaKey);
                                        if (!area) return null;
                                        return (
                                          <span key={areaKey} className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                                            {area.emoji} {area.label}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Açıklama */}
                                  {movDef.description && (
                                    <p className="text-[10px] text-slate-600 mt-2 italic leading-relaxed">{movDef.description}</p>
                                  )}

                                  {/* Ekipmanlar */}
                                  {(movDef.equipmentIds || []).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-emerald-200">
                                      <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-1">
                                        <Package size={9} />
                                        <span className="font-medium">Ekipmanlar:</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {(movDef.equipmentIds || []).map((eqId: string) => {
                                          const eq = data.equipment.find(e => e.id === eqId);
                                          if (!eq) return null;
                                          return (
                                            <span key={eqId} className="inline-flex items-center gap-1 text-[9px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                              {eq.name}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Egzersiz gösterimi
                        return (
                          <div
                            key={idx}
                            className={`bg-white rounded-lg border overflow-hidden transition-all ${isExerciseExpanded ? 'border-brand-200 shadow-md' : 'border-slate-200 shadow-sm'}`}
                          >
                            {/* Exercise Header - Toggle */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExercise(log.id, idx);
                              }}
                              className="w-full p-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                            >
                              <div className={`p-1 rounded transition-transform duration-200 ${isExerciseExpanded ? 'rotate-90' : ''}`}>
                                <ChevronRight size={14} className="text-slate-400" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-800 flex items-center gap-2">
                                  {def?.name || 'Bilinmeyen Egzersiz'}
                                  {exerciseMovements.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded flex items-center gap-0.5">
                                      <Move size={9} /> {exerciseMovements.length}
                                    </span>
                                  )}
                                </div>

                                {/* Quick Summary */}
                                {!isExerciseExpanded && targetSummary && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {targetSummary}
                                  </div>
                                )}
                              </div>

                              {def?.media && <MediaButtons media={[def.media]} compact />}
                            </button>

                            {/* Expanded Details */}
                            {isExerciseExpanded && (
                              <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top-1 duration-150">
                                {/* Kompakt hedef bilgileri */}
                                {targetSummary && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {ex.sets.length > 0 && <span className="text-[10px] px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full">{ex.sets.length} set</span>}
                                    {set?.reps && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{set.reps} tekrar</span>}
                                    {set?.weight && <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">{set.weight}kg</span>}
                                    {set?.timeSeconds && (
                                      <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                                        {ex.actualDurationSeconds ? (
                                          <>{formatTimeDetailed(ex.actualDurationSeconds)} <span className="opacity-60">/ {formatTimeDetailed(set.timeSeconds)}</span></>
                                        ) : (
                                          formatTimeDetailed(set.timeSeconds)
                                        )}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Ekipman */}
                                {equipmentNames && (
                                  <div className="text-[10px] text-slate-500 mb-2">
                                    <span className="font-medium">Ekipman:</span> {equipmentNames}
                                  </div>
                                )}

                                {/* Açıklama */}
                                {def?.description && (
                                  <p className="text-[10px] text-slate-500 italic">{def.description}</p>
                                )}

                                {/* Hareketler Listesi */}
                                {exerciseMovements.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-slate-200">
                                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-1 mb-2">
                                      <Move size={10} /> Hareketler
                                    </p>
                                    <div className="space-y-1.5">
                                      {exerciseMovements.map((mov: any, mIdx) => {
                                        const movKey = `${exerciseKey}_mov_${mIdx}`;
                                        const isMovExpanded = expandedMovements.has(movKey);

                                        // Hareket hedef özeti
                                        const movTargetSummary = [
                                          mov.defaultSets && `${mov.defaultSets} set`,
                                          mov.defaultReps && `${mov.defaultReps} tekrar`,
                                          mov.defaultWeight && `${mov.defaultWeight}kg`,
                                          mov.defaultTimeSeconds && formatTimeDetailed(mov.defaultTimeSeconds)
                                        ].filter(Boolean).join(' • ');

                                        return (
                                          <div key={mIdx} className={`bg-white rounded border overflow-hidden transition-all ${isMovExpanded ? 'border-emerald-300' : 'border-emerald-100'}`}>
                                            {/* Hareket Header */}
                                            <div
                                              onClick={(e) => { e.stopPropagation(); toggleMovement(movKey); }}
                                              className="p-2 cursor-pointer flex items-center justify-between hover:bg-emerald-50/50 transition-colors"
                                            >
                                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <div className={`p-0.5 rounded transition-transform duration-200 shrink-0 ${isMovExpanded ? 'rotate-90 bg-emerald-100' : 'bg-emerald-50'}`}>
                                                  <ChevronRight size={10} className="text-emerald-500" />
                                                </div>
                                                {mov.media && <MediaButtons media={[mov.media]} compact />}
                                                <div className="min-w-0">
                                                  <span className="text-sm font-medium text-emerald-800">{mov.name}</span>
                                                  {movTargetSummary && (
                                                    <span className="text-[9px] text-emerald-600 ml-1.5">• {movTargetSummary}</span>
                                                  )}
                                                </div>
                                              </div>
                                              {/* Etki alanları mini */}
                                              <div className="flex gap-0.5 shrink-0">
                                                {(mov.effectAreas || []).slice(0, 2).map((areaKey: string) => {
                                                  const area = EFFECT_AREAS.find(a => a.key === areaKey);
                                                  return area ? <span key={areaKey} className="text-[9px]">{area.emoji}</span> : null;
                                                })}
                                              </div>
                                            </div>

                                            {/* Hareket Detayları */}
                                            {isMovExpanded && (
                                              <div className="px-2 pb-2 border-t border-emerald-100 bg-emerald-50/30 animate-in slide-in-from-top-1 duration-150">
                                                {/* Etki Alanları */}
                                                {(mov.effectAreas || []).length > 0 && (
                                                  <div className="flex flex-wrap gap-1 mt-2">
                                                    {(mov.effectAreas || []).map((areaKey: string) => {
                                                      const area = EFFECT_AREAS.find(a => a.key === areaKey);
                                                      if (!area) return null;
                                                      return (
                                                        <span key={areaKey} className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                                                          {area.emoji} {area.label}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                )}

                                                {/* Açıklama */}
                                                {mov.description && (
                                                  <p className="text-[10px] text-slate-600 mt-2 italic leading-relaxed">{mov.description}</p>
                                                )}

                                                {/* Ekipmanlar */}
                                                {(mov.equipmentIds || []).length > 0 && (
                                                  <div className="mt-2 pt-2 border-t border-emerald-100">
                                                    <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-1">
                                                      <Package size={9} />
                                                      <span className="font-medium">Ekipmanlar:</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                      {(mov.equipmentIds || []).map((eqId: string) => {
                                                        const eq = data.equipment.find(e => e.id === eqId);
                                                        if (!eq) return null;
                                                        return (
                                                          <span key={eqId} className="inline-flex items-center gap-1 text-[9px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                            {eq.name}
                                                            {eq.image && <MediaButtons media={[eq.image]} compact />}
                                                          </span>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Tüm Setler */}
                                {ex.sets.length > 1 && (
                                  <div className="mt-2 pt-2 border-t border-slate-200">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Tüm Setler</p>
                                    <div className="flex flex-wrap gap-1">
                                      {ex.sets.map((s, sIdx) => (
                                        <span
                                          key={sIdx}
                                          className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded"
                                        >
                                          {sIdx + 1}. {formatSetDisplay(s)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};