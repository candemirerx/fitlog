import React, { useState } from 'react';
import { WorkoutLog, AppData, Exercise, WorkoutSet } from '../types';
import { Button } from '../components/Button';
import { Download, Calendar, Activity, ChevronRight, ChevronDown, Clock, Timer } from 'lucide-react';
import { MediaButtons } from './ActiveWorkout'; // Importing the helper component

interface LogbookProps {
  data: AppData;
}

export const LogbookView: React.FC<LogbookProps> = ({ data }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const sortedLogs = [...data.logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getExerciseDef = (id: string) => {
    return data.exercises.find(e => e.id === id);
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatSetDisplay = (set: WorkoutSet, type?: string) => {
    if (type === 'time') {
      const mins = Math.floor((set.timeSeconds || 0) / 60);
      const secs = (set.timeSeconds || 0) % 60;
      return `${mins > 0 ? `${mins}dk ` : ''}${secs}sn`;
    }
    if (type === 'completion') {
      return 'Tamamlandı';
    }
    return `${set.weight ? `${set.weight}kg x` : ''} ${set.reps || 0} tekrar`;
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
          .log-stats { font-size: 0.9em; color: #666; margin-bottom: 15px; }
          .exercise-item { margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
          .exercise-name { font-weight: 600; }
          .set-list { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px; }
          .set-tag { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.9em; }
          .notes { font-style: italic; color: #666; margin-top: 10px; background: #fff; padding: 10px; border-radius: 4px; }
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
            ${log.durationSeconds ? `<div class="log-stats">Süre: ${formatDuration(log.durationSeconds)} | Saat: ${formatTimeRange(log.startTime, log.endTime)}</div>` : ''}
            
            ${log.exercises.map(ex => {
              const def = data.exercises.find(e => e.id === ex.exerciseId);
              return `
              <div class="exercise-item">
                <div class="exercise-name">${def?.name || 'Bilinmeyen'}</div>
                <div class="set-list">
                  ${ex.sets.map((set, idx) => {
                     let text = '';
                     if(def?.trackingType === 'time') {
                        const m = Math.floor((set.timeSeconds || 0) / 60);
                        const s = (set.timeSeconds || 0) % 60;
                        text = (m > 0 ? m + 'dk ' : '') + s + 'sn';
                     } else if (def?.trackingType === 'completion') {
                        text = 'Tamamlandı';
                     } else {
                        text = (set.weight ? set.weight + 'kg x ' : '') + (set.reps || 0) + ' tekrar';
                     }
                     return `<span class="set-tag">Set ${idx + 1}: ${text}</span>`;
                  }).join('')}
                </div>
              </div>
            `}).join('')}
            
            ${log.notes ? `<div class="notes">Notlar: ${log.notes}</div>` : ''}
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

      <div className="space-y-4">
        {sortedLogs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Henüz antrenman kaydı bulunmuyor.</p>
            <p className="text-sm text-slate-400">Antrenman Kaydı bölümünden ilk kaydını oluştur.</p>
          </div>
        ) : (
          sortedLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <div 
                key={log.id} 
                className={`bg-white rounded-xl shadow-sm border transition-all overflow-hidden ${isExpanded ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-100 hover:shadow-md'}`}
              >
                {/* Header (Always Visible) */}
                <div 
                  onClick={() => toggleExpand(log.id)}
                  className="p-4 cursor-pointer flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{log.routineName}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                        <div className="flex items-center gap-1">
                           <Calendar className="w-3 h-3" />
                           {new Date(log.date).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {log.durationSeconds && (
                          <div className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {formatDuration(log.durationSeconds)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {log.media && log.media.length > 0 && (
                         <MediaButtons media={log.media} />
                      )}
                      
                      {log.category && (
                        <span className="px-2 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-md hidden sm:inline-block">
                          {log.category}
                        </span>
                      )}
                      <div className={`p-1 rounded-full transition-transform duration-200 ${isExpanded ? 'bg-slate-100 rotate-180' : ''}`}>
                         <ChevronDown size={20} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Collapsed Summary */}
                  {!isExpanded && (
                    <div className="text-sm text-slate-500 border-t border-slate-50 pt-2 flex items-center justify-between">
                      <span>{log.exercises.length} Egzersiz Tamamlandı</span>
                      <span className="text-xs text-brand-600 font-medium">Detayları Gör</span>
                    </div>
                  )}
                </div>

                {/* Detailed View (Expanded) */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/30 animate-in slide-in-from-top-2 duration-200">
                    {log.notes && (
                      <div className="mb-4 mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-100 italic">
                        "{log.notes}"
                      </div>
                    )}
                    
                    <div className="space-y-4 mt-4">
                      {log.exercises.map((ex, idx) => {
                        const def = getExerciseDef(ex.exerciseId);
                        return (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <div className="font-semibold text-slate-800 mb-2 border-b border-slate-50 pb-1 flex justify-between items-center">
                              <span className="flex items-center gap-2">
                                {def?.name || 'Bilinmeyen'}
                              </span>
                              {def?.trackingType === 'time' && <Clock size={14} className="text-slate-400" />}
                              {def?.media && <MediaButtons media={[def.media]} />}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {ex.sets.map((set, sIdx) => (
                                <div key={sIdx} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1">
                                  <span className="font-bold text-slate-400">{sIdx + 1}:</span>
                                  {formatSetDisplay(set, def?.trackingType)}
                                </div>
                              ))}
                            </div>
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