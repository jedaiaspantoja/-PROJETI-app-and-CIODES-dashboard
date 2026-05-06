export function formatarData(timestamp: number) {
  const d = new Date(timestamp);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
