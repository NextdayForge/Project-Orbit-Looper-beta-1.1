import { UserModel } from '../../types/userModel';

export function buildLearningNotes(model: UserModel | null): string[] {
  const snapshot = model?.lastDailySnapshot;
  if (!snapshot || !model) {
    return [];
  }

  const notes: string[] = [
    `${snapshot.date} の実績を反映（完了率 ${Math.round(snapshot.completionRate * 100)}%）`,
  ];

  if (snapshot.skipRate >= 0.15) {
    notes.push('スキップが目立ったため、明日はセッション本数を抑えめに調整します');
  }
  if (snapshot.rescheduleRate >= 0.15) {
    notes.push('リスケが多かったため、切り替えバッファを多めに確保します');
  }

  const defaultFactor = model.estimationFactor.default ?? 1;
  if (defaultFactor >= 1.15) {
    notes.push('見積より時間がかかる傾向を学習しました');
  } else if (defaultFactor <= 0.9) {
    notes.push('見積より早く終わる傾向を学習しました');
  }

  if (Math.abs(model.focusLength - 45) >= 5) {
    notes.push(`集中ブロックは約${Math.round(model.focusLength)}分が合いやすいと判断しています`);
  }

  if (snapshot.wins.length > 0) {
    notes.push(`うまくいったこと: ${snapshot.wins.slice(0, 2).join('、')}`);
  }
  if (snapshot.blockers.length > 0) {
    notes.push(`妨げになったこと: ${snapshot.blockers.slice(0, 2).join('、')}`);
  }

  return notes;
}
